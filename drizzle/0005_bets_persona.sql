ALTER TABLE "bets" ADD COLUMN "persona" text DEFAULT 'Datong Dave' NOT NULL;
--> statement-breakpoint
DROP INDEX "bets_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "bets_unique" ON "bets" USING btree ("season","week","team_id","persona");
