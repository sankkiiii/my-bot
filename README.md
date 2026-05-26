# 🤖 Discord Bot

> A feature-rich Discord bot with moderation, tickets, temp VCs, and logging.

## ✨ Features
- Moderation system
- Ticket system
- Temp Voice Channels
- VC Control Panel
- AFK system
- Utility commands
- Multi-server SQLite architecture
- Per-guild configuration
- Custom emoji support
- Multi-owner Bot management
- Rich Presence control

---

## 📋 Commands

All commands work as both Slash Commands (`/`) and Prefix Commands (default `!`). Aliases are for Prefix usage only.

### 🛡️ Moderation

| Command | Aliases | Description | Permission |
| :--- | :--- | :--- | :--- |
| `/ban` | `forceban`, `hackban` | Ban a member from the server | `Ban Members` |
| `/kick` | `remove` | Kick a member from the server | `Kick Members` |
| `/mute` | `timeout` | Timeout (mute) a member | `Moderate Members` |
| `/unmute` | `untimeout`, `unsilence` | Remove timeout (unmute) from a member | `Moderate Members` |
| `/warn` | `warning` | Warn a member | `Moderate Members` |
| `/purge` | `clear`, `clean`, `prune` | Bulk delete messages in this channel | `Manage Messages` |
| `/nick` | `nickname`, `setnick`, `changenick` | Change a nickname | `Manage Nicknames`* |
| `/drag` | `pull`, `move`, `summon` | Drag a user to a voice channel | `Move Members` |
| `/vckick` | `vcremove`, `disconnectuser`, `dvc`, `forcedc` | Disconnect a user from a voice channel | `Move Members` |
| `/vckickall` | `vcpurge`, `kickall`, `emptyvc`, `clearvc` | Disconnect everyone from a voice channel | `Move Members` |
| `/dump` | `rolememebers`, `rmembers`, `rolelist`, `rd` | Show all members with a specific role | `Manage Roles` |

*(Note: Users with `Change Nickname` can change their own nickname without `Manage Nicknames`)*

### ⚙️ Configuration

| Command | Aliases | Description | Permission |
| :--- | :--- | :--- | :--- |
| `/setup` | `configure`, `botsetup` | Configure the bot for this server | `Administrator` |
| `/config` | *(None)* | View current bot configuration | `Administrator` |
| `/resetconfig` | *(None)* | Reset configuration for this server | `Administrator` |
| `/noprefix` | `np` | Manage no-prefix users | `Bot Owner` |
| `/owner` | `addowner`, `botowner`, `owners` | Manage bot owners | `Bot Owner` |
| `/rpc` | `presence`, `activity` | Change the bot rich presence | `Administrator` |
| `/status` | `stats`, `botinfo`, `info` | Show the bot current stats and health | `Administrator` |

### 🎫 Tickets

| Command | Aliases | Description | Permission |
| :--- | :--- | :--- | :--- |
| `/panel` | *(None)* | Send a ticket panel embed with an Open Ticket button | `Manage Channels` |

### 🔧 Utility

| Command | Aliases | Description | Permission |
| :--- | :--- | :--- | :--- |
| `/av` | `avatar`, `pfp`, `icon` | Show a user's avatar | `@everyone` |
| `/banner` | `userbanner`, `profilebanner` | Show a user's profile banner | `@everyone` |
| `/sicon` | `servericon`, `guildicon` | Show the server icon | `@everyone` |
| `/sbanner` | `serverbanner`, `guildbanner` | Show the server banner | `@everyone` |
| `/serverinfo` | `si`, `server`, `guildinfo`, `guild` | Show server information | `@everyone` |
| `/userinfo` | `ui`, `whois`, `user`, `lookup` | Show user information | `@everyone` |
| `/purgebots` | `cleanbots`, `deletebots`, `pb` | Purge last X bot messages from this channel | `Manage Messages` |
| `/purgeuser` | `cleanuser`, `deleteuser`, `pu` | Purge last X messages from a specific user | `Manage Messages` |
| `/afk` | `away`, `brb` | Set your AFK status | `@everyone` |

---

## 🚀 Setup Guide

### Prerequisites
- Node.js v16 or higher
- A Discord bot token
- Git

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/Ramsingh4656/my-bot.git
   cd my-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create .env file**
   Create a `.env` file in the root directory and add the following:
   ```env
   TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   GUILD_ID=your_guild_id
   PREFIX=!
   OWNER_ID=your_discord_id
   ```

4. **Register slash commands**
   ```bash
   node deploy-commands.js
   ```

5. **Start the bot**
   ```bash
   node index.js
   ```

6. **Production (PM2)**
   ```bash
   npm install -g pm2
   pm2 start index.js --name my-bot
   pm2 startup
   pm2 save
   ```

---

## ⚙️ Bot Configuration (In Discord)

ALL setup is done inside Discord via slash commands — no `.env` editing needed for server specific configuration!

### First Time Setup
- `/setup tickets` — Set up the ticket system (Category, Log channel, Transcript channel)
- `/setup tempvc` — Set up the temp voice channel system (Category, Hub Trigger VC)
- `/setup duo` — Set the duo VC trigger channel
- `/config` — View current settings and setup status
- `/resetconfig` — Reset configuration for the server

### Discord Server Setup Checklist
Before running the `/setup` commands, you should create the following channels in your server:
- 📁 **Tickets** (category)
- 📁 **Temp VCs** (category)
- `#ticket-log` (text channel)
- `#transcripts` (text channel)
- 🔊 `➕ Create VC` (voice channel - Hub Trigger)
- 🔊 `➕ Create Duo` (voice channel - Duo Trigger)

---

## 🎫 Ticket System

1. Admin runs `/panel` in a channel to drop the ticket embed.
2. User clicks the **Open Ticket** button.
3. User types a reason in the popup modal (10-500 characters).
4. A private channel is created in the Ticket Category.
5. Staff members interact with the user and click **Close Ticket** when finished.
6. An HTML transcript is saved, sent to the transcript channel, and logged to the log channel.
7. The ticket channel is deleted after 5 seconds.

---

## 🔊 Temp Voice Channels

- **Hub VC:** Unlimited users. Channel is named `"{displayName}'s VC"`.
- **Duo VC:** Max 2 users. Channels are sequentially named `𝄢・duo ¹`, `𝄢・duo ²`, etc.
- Auto-deletes when all humans leave the channel.
- A VC Control Panel is sent inside each VC's text chat automatically upon creation.

### VC Control Panel Buttons
The creator of the VC can use the following buttons:
- **Rename:** Open a modal to change the channel name.
- **Limit:** Open a modal to set the user limit (0-99).
- **Lock:** Block new joins (`Connect: false`).
- **Unlock:** Allow joins.
- **Hide:** Hide the channel from the channel list (`ViewChannel: false`).
- **Unhide:** Show the channel in the list.
- **Waiting:** Create a waiting room (`ViewChannel: true`, `Connect: false`).
- **Trust:** Select a user to bypass locks and hiding.
- **Reject:** Select a user to reject and remove from the VC.
- **Delete:** Instantly delete the voice channel.
- **Kick:** Select a user to disconnect from the VC.
- **Ban:** Select a user to disconnect and permanently block from the VC.

---

## 😴 AFK System

- Use `/afk [reason]` or `!afk [reason]` to go AFK.
- The bot will add an `[AFK]` tag to your nickname if permissions allow.
- If someone mentions you, the bot notifies them how long you've been away and your reason.
- Your AFK status is automatically removed the next time you send a message.

---

## 🎨 Custom Emojis

All bot emojis are centrally managed in `config/emojis.js`.

To use your own server emojis:
1. Type `\:emojiname:` in your Discord server to get the raw ID.
2. Open `config/emojis.js`.
3. Replace the placeholder with your custom emoji ID string.

**Format:**
```javascript
  success: '<:success:123456789012345678>',
```

---

## 🗄️ Database

This bot uses SQLite via the `sql.js` library (pure JavaScript, no native binaries required).
- No installation needed; database is automatically created on first run.
- Stored in `data/bot.db` (auto-managed).
- **Tables:**
  - `guild_configs`: Stores all per-server settings and channel IDs.
  - `ticket_count`: Tracks the incremental ticket numbers per server.
  - `noprefix_users`: Stores users with no-prefix access per server.
  - `afk_users`: Stores current AFK status and reasons per server.
  - `bot_owners`: Stores users with global bot owner status.

---

## 📁 Project Structure

```text
my-bot/
├── commands/
│   ├── mod/          ← Moderation commands
│   ├── tickets/      ← Ticket panel
│   ├── setup/        ← Bot configuration
│   └── util/         ← Utility commands
├── database/         ← SQLite DB layer
├── events/           ← Discord event handlers
├── utils/            ← Shared utilities
├── config/
│   └── emojis.js     ← Custom emoji config
├── data/             ← Runtime data (DB, presence)
├── index.js          ← Bot entry point
├── config.js         ← Bot config
└── deploy-commands.js← Slash command registrar
```

---

## 🔧 Advanced

### Bot Ownership
Ownership is managed globally via the database. The initial owner is seeded from the `.env` file on first startup.
- Owners can add other owners.
- Owners can grant/revoke no-prefix access.

### No-Prefix System
- `/noprefix add <user>` — Grant a user no-prefix access (Owner only).
- `/noprefix remove <user>` — Revoke no-prefix access (Owner only).
- `/noprefix list` — View all owners and no-prefix users.
- **Note:** Bot owners must be added to no-prefix explicitly if they wish to use commands without a prefix.

### Rich Presence
Admin-only commands to update the bot's status across all servers. Persists across restarts.
- `/rpc type:PLAYING text:<text>`
- `/rpc type:WATCHING text:<text>`
- `/rpc type:LISTENING text:<text>`
- `/rpc type:COMPETING text:<text>`
- `/rpc type:CLEAR`

### Cooldowns
- **All normal commands:** 3 second cooldown.
- **Setup & Noprefix commands:** 5 second cooldown.
- Command error replies are ephemeral in slash commands and automatically deleted after 5 seconds for prefix commands.
- Success messages for mass-action commands (Purge, VC Kick) are also deleted after 5 seconds.

---

## 📝 License
MIT
