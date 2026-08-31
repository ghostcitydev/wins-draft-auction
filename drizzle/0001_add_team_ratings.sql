ALTER TABLE "team_week_stats" DROP CONSTRAINT "team_week_stats_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "team_week_stats" DROP CONSTRAINT "team_week_stats_opponent_team_id_teams_id_fk";
--> statement-breakpoint
DROP TABLE "team_week_stats";
--> statement-breakpoint
CREATE TABLE "team_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team_id" text NOT NULL,
	"source" text DEFAULT 'nfelo' NOT NULL,
	"nfelo_rating" real,
	"qb_adj" real,
	"value" real,
	"wow" real,
	"ytd" real,
	"off_play" real,
	"off_pass" real,
	"off_rush" real,
	"def_play" real,
	"def_pass" real,
	"def_rush" real,
	"epa_play" real,
	"points_for" real,
	"points_against" real,
	"diff" real,
	"wins" real,
	"pythag_wins" real,
	"elo" real,
	"film" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_ratings" ADD CONSTRAINT "team_ratings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_ratings_unique" ON "team_ratings" USING btree ("season","week","team_id");
