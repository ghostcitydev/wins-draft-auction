CREATE TABLE "app_config" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"season" integer DEFAULT 2026 NOT NULL,
	"total_budget" real DEFAULT 400 NOT NULL,
	"max_team_value" real DEFAULT 47 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"team_id" text NOT NULL,
	"player_id" text NOT NULL,
	"paid" real NOT NULL,
	"round" integer,
	"preseason_ou" real NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "draft_picks_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"season_type" text DEFAULT 'REG' NOT NULL,
	"date" timestamp,
	"home_team_id" text NOT NULL,
	"away_team_id" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"espn_event_id" text,
	CONSTRAINT "games_espn_event_id_unique" UNIQUE("espn_event_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"ran_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"message" text
);
--> statement-breakpoint
CREATE TABLE "team_week_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team_id" text NOT NULL,
	"opponent_team_id" text NOT NULL,
	"off_plays" integer NOT NULL,
	"off_epa" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"abbr" text NOT NULL,
	"conference" text NOT NULL,
	"division" text NOT NULL,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_abbr_unique" UNIQUE("abbr")
);
--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_week_stats" ADD CONSTRAINT "team_week_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_week_stats" ADD CONSTRAINT "team_week_stats_opponent_team_id_teams_id_fk" FOREIGN KEY ("opponent_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_season_week_idx" ON "games" USING btree ("season","week");--> statement-breakpoint
CREATE UNIQUE INDEX "team_week_stats_unique" ON "team_week_stats" USING btree ("season","week","team_id");--> statement-breakpoint
CREATE INDEX "team_week_stats_opponent_idx" ON "team_week_stats" USING btree ("season","opponent_team_id");