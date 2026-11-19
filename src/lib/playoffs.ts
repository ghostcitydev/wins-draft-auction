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

/**
 * Standings as of the end of `week`: overall / division / conference records
 * and point differential, from completed regular-season games only.
 */
function buildStandings(
  allTeams: PlayoffTeamInfo[],
  played: GameRow[],
  idToAbbr: Map<string, string>
) {
  const byAbbr = new Map(allTeams.map((t) => [t.abbr, t]));
  const base = () => ({ w: 0, l: 0, t: 0 });
  const s = new Map(
    allTeams.map((t) => [
      t.abbr,
      { overall: base(), div: base(), conf: base(), pf: 0, pa: 0 },
    ])
  );
  // head-to-head results: h2h[a][b] = a's record vs b
  const h2h = new Map<string, Map<string, Rec>>();
  const h2hRec = (a: string, b: string) => {
    if (!h2h.has(a)) h2h.set(a, new Map());
    const m = h2h.get(a)!;
    if (!m.has(b)) m.set(b, base());
    return m.get(b)!;
  };

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
      add(h2hRec(me.abbr, opp.abbr), ms, os);
      row.pf += ms;
      row.pa += os;
    }
  }
  return { s, h2hRec };
}

/**
 * Simplified NFL tiebreakers: win pct, then (within a group still tied on
 * win pct) head-to-head pct among the tied teams, division pct (when they
 * share a division), conference pct, point differential, then abbr.
 * Common games / strength of victory / strength of schedule are skipped.
 */
function rank(
  abbrs: string[],
  info: Map<string, PlayoffTeamInfo>,
  st: ReturnType<typeof buildStandings>
): string[] {
  const { s, h2hRec } = st;
  const sorted = [...abbrs].sort((a, b) => pct(s.get(b)!.overall) - pct(s.get(a)!.overall));
  const out: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    const p = pct(s.get(sorted[i])!.overall);
    while (j < sorted.length && pct(s.get(sorted[j])!.overall) === p) j++;
    const group = sorted.slice(i, j);
    if (group.length > 1) {
      const h2hPct = (a: string) => {
        const r = { w: 0, l: 0, t: 0 };
        for (const o of group) {
          if (o === a) continue;
          const x = h2hRec(a, o);
          r.w += x.w;
          r.l += x.l;
          r.t += x.t;
        }
        return r.w + r.l + r.t ? pct(r) : 0.5;
      };
      const sameDiv = group.every((a) => info.get(a)!.division === info.get(group[0])!.division);
      const keys = (a: string) => {
        const row = s.get(a)!;
        return [h2hPct(a), sameDiv ? pct(row.div) : 0, pct(row.conf), row.pf - row.pa];
      };
      group.sort((a, b) => {
        const ka = keys(a);
        const kb = keys(b);
        for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return kb[k] - ka[k];
        return a.localeCompare(b);
      });
    }
    out.push(...group);
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
          st
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
      const rankedWinners = rank(winners, info, st);
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
        const pick = rank(candidates, info, st)[0];
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
