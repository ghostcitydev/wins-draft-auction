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

export const teamWeekStats = pgTable(
  "team_week_stats",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id),
    opponentTeamId: text("opponent_team_id").notNull().references(() => teams.id),
    offPlays: integer("off_plays").notNull(),
    offEpa: real("off_epa").notNull(),
  },
  (table) => [
    uniqueIndex("team_week_stats_unique").on(table.season, table.week, table.teamId),
    index("team_week_stats_opponent_idx").on(table.season, table.opponentTeamId),
  ]
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
