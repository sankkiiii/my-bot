# My Bot — Discord Bot

A feature-rich Discord bot built with **Discord.js v14** and **Node.js**. Designed for a single private server with moderation, ticket system, temporary voice channels, and comprehensive logging.

---

## Features

### Moderation
| Command | Description |
|---------|-------------|
| `/ban` or `!ban` | Ban a member with optional reason. DMs the user before banning. |
| `/kick` or `!kick` | Kick a member with optional reason. DMs the user before kicking. |
| `/mute` or `!mute` | Timeout a member for a specified duration (max 28 days). |
| `/unmute` or `!unmute` | Remove timeout from a member. |
| `/warn` or `!warn` | Warn a member. DMs the user with the warning. |
| `/purge` or `!purge` | Bulk delete 1–100 messages in the current channel. |

All moderation actions are logged to `#mod-log` with rich embeds.

### Ticket System
- Staff runs `/panel` or `!panel` to post a ticket panel embed with an **Open Ticket** button.
- Users click the button to create a private `ticket-username` channel visible only to them and staff.
- Staff can close tickets via the **Close Ticket** button inside the ticket channel.
- On close, the bot generates a **self-contained HTML transcript** (dark theme, inline CSS), sends it to `#transcripts`, logs to `#ticket-log`, and deletes the channel after 5 seconds.

### Temporary Voice Channels
- A designated "Create VC" voice channel acts as a trigger.
- When a user joins it, the bot creates a personal voice channel (`username's VC`) and moves them in.
- The creator gets `ManageChannels` permission on their VC (rename, set user limit, etc.).
- When the channel empties, it is automatically deleted.

### Logging
| Log Channel | Events |
|-------------|--------|
| `#mod-log` | Ban, kick, mute, unmute, warn, purge |
| `#join-log` | Member join (with account age), member leave (with roles and time in server) |
| `#message-log` | Message deleted, message edited (ignores bots) |
| `#ticket-log` | Ticket opened, ticket closed |

---

## Project Structure

```
my-bot/
├── .env                    # Environment variables (secrets + IDs)
├── .gitignore
├── config.js               # Loads .env into a config object
├── index.js                # Entry point — creates client, loads handlers, logs in
├── deploy-commands.js      # Registers slash commands to your guild
├── package.json
├── handlers/
│   ├── commandHandler.js   # Auto-loads all commands from commands/ subfolders
│   └── eventHandler.js     # Auto-loads all events from events/
├── commands/
│   ├── mod/
│   │   ├── ban.js
│   │   ├── kick.js
│   │   ├── mute.js
│   │   ├── unmute.js
│   │   ├── warn.js
│   │   └── purge.js
│   └── tickets/
│       └── panel.js
├── events/
│   ├── ready.js            # Sets bot status on login
│   ├── messageCreate.js    # Prefix commands + message delete/edit logging
│   ├── interactionCreate.js # Slash commands + ticket button interactions
│   ├── voiceStateUpdate.js # Temp VC create/delete
│   └── guildMemberAdd.js   # Join/leave logging
└── utils/
    ├── logger.js           # sendLog() helper for sending embeds to log channels
    └── transcript.js       # Generates HTML transcript files for tickets
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
4. Click **Reset Token** → copy and save the **Token**
5. Copy the **Application ID** from the General Information tab (this is your `CLIENT_ID`)
6. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**

### 2. Invite the Bot to Your Server

Replace `YOUR_CLIENT_ID` with your Application ID and open this URL in your browser:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Select your server and authorize.

### 3. Enable Developer Mode in Discord

Go to **User Settings → App Settings → Advanced → Developer Mode → ON**

This lets you right-click channels, roles, categories, and users to **Copy ID**.

### 4. Create Channels, Categories, and Roles

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
| Staff | Role | `STAFF_ROLE` |
| Muted | Role (optional) | `MUTED_ROLE` |

Also copy your **Server ID** → `GUILD_ID`

### 5. Fill in `.env`

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
STAFF_ROLE=role-id
MUTED_ROLE=role-id
```

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

Open `.env` in a text editor (Notepad, VS Code, etc.) and fill in all the values from the [Discord Setup](#discord-setup-do-this-first) section above.

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
[Deploy] Registering 7 slash command(s) to guild ...
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
[Commands] Loaded: panel
[Events] Loaded: ready
[Events] Loaded: messageCreate
...
[Ready] Logged in as YourBot#1234
```

### Running in Background on Windows (Optional)

To keep the bot running after closing the terminal, use **PM2**:

```cmd
npm install -g pm2
pm2 start index.js --name my-bot
pm2 save
```

To check logs:

```cmd
pm2 logs my-bot
```

To stop/restart:

```cmd
pm2 stop my-bot
pm2 restart my-bot
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

Fill in all the values from the [Discord Setup](#discord-setup-do-this-first) section. Save with `Ctrl+O`, exit with `Ctrl+X`.

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

### PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 logs my-bot` | View bot logs (live) |
| `pm2 logs my-bot --lines 100` | View last 100 log lines |
| `pm2 restart my-bot` | Restart the bot |
| `pm2 stop my-bot` | Stop the bot |
| `pm2 delete my-bot` | Remove from PM2 |
| `pm2 status` | Show all running processes |
| `pm2 monit` | Interactive monitoring dashboard |

### Updating the Bot on VPS

```bash
cd my-bot
git pull
npm install
pm2 restart my-bot
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Error: TOKEN is not provided` | Make sure `.env` is filled in and in the project root |
| Slash commands not showing up | Run `node deploy-commands.js` again. Commands may take a few minutes to appear |
| `Missing Permissions` errors | Make sure the bot role is above the target user's highest role in your server settings |
| `Missing Access` on channels | Verify the bot has permissions to view and send messages in the log channels |
| Message content logging shows "Unknown" | Enable **Message Content Intent** in the Developer Portal |
| Member join/leave not logging | Enable **Server Members Intent** in the Developer Portal |
| `DiscordAPIError: Unknown Channel` | Double-check all channel/category IDs in `.env` |
| Bot goes offline on VPS | Use PM2 with `pm2 startup` and `pm2 save` for auto-restart |

---

## Tech Stack

- **Runtime:** Node.js
- **Library:** discord.js v14
- **Config:** dotenv
- **Process Manager:** PM2
- **Language:** JavaScript (CommonJS)

---

## License

This project is for personal/private server use.
