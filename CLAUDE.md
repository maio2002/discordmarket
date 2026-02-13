# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MaioBot is a German-language Discord bot built with discord.js v14 and MongoDB (Mongoose). It provides an economy system, XP ranking, job management, role marketplace, and P2P trading for Discord servers.

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Start with nodemon (auto-reload)
npm start                # Production start (node src/index.js)
npm run deploy           # Register slash commands with Discord API
docker-compose up -d     # Start MongoDB container (port 27017)
```

No test or lint tooling is configured.

## Architecture

**Entry point**: `src/index.js` — connects to MongoDB, loads handlers, logs into Discord.

**Handler pattern**: Commands, events, and cron jobs are dynamically loaded at startup:
- `src/handlers/commandHandler.js` — recursively loads all `.js` files from `src/commands/` subdirectories
- `src/handlers/eventHandler.js` — registers Discord.js event listeners from `src/events/`
- `src/handlers/cronHandler.js` — initializes cron jobs and the voice XP tick interval

**Service layer**: Business logic lives in `src/services/`, not in commands. Commands delegate to services for DB operations and calculations (`xpService`, `coinService`, `jobService`, `marketService`, `tradeService`, `approvalService`, `voiceTracker`).

**Models** (`src/models/`): 9 Mongoose schemas — all guild-scoped with compound indexes on `(guildId, userId)`.

**Command categories** (`src/commands/`):
- `admin/` — 13 commands (config, role management, moderation)
- `economy/` — 5 commands (coins, roles, prestige)
- `jobs/` — 2 commands (job assignment, speaker sessions)
- `trading/` — 4 commands (offers, marketplace)
- `xp/` — 3 commands (rank, leaderboard, info)

Each command module exports `{ data, execute }` where `data` is a `SlashCommandBuilder`.

## Key Configuration

- `src/config.js` — loads env vars (Discord token, client ID, guild ID, MongoDB URI, job role IDs)
- `src/constants.js` — all game balance values (XP rates, coin amounts, salaries, level formula)
- `.env` — secrets (see `.env.example` for template)

## Conventions

- **Language**: All user-facing text, command names, descriptions, and log messages are in German. Formatters use `de-DE` locale.
- **Command structure**: Each command is a separate file in a category subdirectory under `src/commands/`.
- **Embed factory**: Use `src/utils/embedBuilder.js` for consistent Discord embeds with predefined color constants.
- **Logging**: Winston logger (`src/utils/logger.js`) writes to console and `logs/` directory.
- **Voice tracking**: `voiceTracker` uses an in-memory `Map` for active sessions; DB is the source of truth for everything else.
- **Error handling**: Commands wrap execution in try-catch and reply with user-friendly German error messages. Global handlers in `index.js` catch unhandled rejections and uncaught exceptions.