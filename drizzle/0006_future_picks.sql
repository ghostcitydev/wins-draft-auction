CREATE TABLE "future_picks" (
	"id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"persona" text DEFAULT 'Datong Dave' NOT NULL,
	"category" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "future_picks_unique" ON "future_picks" USING btree ("season","persona","category");
