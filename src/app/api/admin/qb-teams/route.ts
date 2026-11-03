import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, qbRatings, qbTeamOverrides, teams } from "@/db/schema";
import { QB_TEAM_ABBR, qbKey } from "@/lib/qb-epa-parser";
import { ABBR_ALIASES } from "@/lib/team-aliases";
import { ensureQbTeamOverridesTable, loadQbTeamOverrides } from "@/lib/qb-team-overrides";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

async function currentSeason() {
  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  return config[0]?.season ?? 2026;
}

/**
 * Lists QBs saved this season with no team (grouped by their "F.Last" key,
 * since different weeks' pastes can spell the same QB differently), with a
 * suggested team when the code list or a saved assignment already knows it.
 */
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const season = await currentSeason();
  const overrides = await loadQbTeamOverrides();
  const known = { ...QB_TEAM_ABBR, ...overrides };

  const [orphanRows, allTeams] = await Promise.all([
    db
      .select({ name: qbRatings.name, week: qbRatings.week })
      .from(qbRatings)
      .where(and(eq(qbRatings.season, season), isNull(qbRatings.teamId))),
    db.select({ abbr: teams.abbr, name: teams.name }).from(teams),
  ]);

  const byKey = new Map<string, { key: string; names: Set<string>; weeks: Set<number> }>();
  for (const r of orphanRows) {
    const key = qbKey(r.name, known);
    const entry = byKey.get(key) ?? { key, names: new Set(), weeks: new Set() };
    entry.names.add(r.name);
    entry.weeks.add(r.week);
    byKey.set(key, entry);
  }

  const unmatched = [...byKey.values()]
    .map((e) => {
      const suggested = known[e.key];
      return {
        key: e.key,
        names: [...e.names],
        weeks: [...e.weeks].sort((a, b) => a - b),
        suggestedAbbr: suggested ? ABBR_ALIASES[suggested.toUpperCase()] ?? suggested.toUpperCase() : null,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return NextResponse.json({
    season,
    unmatched,
    teams: allTeams.sort((a, b) => a.abbr.localeCompare(b.abbr)),
  });
}

interface Assignment {
  key: string;
  abbr: string;
}

/**
 * Saves { assignments: [{ key, abbr }] }: stores each as a QB -> team
 * override (used by every future QB paste) and fills in the team on this
 * season's already-saved rows for that QB that have no team yet.
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: { assignments?: Assignment[] } = await req.json();
  const assignments = (body.assignments ?? []).filter((a) => a.key && a.abbr);
  if (assignments.length === 0) {
    return NextResponse.json({ error: "Pick a team for at least one QB first." }, { status: 400 });
  }

  const allTeams = await db.select({ id: teams.id, abbr: teams.abbr }).from(teams);
  const teamIdByAbbr = new Map(allTeams.map((t) => [t.abbr, t.id]));
  const bad = assignments.filter((a) => !teamIdByAbbr.has(a.abbr));
  if (bad.length) {
    return NextResponse.json(
      { error: `Unknown team: ${bad.map((a) => a.abbr).join(", ")}` },
      { status: 400 }
    );
  }

  await ensureQbTeamOverridesTable();
  for (const a of assignments) {
    await db
      .insert(qbTeamOverrides)
      .values({ key: a.key, abbr: a.abbr })
      .onConflictDoUpdate({
        target: qbTeamOverrides.key,
        set: { abbr: a.abbr, updatedAt: new Date() },
      });
  }

  // Backfill this season's team-less rows whose name resolves to an assigned key.
  const season = await currentSeason();
  const known = { ...QB_TEAM_ABBR, ...(await loadQbTeamOverrides()) };
  const abbrByKey = new Map(assignments.map((a) => [a.key, a.abbr]));
  const orphanRows = await db
    .select({ id: qbRatings.id, name: qbRatings.name })
    .from(qbRatings)
    .where(and(eq(qbRatings.season, season), isNull(qbRatings.teamId)));

  const idsByTeam = new Map<string, string[]>();
  for (const r of orphanRows) {
    const abbr = abbrByKey.get(qbKey(r.name, known));
    if (!abbr) continue;
    const teamId = teamIdByAbbr.get(abbr)!;
    idsByTeam.set(teamId, [...(idsByTeam.get(teamId) ?? []), r.id]);
  }

  let rowsUpdated = 0;
  for (const [teamId, ids] of idsByTeam) {
    await db.update(qbRatings).set({ teamId }).where(inArray(qbRatings.id, ids));
    rowsUpdated += ids.length;
  }

  return NextResponse.json({ saved: assignments.length, rowsUpdated });
}
