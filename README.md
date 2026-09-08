# 2026 NFL Wins Draft

A mobile-first live standings tracker for an 8-person NFL "wins draft" auction
pool (32 teams, $50/player, 4 teams each). Built with Next.js (App Router),
Drizzle ORM + Postgres, deployed on Vercel.

## What it shows

**Standings** (`/`) - the 8 drafters, each with their 4 teams and running
totals (wins, losses, cumulative preseason O/U, $ paid, value), with a
per-player breakdown of their individual teams.

**Teams** (`/teams`) - all 32 NFL teams in one sortable table: record, win %,
preseason O/U, $ paid, computed auction value, point differential, projected
wins, Pythagorean wins, and EPA/play - with a tap-through to each team's full
schedule.

**Team detail** (`/teams/[abbr]`) - full past and future schedule, all core
stats for one team.

**Archive** (`/archive`) - past seasons' final standings PDFs.

**Bets** (`/bets`) - personal spread-betting tracker: log a bet (team, spread,
juice, units), add the closing line once it's posted, and see performance
over time (record, units, closing-line value, a cumulative-units chart).

**Setup** (`/admin`) - where the commissioner enters each season's real draft
results (which player has which team, $ paid, preseason O/U line), and pastes
in nfelo's weekly power ratings (see below).

## Where every number comes from

This matters, so it's spelled out rather than left implicit:

| Field | Source | Notes |
|---|---|---|
| Team master data (name, division, logo) | Hardcoded, `prisma/seed-data/teams-master.json` | Static NFL facts, seeded once. Logos are the user's own local files (`public/logos/*.png`), including intentionally retro ones (old Redskins, old Oakland Raiders), not ESPN's modern CDN |
| Player, $ paid, preseason O/U | Seeded from the 2026 Auction tab (`prisma/seed-data/draft-picks-2026.json`); editable any time via `/admin` | Real auction results, not placeholders. Preseason O/U shown per-player in Standings is a **sum** across their 4 teams, not an average |
| Wins / losses / ties / schedule / scores | [ESPN's public scoreboard API](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard) | Refreshed live. Always the real current season - never backfilled with placeholder data, so every team correctly shows 0-0 until it's actually played a game |
| Win %, Diff, Projected, Value/VOR | Computed in `src/lib/calculations.ts` | Projected/Value/VOR formulas are reverse-engineered **exactly** from the original commissioner spreadsheet's live formulas (verified against all 32 rows). Diff and Value both correctly show `0` (not a misleading negative) before anyone in the league has a win yet |
| Pythagorean wins, EPA/play | Pasted weekly from [nfeloapp.com's power ratings page](https://www.nfeloapp.com/nfl-power-ratings/) via `/admin`, stored in the `team_ratings` table | nfelo has no public API, so - same as the original spreadsheet's workflow - the commissioner copies the power ratings table from nfelo.com and pastes it into `/admin` each week (`src/lib/nfelo-parser.ts` parses it, `POST /api/admin/team-ratings` upserts it). **Before the current season has a ratings snapshot logged**, these two columns fall back to the most recent snapshot from the prior season as a clearly-marked placeholder (italic + `*` in the app, with a tooltip) - never presented as this season's real data. The app ships seeded with final 2025-season nfelo ratings (`prisma/seed-data/team-ratings-2025.json`) as that placeholder |

The app refreshes ESPN schedule/score data on-demand: any time someone opens
the app and the data is >15 minutes old, it syncs before responding, so it
feels live without depending on cron frequency. A daily cron (`vercel.json`)
is a backup in case nobody opens the app. nfelo ratings are **not** part of
this auto-sync - they only update when the commissioner pastes a new week in
via `/admin`, since there's no API to pull them from automatically.

**One thing to verify after your first deploy:** ESPN's and nfelo's team
abbreviations occasionally differ from ours for a few teams (e.g. `LA` for the
Rams, `WSH` for Washington, `OAK` for the Raiders). Both the schedule sync and
the nfelo paste parser map known aliases via `ABBR_ALIASES` in
`src/lib/team-aliases.ts` - if `/admin`'s ratings paste reports "Unmatched
team abbreviations," add the missing one there.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (any Postgres works, e.g. a free Neon/Supabase project)
npm run db:push              # creates tables from src/db/schema.ts
npm run db:seed              # seeds the 32 NFL teams, 2026 draft picks, and 2025 nfelo ratings (placeholder)
npm run dev
```

On Windows, once your `.env.local` is set up, you can double-click **`db-update.bat`**
(in the project root) any time a schema change needs `db:push` + `db:seed` run
again, instead of typing both commands out.

Then open `/admin` and enter this season's real draft picks (player, $ paid,
preseason O/U per team) - the standings and team pages are empty until you do
this. Once the 2026 season is underway, paste each week's nfelo power ratings
into the same page to keep EPA/Pythagorean current.

To pull live scores manually instead of waiting for the on-demand sync:

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
