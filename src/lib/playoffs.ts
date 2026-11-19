import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games, teams } from "@/db/schema";
import type {
  PlayoffTeamInfo,
  PlayoffStanding,
  PlayoffWeek,
  PlayoffsResult,
} from "./playoff-types";
export type * from "./playoff-types";

interface Rec {
  w: number;
  l: number;
  t: number;
}
const pct = (r: Rec) => {
  const gp = r.w + r.l + r.t;
  return gp ? (r.w + 0.5 * r.t) / gp : 0;
};
const add = (r: Rec, ts: number, os: number) => {
  if (ts > os) r.w++;
  else if (ts < os) r.l++;
  else r.t++;
};

type GameRow = typeof games.$inferSelect;

interface Result {
  opp: string;
  ms: number;
  os: number;
}

interface TeamLine {
  overall: Rec;
  div: Rec;
  conf: Rec;
  pf: number;
  pa: number;
  results: Result[];
}

/**
 * Standings as of the end of `week`: overall / division / conference records,
 * points, and every game result (for head-to-head, common games, strength of
 * victory / schedule), from completed regular-season games only.
 */
function buildStandings(
  allTeams: PlayoffTeamInfo[],
  played: GameRow[],
  idToAbbr: Map<string, string>
) {
  const byAbbr = new Map(allTeams.map((t) => [t.abbr, t]));
  const base = () => ({ w: 0, l: 0, t: 0 });
  const s = new Map<string, TeamLine>(
    allTeams.map((t) => [
      t.abbr,
      { overall: base(), div: base(), conf: base(), pf: 0, pa: 0, results: [] },
    ])
  );

  for (const g of played) {
    const home = idToAbbr.get(g.homeTeamId);
    const away = idToAbbr.get(g.awayTeamId);
    if (!home || !away || g.homeScore === null || g.awayScore === null) continue;
    const hi = byAbbr.get(home)!;
    const ai = byAbbr.get(away)!;
    for (const [me, opp, ms, os] of [
      [hi, ai, g.homeScore, g.awayScore],
      [ai, hi, g.awayScore, g.homeScore],
    ] as const) {
      const row = s.get(me.abbr)!;
      add(row.overall, ms, os);
      if (me.division === opp.division) add(row.div, ms, os);
      if (me.conference === opp.conference) add(row.conf, ms, os);
      row.pf += ms;
      row.pa += os;
      row.results.push({ opp: opp.abbr, ms, os });
    }
  }
  return { s };
}

type Standings = ReturnType<typeof buildStandings>;
type Mode = "division" | "wildcard";
/** A tiebreak step: returns the surviving (best) subset, or null if it doesn't apply. */
type Step = (group: string[]) => string[] | null;

const EPS = 1e-9;

/** Keep the teams with the best (highest) value; null if every team is equal. */
function keepBest(group: string[], value: (a: string) => number): string[] | null {
  const vals = group.map(value);
  const best = Math.max(...vals);
  const kept = group.filter((_, i) => vals[i] >= best - EPS);
  return kept.length < group.length ? kept : null;
}

function recordVs(st: Standings, a: string, opps: Set<string>): Rec & { net: number } {
  const r = { w: 0, l: 0, t: 0, net: 0 };
  for (const g of st.s.get(a)!.results) {
    if (!opps.has(g.opp)) continue;
    add(r, g.ms, g.os);
    r.net += g.ms - g.os;
  }
  return r;
}

/** Opponents every team in the group has played (excluding the group itself). */
function commonOpponents(st: Standings, group: string[]): Set<string> {
  const sets = group.map((a) => new Set(st.s.get(a)!.results.map((g) => g.opp)));
  const common = new Set<string>();
  for (const o of sets[0]) if (sets.every((x) => x.has(o)) && !group.includes(o)) common.add(o);
  return common;
}

/** Strength of victory (wins only) or schedule (all games): combined record of those opponents. */
function strength(st: Standings, a: string, winsOnly: boolean): number {
  const r = { w: 0, l: 0, t: 0 };
  for (const g of st.s.get(a)!.results) {
    if (winsOnly && g.ms <= g.os) continue;
    const o = st.s.get(g.opp)!.overall;
    r.w += o.w;
    r.l += o.l;
    r.t += o.t;
  }
  return pct(r);
}

/**
 * NFL tiebreaking steps, in order. Division ties: head-to-head, division
 * record, common games, conference record, strength of victory, strength of
 * schedule, net points in common games, net points in all games. Wild-card
 * ties: head-to-head (only a sweep counts with 3+ teams), conference record,
 * common games (min. 4), SOV, SOS, net points in conference games, net
 * points in all games. The two "combined ranking in points" steps and net
 * touchdowns aren't tracked and are skipped; a coin toss is replaced by
 * alphabetical order.
 */
function steps(st: Standings, info: Map<string, PlayoffTeamInfo>, mode: Mode): Step[] {
  const line = (a: string) => st.s.get(a)!;

  const h2h: Step = (group) => {
    const vsGroup = (a: string) => recordVs(st, a, new Set(group.filter((o) => o !== a)));
    if (mode === "division" || group.length === 2) {
      // Only meaningful once they've actually played each other.
      if (group.every((a) => { const r = vsGroup(a); return r.w + r.l + r.t === 0; })) return null;
      return keepBest(group, (a) => {
        const r = vsGroup(a);
        return r.w + r.l + r.t ? pct(r) : 0.5;
      });
    }
    // Wild card, 3+ teams: applies only if one team beat each of the others
    // (it advances) or lost to each of the others (it drops out).
    for (const a of group) {
      const others = group.filter((o) => o !== a);
      if (others.every((o) => { const r = recordVs(st, a, new Set([o])); return r.w > 0 && r.l === 0 && r.t === 0; }))
        return [a];
    }
    for (const a of group) {
      const others = group.filter((o) => o !== a);
      if (others.every((o) => { const r = recordVs(st, a, new Set([o])); return r.l > 0 && r.w === 0 && r.t === 0; }))
        return others;
    }
    return null;
  };

  const divRec: Step = (group) => keepBest(group, (a) => pct(line(a).div));
  const confRec: Step = (group) => keepBest(group, (a) => pct(line(a).conf));
  const common = (minGames: number): Step => (group) => {
    const opps = commonOpponents(st, group);
    const recs = group.map((a) => recordVs(st, a, opps));
    if (recs.some((r) => r.w + r.l + r.t < minGames) || recs.every((r) => r.w + r.l + r.t === 0))
      return null;
    return keepBest(group, (a) => pct(recordVs(st, a, opps)));
  };
  const sov: Step = (group) => keepBest(group, (a) => strength(st, a, true));
  const sos: Step = (group) => keepBest(group, (a) => strength(st, a, false));
  const netCommon: Step = (group) => {
    const opps = commonOpponents(st, group);
    return opps.size ? keepBest(group, (a) => recordVs(st, a, opps).net) : null;
  };
  const netConf: Step = (group) =>
    keepBest(group, (a) => {
      const conf = info.get(a)!.conference;
      return line(a)
        .results.filter((g) => info.get(g.opp)!.conference === conf)
        .reduce((n, g) => n + g.ms - g.os, 0);
    });
  const netAll: Step = (group) => keepBest(group, (a) => line(a).pf - line(a).pa);

  return mode === "division"
    ? [h2h, divRec, common(0), confRec, sov, sos, netCommon, netAll]
    : [h2h, confRec, common(4), sov, sos, netConf, netAll];
}

/** Find the single best team in a tied group, restarting at step 1 whenever the group shrinks. */
function breakTie(group: string[], stepList: Step[]): string {
  let g = [...group];
  outer: while (g.length > 1) {
    for (const step of stepList) {
      const kept = step(g);
      if (kept && kept.length < g.length) {
        g = kept;
        continue outer;
      }
    }
    return [...g].sort()[0];
  }
  return g[0];
}

/** Order teams by win pct, breaking ties with the NFL procedure for `mode`. */
function rank(
  abbrs: string[],
  info: Map<string, PlayoffTeamInfo>,
  st: Standings,
  mode: Mode
): string[] {
  const p = (a: string) => pct(st.s.get(a)!.overall);
  const sorted = [...abbrs].sort((a, b) => p(b) - p(a));
  const stepList = steps(st, info, mode);
  const out: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && Math.abs(p(sorted[j]) - p(sorted[i])) < EPS) j++;
    const group = sorted.slice(i, j);
    while (group.length) {
      const best = breakTie(group, stepList);
      out.push(best);
      group.splice(group.indexOf(best), 1);
    }
    i = j;
  }
  return out;
}

export async function getPlayoffs(currentSeason: number): Promise<PlayoffsResult> {
  const [teamRows, currentGames] = await Promise.all([
    db.select().from(teams),
    db.select().from(games).where(eq(games.season, currentSeason)),
  ]);

  // Before kickoff, preview last season's race so the tab isn't empty
  // (same rule as the wins-by-week chart).
  const hasReal = currentGames.some((g) => g.completed && g.seasonType === "REG");
  const season = hasReal ? currentSeason : currentSeason - 1;
  const seasonGames = hasReal
    ? currentGames
    : await db.select().from(games).where(eq(games.season, season));

  const regDone = seasonGames.filter(
    (g) => g.seasonType === "REG" && g.completed && g.homeScore !== null && g.awayScore !== null
  );
  const maxWeek = regDone.reduce((m, g) => Math.max(m, g.week), 0);

  const allTeams: PlayoffTeamInfo[] = teamRows
    .map((t) => ({
      abbr: t.abbr,
      name: t.name,
      shortName: t.shortName,
      conference: t.conference,
      division: t.division,
      logoUrl: t.logoUrl ?? `/logos/${t.abbr}.png`,
    }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
  const info = new Map(allTeams.map((t) => [t.abbr, t]));
  const idToAbbr = new Map(teamRows.map((t) => [t.id, t.abbr]));
  const conferences = [...new Set(allTeams.map((t) => t.conference))].sort();

  const weeks: PlayoffWeek[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const st = buildStandings(
      allTeams,
      regDone.filter((g) => g.week <= week),
      idToAbbr
    );
    const standings: Record<string, PlayoffStanding> = {};
    for (const t of allTeams) {
      const r = st.s.get(t.abbr)!;
      standings[t.abbr] = {
        abbr: t.abbr,
        w: r.overall.w,
        l: r.overall.l,
        t: r.overall.t,
        pct: pct(r.overall),
        divW: r.div.w,
        divL: r.div.l,
        divT: r.div.t,
        confW: r.conf.w,
        confL: r.conf.l,
        confT: r.conf.t,
        pointDiff: r.pf - r.pa,
        seed: null,
        divRank: 0,
        gamesBack: 0,
      };
    }

    const divisions: Record<string, string[]> = {};
    const seeds: Record<string, string[]> = {};
    for (const conf of conferences) {
      const confTeams = allTeams.filter((t) => t.conference === conf);
      const divNames = [...new Set(confTeams.map((t) => t.division))].sort();
      const winners: string[] = [];
      for (const d of divNames) {
        const order = rank(
          confTeams.filter((t) => t.division === d).map((t) => t.abbr),
          info,
          st,
          "division"
        );
        divisions[d] = order;
        winners.push(order[0]);
        const lead = standings[order[0]];
        order.forEach((a, i) => {
          const row = standings[a];
          row.divRank = i + 1;
          row.gamesBack = (lead.w - row.w + (row.l - lead.l)) / 2;
        });
      }
      const rankedWinners = rank(winners, info, st, "wildcard");
      // Wild cards: like the NFL, only the top remaining team from each
      // division is compared at a time, so division order is never broken.
      const remaining = confTeams.map((t) => t.abbr).filter((a) => !winners.includes(a));
      const rest: string[] = [];
      while (remaining.length) {
        const candidates = divNames
          .map((d) =>
            remaining
              .filter((a) => info.get(a)!.division === d)
              .sort((a, b) => standings[a].divRank - standings[b].divRank)[0]
          )
          .filter((a): a is string => !!a);
        const pick = rank(candidates, info, st, "wildcard")[0];
        rest.push(pick);
        remaining.splice(remaining.indexOf(pick), 1);
      }
      const order = [...rankedWinners, ...rest];
      seeds[conf] = order;
      order.forEach((a, i) => {
        if (i < 7) standings[a].seed = i + 1;
      });
      // Wild-card "games back" is measured from the 7th seed for teams
      // outside the field (and is 0 for anyone in it).
      const seven = standings[order[6]];
      order.forEach((a, i) => {
        if (i >= 7) {
          const row = standings[a];
          row.wcGamesBack = (seven.w - row.w + (row.l - seven.l)) / 2;
        }
      });
    }

    weeks.push({ week, standings, divisions, seeds });
  }

  return { season, isPreview: !hasReal, maxWeek, conferences, teams: allTeams, weeks };
}
