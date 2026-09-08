CREATE TABLE "bets" (
	"id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team_id" text NOT NULL,
	"spread" real NOT NULL,
	"juice" integer DEFAULT -110 NOT NULL,
	"units" real DEFAULT 1 NOT NULL,
	"closing_line" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bets_unique" ON "bets" USING btree ("season","week","team_id");
