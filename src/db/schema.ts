import {
  pgTable,
  text,
  real,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const teams = pgTable("teams", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  abbr: text("abbr").notNull().unique(),
  conference: text("conference").notNull(),
  division: text("division").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const draftPicks = pgTable("draft_picks", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  season: integer("season").notNull(),
  teamId: text("team_id").notNull().unique().references(() => teams.id),
  playerId: text("player_id").notNull().references(() => players.id),
  paid: real("paid").notNull(),
  round: integer("round"),
  preseasonOU: real("preseason_ou").notNull(),
  // Real published preseason win-total projection (e.g. The Athletic's NFL
  // preview), not a computed proxy. Falls back to the OU-based formula in
  // src/lib/calculations.ts when a season/team doesn't have one yet.
  athleticProjection: real("athletic_projection"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    seasonType: text("season_type").notNull().default("REG"),
    date: timestamp("date"),
    homeTeamId: text("home_team_id").notNull().references(() => teams.id),
    awayTeamId: text("away_team_id").notNull().references(() => teams.id),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    completed: boolean("completed").notNull().default(false),
    espnEventId: text("espn_event_id").unique(),
  },
  (table) => [index("games_season_week_idx").on(table.season, table.week)]
);

/**
 * A weekly snapshot of nfelo.com's power ratings table (EPA, Pythagorean
 * wins, Elo, etc.) for one team. nfelo has no public API, so these rows are
 * populated by the commissioner pasting the site's table into /admin each
 * week (see /api/admin/team-ratings) - same workflow as the original
 * spreadsheet's "EPA" tab.
 */
export const teamRatings = pgTable(
  "team_ratings",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id),
    source: text("source").notNull().default("nfelo"),
    nfeloRating: real("nfelo_rating"),
    qbAdj: real("qb_adj"),
    value: real("value"),
    wow: real("wow"),
    ytd: real("ytd"),
    offPlay: real("off_play"),
    offPass: real("off_pass"),
    offRush: real("off_rush"),
    defPlay: real("def_play"),
    defPass: real("def_pass"),
    defRush: real("def_rush"),
    epaPlay: real("epa_play"),
    pointsFor: real("points_for"),
    pointsAgainst: real("points_against"),
    diff: real("diff"),
    wins: real("wins"),
    pythagWins: real("pythag_wins"),
    elo: real("elo"),
    film: real("film"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("team_ratings_unique").on(table.season, table.week, table.teamId)]
);

/**
 * A single spread bet placed on a real game. Grading (win/loss/push, units
 * won/lost) is computed live from the real synced score in `games` (see
 * src/lib/bets.ts) rather than stored here - so it's never stale and never
 * requires a manual "mark as graded" step. `spread`/`closingLine` are both
 * signed relative to `teamId` (the side taken), e.g. +2.5 = getting points,
 * -6.5 = laying points. `juice` is American odds (e.g. -107).
 */
export const bets = pgTable(
  "bets",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id),
    // Free-text label for who/what strategy is being tracked (e.g. a person's
    // name or a betting persona/alias) - lets more than one "bettor" log a
    // bet on the same team/week and be tracked separately.
    persona: text("persona").notNull().default("Datong Dave"),
    spread: real("spread").notNull(),
    juice: integer("juice").notNull().default(-107),
    units: real("units").notNull().default(1),
    closingLine: real("closing_line"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("bets_unique").on(table.season, table.week, table.teamId, table.persona)]
);

/**
 * A single "futures" prediction - a preseason pick that isn't tied to any
 * one game, spanning the playoff bracket (seeds/conference champs/Super
 * Bowl champ) and award categories (MVP, Coach of the Year, etc - see
 * src/lib/future-categories.ts for the fixed category list). Purely a
 * side-by-side comparison across personas - unlike `bets`, there's no
 * grading/scoring against a real outcome. `value` is a team abbreviation
 * for "team"-type categories or free text (a player/coach name) for
 * "text"-type categories.
 */
export const futurePicks = pgTable(
  "future_picks",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    season: integer("season").notNull(),
    persona: text("persona").notNull().default("Datong Dave"),
    category: text("category").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("future_picks_unique").on(table.season, table.persona, table.category)]
);

export const syncLog = pgTable("sync_log", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  source: text("source").notNull(),
  ranAt: timestamp("ran_at").defaultNow().notNull(),
  status: text("status").notNull(),
  message: text("message"),
});

export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey().default("singleton"),
  season: integer("season").notNull().default(2026),
  totalBudget: real("total_budget").notNull().default(400),
  maxTeamValue: real("max_team_value").notNull().default(47),
});
