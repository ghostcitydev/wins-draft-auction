# Wins Draft Auction

A mobile-first live standings tracker for an 8-person NFL "wins draft" auction
pool (32 teams, $50/player, 4 teams each). Built with Next.js (App Router),
Drizzle ORM + Postgres, deployed on Vercel.

## What it shows

**Standings** (`/`) - all 32 NFL teams: record, win %, preseason O/U, $ paid,
computed auction value, point differential, projected wins, Pythagorean wins,
and EPA/play - sortable, with a tap-through to each team's full schedule.

**Players** (`/players`) - the same data grouped by each of the 8 drafters,
showing their 4 teams and running totals.

**Team detail** (`/teams/[abbr]`) - full past and future schedule, all core
stats for one team.

**Setup** (`/admin`) - where the commissioner enters each season's real draft
results (which player has which team, $ paid, preseason O/U line).

## Where every number comes from

This matters, so it's spelled out rather than left implicit:

| Field | Source | Notes |
|---|---|---|
| Team master data (name, division, logo) | Hardcoded, `prisma/seed-data/teams-master.json` | Static NFL facts, seeded once |
| Player, $ paid, preseason O/U | Seeded from the 2026 Auction tab (`prisma/seed-data/draft-picks-2026.json`); editable any time via `/admin` | Real auction results, not placeholders |
| Wins / losses / ties / schedule / scores | [ESPN's public scoreboard API](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard) | Refreshed live. Always the real current season - never backfilled with placeholder data, so every team correctly shows 0-0 until it's actually played a game |
| Win %, Diff, Projected, Value/VOR | Computed in `src/lib/calculations.ts` | Projected/Value/VOR formulas are reverse-engineered **exactly** from the original commissioner spreadsheet's live formulas (verified against all 32 rows). Diff and Value both correctly show `0` (not a misleading negative) before anyone in the league has a win yet |
| Pythagorean wins, EPA/play | Computed in `src/lib/calculations.ts` from real games/[nflverse stats](https://github.com/nflverse/nflverse-data/releases/tag/stats_team) | Uses the standard Football Outsiders/PFR NFL Pythagorean exponent (2.37). **Before a team has played its first game of the current season**, these two columns fall back to showing last season's numbers as a clearly-marked placeholder (italic + `*` in the app) so the columns aren't just blank zeros - never presented as this season's real data |

The app refreshes ESPN + nflverse data on-demand: any time someone opens the
app and the data is >15 minutes old, it syncs before responding, so it feels
live without depending on cron frequency. A daily cron (`vercel.json`) is a
backup in case nobody opens the app.

**One thing to verify after your first deploy:** nflverse's team abbreviations
occasionally differ from ESPN's/ours for a couple of teams (e.g. some sources
use `LA` for the Rams, `WSH` for Washington). The sync code already maps known
aliases, but check `sync_log` (or the response from `POST /api/sync`) after
the first run - if it reports "Unmatched abbreviations," add them to
`ABBR_ALIASES` in `src/lib/sync.ts`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (any Postgres works, e.g. a free Neon/Supabase project)
npm run db:push              # creates tables from src/db/schema.ts
npm run db:seed              # seeds the 32 NFL teams
npm run dev
```

Then open `/admin` and enter this season's real draft picks (player, $ paid,
preseason O/U per team) - the standings and player pages are empty until you
do this.

To pull live scores/EPA manually instead of waiting for the on-demand sync:

```bash
npm run sync:now
```

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from
   `ghostcitydev/wins-draft-auction`).
2. In Vercel, "Add New Project" -> import the GitHub repo.
3. Add a Postgres database - easiest is Vercel's own Storage tab
   ("Neon Postgres"), which auto-populates `DATABASE_URL`/`DIRECT_URL` for you.
   Any other Postgres host works too - just set the env vars manually.
4. Set optional env vars if you want them (see `.env.example`):
   - `SYNC_SECRET` - protects the manual "sync now" button
   - `ADMIN_SECRET` - protects the `/admin` setup page
   - `CRON_SECRET` - required if you keep the `vercel.json` cron job
5. Deploy. Then run once against the production database (from your machine,
   with `DATABASE_URL` pointed at production):
   ```bash
   npm run db:push
   npm run db:seed
   ```
6. Open the deployed `/admin` page and enter the real 2026 draft results.

### About the cron job

Vercel's Hobby plan caps cron jobs at once per day, so `vercel.json` is set to
`0 9 * * *` (9am UTC daily). This is just a safety net - the app already
refreshes on-demand whenever someone opens it and the data is stale, which is
the main thing keeping it "live" during game days.

## Tech stack

- Next.js 16 (App Router, Turbopack)
- Drizzle ORM + `postgres` (works with any standard Postgres host - chosen
  over Prisma specifically because it has no native binary engine to fetch,
  which made it far more portable to build/test)
- Tailwind CSS v4
- No external UI kit - hand-built mobile-first components (bottom tab bar,
  horizontally-scrollable sticky-column table, installable PWA manifest)
