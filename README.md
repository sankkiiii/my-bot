# My Bot — Discord Bot

A feature-rich Discord bot built with **Discord.js v14** and **Node.js**. Designed for a single private server with moderation, ticket system, temporary voice channels, no-prefix system, and comprehensive logging.

---

## Table of Contents

- [Features Overview](#features-overview)
- [All Commands](#all-commands)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Discord Setup (Do This First)](#discord-setup-do-this-first)
- [.env Configuration](#env-configuration)
- [Setup on Windows](#setup-on-windows)
- [Setup on VPS](#setup-on-vps-ubuntudebian--oracle-cloud-aws-digitalocean-etc)
- [PM2 Commands Reference](#pm2-commands-reference)
- [Updating the Bot](#updating-the-bot)
- [Feature Guide — Moderation](#feature-guide--moderation)
- [Feature Guide — No-Prefix System](#feature-guide--no-prefix-system)
- [Feature Guide — Ticket System](#feature-guide--ticket-system)
- [Feature Guide — Temporary Voice Channels](#feature-guide--temporary-voice-channels)
- [Feature Guide — Logging](#feature-guide--logging)
- [Persistence & Restarts](#persistence--restarts)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)

---

## Features Overview

| Feature | Description |
|---------|-------------|
| **Moderation** | Ban, kick, mute, unmute, warn, purge — with permission checks, hierarchy validation, and mod logging |
| **No-Prefix** | Selected users (+ bot owner) can run commands without the `!` prefix |
| **Ticket System** | TicketTool-style panels, private channels, staff auto-detection, HTML transcripts |
| **Temp Voice Channels** | Voice Master-style hub VCs (unlimited) + duo VCs (max 2) with auto-cleanup |
| **Logging** | Rich embed logs for moderation, joins/leaves, message edits/deletes, and tickets |

---

## All Commands

### Moderation Commands

| Command | Permission Required | Description |
|---------|-------------------|-------------|
| `/ban @user [reason]` or `!ban @user [reason]` | Ban Members | Ban a member. DMs them the reason before banning. |
| `/kick @user [reason]` or `!kick @user [reason]` | Kick Members | Kick a member. DMs them the reason before kicking. |
| `/mute @user [duration] [reason]` or `!mute @user [duration] [reason]` | Timeout Members | Timeout a member (max 28 days). Duration in minutes. |
| `/unmute @user [reason]` or `!unmute @user [reason]` | Timeout Members | Remove timeout from a member. |
| `/warn @user [reason]` or `!warn @user [reason]` | Timeout Members | Warn a member via DM. |
| `/purge [amount]` or `!purge [amount]` | Manage Messages | Bulk delete 1–100 messages in the current channel. |

### Ticket Commands

| Command | Permission Required | Description |
|---------|-------------------|-------------|
| `/panel` or `!panel` | Manage Channels | Send a ticket panel embed with "Open Ticket" button. |

### Admin Commands

| Command | Permission Required | Description |
|---------|-------------------|-------------|
| `/noprefix add @user` or `!noprefix add @user` | Administrator | Give a user no-prefix access. |
| `/noprefix remove @user` or `!noprefix remove @user` | Administrator | Remove no-prefix access from a user. |
| `/noprefix list` or `!noprefix list` | Administrator | List all no-prefix users. |

> **All commands work as both slash commands (`/command`) and prefix commands (`!command`).**

---

## Project Structure

```
my-bot/
├── .env                      # Environment variables (secrets + IDs)
├── .gitignore
├── config.js                 # Loads .env into a config object
├── index.js                  # Entry point — creates client, loads handlers, logs in
├── deploy-commands.js        # Registers slash commands to your guild
├── package.json
├── handlers/
│   ├── commandHandler.js     # Auto-loads all commands from commands/ subfolders
│   └── eventHandler.js       # Auto-loads all events from events/
├── commands/
│   ├── mod/
│   │   ├── ban.js
│   │   ├── kick.js
│   │   ├── mute.js
│   │   ├── unmute.js
│   │   ├── warn.js
│   │   ├── purge.js
│   │   └── noprefix.js       # No-prefix management command
│   └── tickets/
│       └── panel.js
├── events/
│   ├── ready.js              # Bot status + startup cleanup
│   ├── messageCreate.js      # Prefix/no-prefix commands + message logging
│   ├── interactionCreate.js  # Slash commands + ticket button interactions
│   ├── voiceStateUpdate.js   # Hub VC + Duo VC create/delete
│   └── guildMemberAdd.js     # Join/leave logging
├── utils/
│   ├── logger.js             # sendLog() helper
│   └── transcript.js         # HTML transcript generator
└── data/
    ├── ticketCount.json      # Persistent ticket counter (auto-created)
    └── noprefix.json         # No-prefix user list (auto-created)
```

---

## Prerequisites

- **Node.js** v16.11.0 or higher (v18+ recommended) — [Download](https://nodejs.org/)
- A **Discord Bot Application** — [Developer Portal](https://discord.com/developers/applications)

---

## Discord Setup (Do This First)

### 1. Create a Bot Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it → click **Create**
3. Go to the **Bot** tab
4. Click **Reset Token** → copy and save the **Token** (you'll need this for `.env`)
5. Copy the **Application ID** from the General Information tab (this is your `CLIENT_ID`)
6. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**

### 2. Invite the Bot to Your Server

Replace `YOUR_CLIENT_ID` with your Application ID and open this URL:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Select your server and authorize.

### 3. Enable Developer Mode in Discord

Go to **User Settings → App Settings → Advanced → Developer Mode → ON**

This lets you right-click channels, roles, categories, and users to **Copy ID**.

### 4. Get Your Owner ID

Right-click your own username in Discord → **Copy User ID**. This goes into `OWNER_ID` in `.env`.

### 5. Create Channels and Categories

Create the following in your Discord server and copy their IDs:

| What to Create | Type | .env Variable |
|----------------|------|---------------|
| `#mod-log` | Text Channel | `MOD_LOG_CHANNEL` |
| `#join-log` | Text Channel | `JOIN_LOG_CHANNEL` |
| `#message-log` | Text Channel | `MESSAGE_LOG_CHANNEL` |
| `#ticket-log` | Text Channel | `TICKET_LOG_CHANNEL` |
| `#transcripts` | Text Channel | `TRANSCRIPT_CHANNEL` |
| Tickets (category) | Category | `TICKET_CATEGORY` |
| Temp VCs (category) | Category | `TEMP_VC_CATEGORY` |
| ➕ Create VC | Voice Channel (inside Temp VCs category) | `CREATE_VC_CHANNEL` |
| ➕ Create Duo | Voice Channel (inside Temp VCs category) | `CREATE_DUO_CHANNEL` |

Also copy your **Server ID** (right-click server name → Copy Server ID) → `GUILD_ID`

> **No staff role needed!** The bot automatically detects staff by checking Discord permissions (Manage Messages, Kick Members, or Ban Members). Any role with these permissions will see tickets and can close them.

---

## .env Configuration

```env
TOKEN=your-bot-token-here
CLIENT_ID=your-application-id
GUILD_ID=your-server-id
PREFIX=!
MOD_LOG_CHANNEL=channel-id
JOIN_LOG_CHANNEL=channel-id
MESSAGE_LOG_CHANNEL=channel-id
TICKET_LOG_CHANNEL=channel-id
TRANSCRIPT_CHANNEL=channel-id
TICKET_CATEGORY=category-id
TEMP_VC_CATEGORY=category-id
CREATE_VC_CHANNEL=voice-channel-id
CREATE_DUO_CHANNEL=voice-channel-id
OWNER_ID=your-discord-user-id
```

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKEN` | Yes | Your bot token from the Developer Portal |
| `CLIENT_ID` | Yes | Your bot's Application ID |
| `GUILD_ID` | Yes | Your Discord server ID |
| `PREFIX` | No | Command prefix (default: `!`) |
| `MOD_LOG_CHANNEL` | Yes | Channel ID for moderation logs |
| `JOIN_LOG_CHANNEL` | Yes | Channel ID for join/leave logs |
| `MESSAGE_LOG_CHANNEL` | Yes | Channel ID for message edit/delete logs |
| `TICKET_LOG_CHANNEL` | Yes | Channel ID for ticket open/close logs |
| `TRANSCRIPT_CHANNEL` | Yes | Channel ID where ticket transcripts are sent |
| `TICKET_CATEGORY` | Yes | Category ID for ticket channels |
| `TEMP_VC_CATEGORY` | Yes | Category ID for temporary voice channels |
| `CREATE_VC_CHANNEL` | Yes | Voice channel ID that triggers hub VC creation (unlimited users) |
| `CREATE_DUO_CHANNEL` | No | Voice channel ID that triggers duo VC creation (max 2 users) |
| `OWNER_ID` | No | Your Discord user ID (gives permanent no-prefix access) |

---

## Setup on Windows

### Step 1 — Install Node.js

1. Download the **LTS** version from https://nodejs.org/
2. Run the installer (check **"Add to PATH"** during installation)
3. Open **Command Prompt** or **PowerShell** and verify:

```cmd
node -v
npm -v
```

### Step 2 — Clone the Repository

```cmd
git clone https://github.com/Ramsingh4656/my-bot.git
cd my-bot
```

### Step 3 — Install Dependencies

```cmd
npm install
```

### Step 4 — Configure the Bot

Open `.env` in a text editor (Notepad, VS Code, etc.) and fill in all the values from the [.env Configuration](#env-configuration) section.

### Step 5 — Register Slash Commands

Run this **once** (or whenever you add/change slash commands):

```cmd
node deploy-commands.js
```

You should see:

```
[Deploy] Queued: ban
[Deploy] Queued: kick
[Deploy] Queued: mute
[Deploy] Queued: unmute
[Deploy] Queued: warn
[Deploy] Queued: purge
[Deploy] Queued: panel
[Deploy] Queued: noprefix
[Deploy] Registering 8 slash command(s) to guild ...
[Deploy] Successfully registered all slash commands.
```

### Step 6 — Start the Bot

```cmd
node index.js
```

You should see:

```
[Commands] Loaded: ban
[Commands] Loaded: kick
[Commands] Loaded: mute
[Commands] Loaded: unmute
[Commands] Loaded: warn
[Commands] Loaded: purge
[Commands] Loaded: noprefix
[Commands] Loaded: panel
[Events] Loaded: ready
[Events] Loaded: messageCreate
[Events] Loaded: interactionCreate
[Events] Loaded: voiceStateUpdate
[Events] Loaded: guildMemberAdd
[Ready] Logged in as YourBot#1234
[Ready] Ticket counter loaded: 0
[Ready] No-prefix users loaded: 0
[Ready] No leftover temp VCs to clean up
```

### Running in Background on Windows (Optional)

```cmd
npm install -g pm2
pm2 start index.js --name my-bot
pm2 save
```

---

## Setup on VPS (Ubuntu/Debian — Oracle Cloud, AWS, DigitalOcean, etc.)

### Step 1 — Connect to Your VPS

```bash
ssh username@your-vps-ip
```

### Step 2 — Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:

```bash
node -v
npm -v
```

### Step 3 — Install Git (if not already installed)

```bash
sudo apt-get install -y git
```

### Step 4 — Clone the Repository

```bash
git clone https://github.com/Ramsingh4656/my-bot.git
cd my-bot
```

### Step 5 — Install Dependencies

```bash
npm install
```

### Step 6 — Configure the Bot

```bash
nano .env
```

Fill in all the values from the [.env Configuration](#env-configuration) section. Save with `Ctrl+O`, exit with `Ctrl+X`.

### Step 7 — Register Slash Commands

```bash
node deploy-commands.js
```

### Step 8 — Test the Bot

```bash
node index.js
```

If everything works, stop it with `Ctrl+C` and proceed to run it with PM2.

### Step 9 — Run with PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the bot
pm2 start index.js --name my-bot

# Auto-restart on server reboot
pm2 startup
# (Run the command it outputs, e.g.: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu)

# Save the current process list
pm2 save
```

---

## PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 logs my-bot` | View bot logs (live) |
| `pm2 logs my-bot --lines 100` | View last 100 log lines |
| `pm2 restart my-bot` | Restart the bot |
| `pm2 stop my-bot` | Stop the bot |
| `pm2 delete my-bot` | Remove from PM2 |
| `pm2 status` | Show all running processes |
| `pm2 monit` | Interactive monitoring dashboard |

---

## Updating the Bot

### On Windows

```cmd
cd my-bot
git pull
npm install
node deploy-commands.js
```

Then restart the bot (or `pm2 restart my-bot` if using PM2).

### On VPS

```bash
cd my-bot
git pull
npm install
node deploy-commands.js
pm2 restart my-bot
```

---

## Feature Guide — Moderation

### Permission System

Every moderation command checks **three things** before executing:

1. **User permission** — Does the person running the command have the required Discord permission?
2. **Bot permission** — Does the bot have the required permission to perform the action?
3. **Role hierarchy** — Is the target user's highest role lower than both the moderator's and the bot's highest role?

| Command | User Needs | Bot Needs | Hierarchy Check |
|---------|-----------|-----------|----------------|
| ban | Ban Members | Ban Members | Yes |
| kick | Kick Members | Kick Members | Yes |
| mute | Timeout Members | Timeout Members | Yes |
| unmute | Timeout Members | Timeout Members | No |
| warn | Timeout Members | — (just DMs) | No |
| purge | Manage Messages | Manage Messages | No |

### What Each Command Does

**Ban** — `/ban @user [reason]` or `!ban @user [reason]`
- DMs the user the ban reason before banning
- Permanently bans the user from the server
- Logs to `#mod-log` with moderator, target, and reason

**Kick** — `/kick @user [reason]` or `!kick @user [reason]`
- DMs the user the kick reason before kicking
- Removes the user from the server (they can rejoin with an invite)
- Logs to `#mod-log`

**Mute (Timeout)** — `/mute @user [minutes] [reason]` or `!mute @user [minutes] [reason]`
- Uses Discord's native timeout feature (not a mute role)
- Duration in minutes, maximum 40320 minutes (28 days — Discord limit)
- User cannot send messages, react, or join voice while timed out
- Logs to `#mod-log` with duration

**Unmute** — `/unmute @user [reason]` or `!unmute @user [reason]`
- Removes timeout from a user
- Logs to `#mod-log`

**Warn** — `/warn @user [reason]` or `!warn @user [reason]`
- Sends a DM to the user with the warning reason
- No server action taken (informational only)
- Logs to `#mod-log`

**Purge** — `/purge [amount]` or `!purge [amount]`
- Deletes 1–100 messages in the current channel
- Only works on messages less than 14 days old (Discord API limit)
- Logs to `#mod-log` with message count and channel

### Slash Command Visibility

Discord automatically hides slash commands from users who don't have the required permission. For example, a user without Ban Members permission won't even see `/ban` in the command menu.

### Error Messages

| Situation | Error Message |
|-----------|--------------|
| User lacks permission | "You need the **[Permission]** permission to use this command." |
| Bot lacks permission | "I don't have the **[Permission]** permission to do this." |
| Target outranks moderator | "You cannot moderate someone with an equal or higher role than you." |
| Target outranks bot | "I cannot moderate this user as their role is higher than or equal to mine." |

All error messages for slash commands are **ephemeral** (only visible to the person who ran the command).

---

## Feature Guide — No-Prefix System

### What Is No-Prefix?

Normally, prefix commands require `!` before the command name (e.g., `!ban @user`). The no-prefix system lets selected users skip the prefix entirely — just type `ban @user` and it works.

### Who Gets No-Prefix?

| User | How They Get It | Stored Where |
|------|----------------|--------------|
| Bot owner | Automatic — set `OWNER_ID` in `.env` | Hardcoded in config |
| Other users | Admin runs `/noprefix add @user` | `data/noprefix.json` |

### How to Set Up

1. **Set your owner ID** — Add `OWNER_ID=your_discord_user_id` to `.env`
2. **Restart the bot** — The owner now has permanent no-prefix access
3. **Add other users** — Run `/noprefix add @user` or `!noprefix add @user`

### Commands

| Command | What It Does |
|---------|-------------|
| `/noprefix add @user` | Give a user no-prefix access |
| `/noprefix remove @user` | Remove no-prefix access from a user |
| `/noprefix list` | Show all users with no-prefix access |

> Requires **Administrator** permission to use.

### How It Works Internally

```
User sends a message
        ↓
Is it from a bot? → Ignore
        ↓
Is it in a DM? → Ignore
        ↓
Does it start with the prefix (!)? → Normal prefix command flow
        ↓
Is the author the bot owner OR in the no-prefix list?
  → Yes: Treat the first word as a command name
  → No: Ignore the message
        ↓
Does the command name match a registered command?
  → Yes: Execute it (all permission checks still apply)
  → No: Silently ignore (won't respond to random messages)
```

### Important Notes

- **No-prefix only skips the prefix** — all permission checks still apply. A no-prefix user without Ban Members permission still can't use `ban`.
- **Changes take effect instantly** — the no-prefix list is read from disk on every message, so `/noprefix add` works immediately without restarting.
- **The owner cannot be added/removed via commands** — their access is hardcoded via `OWNER_ID` in `.env`.
- **Bots cannot be added** — the command blocks adding bot users.
- **If `OWNER_ID` is not set** — the bot logs a warning on startup and owner no-prefix is disabled.
- **If a no-prefix user types something that isn't a command** (e.g., just "hello") — the bot silently ignores it.

### Examples

```
Without no-prefix:          With no-prefix:
!ban @user spamming    →    ban @user spamming
!kick @user toxic      →    kick @user toxic
!mute @user 60 reason  →    mute @user 60 reason
!purge 50              →    purge 50
!warn @user language   →    warn @user language
!panel                 →    panel
!noprefix list         →    noprefix list
```

---

## Feature Guide — Ticket System

The ticket system works like **TicketTool.xyz** — a persistent panel with a button, private ticket channels, auto staff detection, and professional HTML transcripts.

### How to Set Up

1. **Create a Category** for tickets (e.g., `Tickets`)
2. **Right-click the category** → Copy ID → paste as `TICKET_CATEGORY` in `.env`
3. **Create `#transcripts`** text channel → Copy ID → paste as `TRANSCRIPT_CHANNEL`
4. **Create `#ticket-log`** text channel → Copy ID → paste as `TICKET_LOG_CHANNEL`
5. **Start the bot**, then run `/panel` or `!panel` in the channel where you want the ticket panel

> **No staff role needed!** Any role with **Manage Messages**, **Kick Members**, or **Ban Members** permission will automatically see tickets and can close them.

### How It Works (Full Flow)

```
Staff runs /panel in #support
        ↓
Bot sends a beautiful embed with "📩 Open Ticket" button
        ↓
User clicks the button
        ↓
Bot checks for duplicate tickets (one per user)
        ↓
Bot creates #ticket-username (private channel)
  → Only the user + roles with mod permissions + Bot can see it
  → Channel topic stores opener's user ID for tracking
  → Ticket gets a sequential number (#1, #2, #3...)
        ↓
Bot sends welcome embed with "🔒 Close Ticket" button
        ↓
User describes their issue, staff responds
        ↓
Staff clicks "🔒 Close Ticket"
        ↓
Bot fetches ALL messages from the channel (paginated)
        ↓
Bot generates a professional HTML transcript
        ↓
Bot sends transcript file to #transcripts with details embed
        ↓
Bot logs the closure to #ticket-log
        ↓
Bot deletes the ticket channel after 5 seconds
```

### Panel Embed

The panel sent by `/panel` includes:
- Title: "📋 Support Tickets"
- Description: "Need help? Click the button below to open a support ticket."
- Color: Discord Blurple (#5865F2)
- Server icon as thumbnail
- Server name + bot tag in footer
- A "📩 Open Ticket" button that **never expires** (works forever, even after restarts)

### Ticket Channel Permissions

| Who | Permissions |
|-----|------------|
| @everyone | Cannot see the channel |
| Ticket opener | View, Send Messages, Read History, Attach Files |
| Any role with Manage Messages / Kick / Ban | View, Send Messages, Read History, Manage Messages, Attach Files |
| Bot | View, Send Messages, Read History, Manage Messages, Manage Channels |

> The bot automatically scans all server roles on ticket creation and gives access to any role that has **Manage Messages**, **Kick Members**, or **Ban Members** permission.

### Ticket Numbering

- Each ticket gets a sequential number (#1, #2, #3...)
- Stored in `data/ticketCount.json` — persists across restarts
- Never resets (unless you manually edit the file)
- Shown in the welcome embed inside the ticket

### Who Can Close Tickets

- Any member with **Manage Messages**, **Kick Members**, or **Ban Members** permission
- If someone without these permissions clicks the close button:
  > "You need **Manage Messages**, **Kick Members**, or **Ban Members** permission to close tickets."

### Duplicate Ticket Prevention

If a user tries to open a ticket while they already have one open:
> "You already have an open ticket: #ticket-username"

### HTML Transcript

When a ticket is closed, the bot generates a **self-contained HTML file** styled like TicketTool.xyz transcripts:

- **Dark Discord-like theme** (#36393f background, #2f3136 message area)
- **Server icon and name** in header
- **Ticket info**: name, opened by, closed by, date opened, date closed, total messages
- **Message display**: circular avatar (40px), role-colored username, timestamp (DD/MM/YYYY HH:MM)
- **Bot messages**: subtle different background (#2a2d31) + blue "BOT" badge
- **Embeds**: colored left-border blocks with title, description, and fields
- **Attachments**: 📎 icon with clickable filename
- **URLs**: auto-linked
- **Avatar fallback**: SVG placeholder if Discord CDN fails
- **Footer**: bot name and generation timestamp
- **Fully self-contained**: inline CSS, no external dependencies, works offline

---

## Feature Guide — Temporary Voice Channels

The bot has **two types** of temporary voice channels:

| Type | Trigger Channel | Channel Name | User Limit | Use Case |
|------|----------------|--------------|------------|----------|
| **Hub VC** | `➕ Create VC` | `username's VC` | Unlimited | Group calls, gaming, hangouts |
| **Duo VC** | `➕ Create Duo` | `𝄢・duo ¹`, `𝄢・duo ²`, etc. | 2 | Private 1-on-1 conversations |

Both work like **Voice Master** — join a trigger channel, get your own VC, and it auto-deletes when empty.

### How to Set Up

1. **Create a Category** in your Discord server (e.g., `Voice Channels` or `Temp VCs`)
2. **Right-click the category** → Copy ID → paste as `TEMP_VC_CATEGORY` in `.env`
3. **Create a Voice Channel** inside that category named `➕ Create VC`
4. **Right-click** → Copy ID → paste as `CREATE_VC_CHANNEL` in `.env`
5. **Create another Voice Channel** in the same category named `➕ Create Duo`
6. **Right-click** → Copy ID → paste as `CREATE_DUO_CHANNEL` in `.env`
7. **Restart the bot**

Your category should look like:
```
📁 Temp VCs (category)
  🔊 ➕ Create VC        ← hub trigger (unlimited)
  🔊 ➕ Create Duo       ← duo trigger (max 2)
  🔊 Ram's VC            ← auto created (hub)
  🔊 𝄢・duo ¹           ← auto created (duo)
  🔊 𝄢・duo ²           ← auto created (duo)
```

### Hub VC — How It Works

```
User joins "➕ Create VC"
        ↓
Bot creates "username's VC" (no user limit)
        ↓
Bot moves the user into their new VC
        ↓
User owns the channel (rename, set limit, move users)
        ↓
When everyone leaves → Bot auto-deletes the channel
```

### Duo VC — How It Works

```
User joins "➕ Create Duo"
        ↓
Bot finds the lowest available number (fills gaps)
        ↓
Bot creates "𝄢・duo ¹" with user limit of 2
        ↓
Bot moves the user into their duo VC
        ↓
Only 1 more person can join (enforced by Discord)
        ↓
When both leave → Bot auto-deletes the channel
```

### Duo VC Naming

Duo VCs use sequential superscript numbers with gap filling:

```
𝄢・duo ¹
𝄢・duo ²
𝄢・duo ³
...
𝄢・duo ¹⁰
𝄢・duo ¹¹
```

**Gap filling**: If `𝄢・duo ¹` and `𝄢・duo ³` exist but `𝄢・duo ²` was deleted, the next duo VC will be `𝄢・duo ²` (fills the gap instead of going to `𝄢・duo ⁴`).

### What the VC Creator Can Do

The bot grants `ManageChannels` and `MoveMembers` permissions on both hub and duo VCs:

| Action | How |
|--------|-----|
| **Rename** their VC | Right-click channel → Edit Channel → change name |
| **Set user limit** | Right-click channel → Edit Channel → set User Limit |
| **Move users** in/out | Drag and drop users into or out of the channel |
| **Disconnect users** | Right-click a user → Disconnect |
| **Set bitrate** | Edit Channel → change bitrate for audio quality |

### Edge Cases Handled

| Scenario | What Happens |
|----------|-------------|
| User joins "Create VC" | New hub VC created (unlimited), user moved in |
| User joins "Create Duo" | New duo VC created (limit 2), user moved in |
| User leaves any temp VC | If VC is now empty, it's deleted (both types) |
| User moves from temp VC to another channel | If old VC is now empty, it's deleted |
| User creates VC/duo then immediately disconnects | Empty channel detected and deleted |
| Bot fails to move the user | The empty VC is cleaned up automatically |
| Multiple users join trigger channels at once | Each gets their own VC — no conflicts |
| Duo VC is full (2 users) | Discord enforces the limit automatically |
| Bot restarts while temp VCs exist | On startup, bot scans the category and deletes any empty VCs |
| `CREATE_VC_CHANNEL` not set | Hub VC feature skipped |
| `CREATE_DUO_CHANNEL` not set | Duo VC feature skipped |
| Both trigger channels are always protected | Bot never deletes the trigger channels themselves |

### Startup Cleanup

When the bot starts (or restarts), it automatically:
1. Scans all voice channels inside `TEMP_VC_CATEGORY`
2. Finds any that are **empty** and are **not** `CREATE_VC_CHANNEL` or `CREATE_DUO_CHANNEL`
3. Deletes them
4. Logs how many were cleaned up

This prevents leftover temp VCs from piling up after crashes or restarts.

---

## Feature Guide — Logging

All logs are sent as rich Discord embeds with timestamps and relevant details.

### Mod Log (`#mod-log`)

Triggered by all moderation commands. Each log includes:
- **Action** (Ban, Kick, Mute, Unmute, Warn, Purge)
- **Target user** (tag + ID)
- **Moderator** (who ran the command)
- **Reason** (if provided)
- **Duration** (for mute)
- **Message count** (for purge)
- **Timestamp**

### Join/Leave Log (`#join-log`)

**Member joined:**
- Username and tag
- Account creation date (account age)
- Current member count

**Member left:**
- Username and tag
- Roles they had
- How long they were in the server

### Message Log (`#message-log`)

**Message deleted:**
- Author (tag + ID)
- Channel
- Content (or "Unknown" if the message was not cached)

**Message edited:**
- Author (tag + ID)
- Channel
- Before content
- After content

> Bot messages are ignored for both deleted and edited logs.

### Ticket Log (`#ticket-log`)

**Ticket opened:**
- Who opened it (tag + ID)
- Channel name and link
- Ticket number

**Ticket closed:**
- Who closed it (tag + ID)
- Channel name
- Who originally opened it
- Total message count

---

## Persistence & Restarts

The bot is designed to survive restarts cleanly:

| What | How It Persists |
|------|----------------|
| Ticket panel button | Uses static `customId: "open_ticket"` — works forever without re-sending |
| Ticket counter | Saved to `data/ticketCount.json` on every ticket creation |
| Ticket opener info | Stored in channel topic as `Opened by: {userId}` |
| No-prefix user list | Saved to `data/noprefix.json` on every add/remove |
| Owner no-prefix | Hardcoded via `OWNER_ID` in `.env` |
| `data/` folder | Auto-created on bot startup if it doesn't exist |
| Temp VC cleanup | On startup, bot deletes empty leftover VCs in the category |

### Console Output on Startup

```
[Commands] Loaded: ban
[Commands] Loaded: kick
[Commands] Loaded: mute
[Commands] Loaded: unmute
[Commands] Loaded: warn
[Commands] Loaded: purge
[Commands] Loaded: noprefix
[Commands] Loaded: panel
[Events] Loaded: ready
[Events] Loaded: messageCreate
[Events] Loaded: interactionCreate
[Events] Loaded: voiceStateUpdate
[Events] Loaded: guildMemberAdd
[Ready] Logged in as YourBot#1234
[Ready] Ticket counter loaded: 15
[Ready] No-prefix users loaded: 3
[Ready] No leftover temp VCs to clean up
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Error: TOKEN is not provided` | Make sure `.env` is filled in and in the project root |
| Slash commands not showing up | Run `node deploy-commands.js`. Commands may take a few minutes to appear |
| `Missing Permissions` errors | Make sure the bot role is **above** the target user's highest role in Server Settings → Roles |
| `Missing Access` on channels | Verify the bot has permissions to view and send messages in the log channels |
| Message content logging shows "Unknown" | Enable **Message Content Intent** in the Developer Portal |
| Member join/leave not logging | Enable **Server Members Intent** in the Developer Portal |
| `DiscordAPIError: Unknown Channel` | Double-check all channel/category IDs in `.env` |
| Bot goes offline on VPS | Use PM2 with `pm2 startup` and `pm2 save` for auto-restart |
| Temp VC not created when joining | Verify `CREATE_VC_CHANNEL` ID matches exactly; bot needs Manage Channels permission |
| Ticket panel button stopped working | Run `/panel` again to send a new panel |
| Ticket counter reset to 0 | Check that `data/ticketCount.json` exists and isn't deleted on deploy |
| Transcript file is empty | Make sure the bot has Read Message History permission in ticket channels |
| No-prefix not working | Check `OWNER_ID` is set correctly; for other users verify with `/noprefix list` |
| No-prefix user can't run a command | No-prefix only skips the `!` — permission checks still apply |
| `/noprefix` command not showing | Run `node deploy-commands.js` to register the new slash command |

---

## Tech Stack

- **Runtime:** Node.js
- **Library:** discord.js v14
- **Config:** dotenv
- **Process Manager:** PM2
- **Language:** JavaScript (CommonJS)
- **Data Storage:** JSON files (`data/` directory)

---

## License

This project is for personal/private server use.
