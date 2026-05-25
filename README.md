# Custom Discord Bot (sexvoice)

A multi-server Discord bot built with **discord.js v14** (CommonJS). All features are configured per guild from inside Discord using slash commands and stored in SQLite.

## Features

- **Multi-server SQLite architecture** with per-guild configuration and 5‑minute cache
- **Slash + prefix commands** (aliases are prefix-only)
- **Moderation**: ban, kick, mute, unmute, warn, purge with permission + hierarchy checks
- **No‑prefix system**: owner + selected users can run prefix commands without `!`
- **Ticket system**: panel → reason modal → private channel with staff auto‑detection and HTML transcripts
- **Temp VC system**: hub + duo triggers, auto-delete when empty
- **Duo VC naming**: `𝄢・duo ¹`, `𝄢・duo ²` (gap-filling superscripts)
- **VC control panel**: 12 buttons, user select menus for trust/reject/kick/ban
- **Rich presence**: `/rpc` persists across restarts
- **Utility**: avatar/banner/userinfo support out-of-server lookups via `resolveUserGlobal`
- **Migration**: automatic one-time migration from legacy JSON to SQLite

## Commands

All commands work as **slash + prefix**. Aliases apply to prefix only.

| Command | Aliases (prefix only) | Notes |
|---------|------------------------|-------|
| ban | b, forceban, hackban | Ban members (ID allowed) |
| kick | k, boot, remove | Kick members |
| mute | m, timeout, silence, shut | Discord timeout |
| unmute | um, untimeout, unsilence | Remove timeout |
| warn | w, warning, caution | Warn members |
| purge | clear, clean, delete, prune | Bulk delete messages |
| noprefix | np, nopfx | Manage no‑prefix users |
| rpc | presence, activity, setstatus | Set bot presence |
| status | stats, botstats, info, botinfo | Bot stats |
| panel | ticketpanel, tp, sendpanel | Send ticket panel |
| av | avatar, pfp, icon, pic | Multi-format avatar |
| banner | userbanner, ub, profilebanner | Multi-format banner |
| sicon | servericon, srvicon | Server icon |
| sbanner | serverbanner, guildbanner, sb | Server banner |
| serverinfo | si, server, guildinfo, guild | Server stats |
| userinfo | ui, whois, user, lookup | User info |
| purgebots | clearbots, delbots, pb | Delete bot messages |
| purgeuser | clearuser, deluser, pu | Delete user messages |
| setup | configure, botsetup | Configure per‑guild systems |
| config | — | View current config |
| resetconfig | — | Reset config (confirmation) |

## Setup

### Requirements
- Node.js v18+ (v20+ recommended)
- A Discord bot application with **Server Members** and **Message Content** intents enabled

### Install
```bash
git clone https://github.com/Ramsingh4656/my-bot.git
cd my-bot
npm install
```

### .env
```env
TOKEN=your-bot-token
CLIENT_ID=your-app-id
GUILD_ID=your-test-guild-id
PREFIX=!
OWNER_ID=your-user-id
```

`GUILD_ID` is used only for `deploy-commands.js`.

### Register Slash Commands
```bash
node deploy-commands.js
```

## Configuration

All configuration is per-guild and stored in **SQLite** (`data/bot.db`). No restarts required after config changes.

### /setup (Administrator)
- `/setup tickets` → ticket category, log channel, transcript channel
- `/setup tempvc` → temp VC category, hub trigger voice channel
- `/setup duo` → duo trigger voice channel (must differ from hub)

### /config
Shows current configuration, warnings for deleted channels, and stats:
ticket count + no-prefix user count.

### /resetconfig
Resets all or part of the configuration with a confirmation button:
`all`, `tickets`, `tempvc`.

## Deployment (Oracle Cloud VPS + PM2)

```bash
pm2 start index.js --name my-bot
pm2 startup
pm2 save
```

After updates:
```bash
git pull
pm2 restart my-bot
```

After new slash commands:
```bash
node deploy-commands.js
```

## System Details

### Ticket System
- Panel button (`open_ticket`) opens a **reason modal**
- Ticket channels created under configured category
- Staff auto-detected by permissions (Manage Messages / Kick / Ban)
- Close button generates **HTML transcript** sent to transcript channel

### Temp VCs (Hub + Duo)
- Hub trigger → `{username}'s VC` (unlimited)
- Duo trigger → `𝄢・duo ¹`, `𝄢・duo ²` (limit 2, gap‑filling)
- Auto-deletes when empty (bots don’t count)

### VC Control Panel (12 Buttons)

Buttons:
`vc_rename`, `vc_limit`, `vc_lock`, `vc_unlock`, `vc_hide`, `vc_unhide`,
`vc_waiting`, `vc_trust`, `vc_reject`, `vc_delete`, `vc_kick`, `vc_ban`

User select menus:
`vc_trust_select`, `vc_reject_select`, `vc_kick_select`, `vc_ban_select`

### No‑Prefix System
- Owner always has no-prefix (via `OWNER_ID`)
- Admins can add/remove users with `/noprefix`

### Utility (Avatar/Banner/Userinfo)
- Supports users outside the server via `resolveUserGlobal`
- Multi-format buttons for avatar/banner (PNG/JPG/WEBP/GIF)

### Migration
On startup, legacy JSON files are migrated once:
`data/noprefix.json` → `noprefix_users`
`data/ticketCount.json` → `ticket_count`

## Configuration Files

- `data/bot.db` — SQLite database (auto-created)
- `data/presence.json` — saved presence (auto-created)
