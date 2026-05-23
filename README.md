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
- Works like **Voice Master** — a designated "Create VC" voice channel acts as a trigger.
- When a user joins it, the bot instantly creates a personal voice channel (`username's VC`) and moves them in.
- The creator gets `ManageChannels` + `MoveMembers` permissions on their VC (rename, set user limit, drag users in/out).
- When the channel empties, it is automatically deleted.
- Survives bot restarts — on startup, the bot cleans up any leftover empty temp VCs.
- Multiple users can each have their own temp VC simultaneously.

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
├── utils/
│   ├── logger.js           # sendLog() helper for sending embeds to log channels
│   └── transcript.js       # Generates HTML transcript files for tickets
└── data/
    └── ticketCount.json    # Persistent ticket counter (auto-created)
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

## Detailed Feature Guides

### Temporary Voice Channels — Full Setup & Usage

The Temp VC system works exactly like **Voice Master** bots. Users join a trigger channel, get their own personal voice channel, and it auto-deletes when empty.

#### How to Set Up

1. **Create a Category** in your Discord server for temp VCs (e.g., name it `Voice Channels` or `Temp VCs`)
2. **Right-click the category** → Copy ID → paste it as `TEMP_VC_CATEGORY` in `.env`
3. **Create a Voice Channel** inside that category named `➕ Create VC` (or any name you like)
4. **Right-click the voice channel** → Copy ID → paste it as `CREATE_VC_CHANNEL` in `.env`
5. **Restart the bot** (or start it for the first time)

Your `.env` should have:
```env
TEMP_VC_CATEGORY=1234567890123456789
CREATE_VC_CHANNEL=1234567890123456789
```

#### How It Works (User Flow)

```
User joins "➕ Create VC"
        ↓
Bot creates "username's VC" in the same category
        ↓
Bot moves the user into their new VC
        ↓
User now owns the channel with full control
        ↓
When everyone leaves → Bot auto-deletes the channel
```

#### What the VC Creator Can Do

Because the bot grants `ManageChannels` and `MoveMembers` permissions on the created VC, the creator can:

| Action | How |
|--------|-----|
| **Rename** their VC | Right-click channel → Edit Channel → change name |
| **Set user limit** | Right-click channel → Edit Channel → set User Limit (e.g., 5) |
| **Move users** in/out | Drag and drop users into or out of the channel |
| **Disconnect users** | Right-click a user → Disconnect |
| **Set bitrate** | Edit Channel → change bitrate for audio quality |

#### Edge Cases Handled

| Scenario | What Happens |
|----------|-------------|
| User joins "Create VC" | New VC created, user moved in |
| User leaves their temp VC | If VC is now empty, it's deleted |
| User moves from temp VC to another channel | If old VC is now empty, it's deleted |
| User creates VC then immediately disconnects | Empty VC is detected and deleted |
| Bot fails to move the user | The empty VC is cleaned up automatically |
| Multiple users join "Create VC" at once | Each gets their own VC — no conflicts |
| User already has a temp VC and joins "Create VC" again | A second VC is created (not blocked) |
| Bot restarts while temp VCs exist | On startup, bot scans the category and deletes any empty VCs |
| `CREATE_VC_CHANNEL` not set in `.env` | Bot logs a warning and skips temp VC functionality |
| Bot never deletes the "Create VC" channel | The trigger channel is always protected |

#### Startup Cleanup

When the bot starts (or restarts), it automatically:
1. Scans all voice channels inside `TEMP_VC_CATEGORY`
2. Finds any that are **empty** and are **not** the `CREATE_VC_CHANNEL`
3. Deletes them
4. Logs how many were cleaned up

This means if your bot crashes or restarts, leftover temp VCs won't pile up.

#### Console Output Example

```
[Ready] Logged in as MyBot#1234
[Ready] Ticket counter loaded: 15
[Ready] Cleaned up 3 leftover temp VC(s)
```

#### Troubleshooting Temp VCs

| Issue | Solution |
|-------|----------|
| Nothing happens when joining "Create VC" | Check that `CREATE_VC_CHANNEL` in `.env` matches the voice channel ID exactly |
| Bot creates the VC but doesn't move the user | Bot needs `Move Members` permission in the server |
| VC is created in the wrong category | Check that `TEMP_VC_CATEGORY` matches the correct category ID |
| Leftover VCs not cleaned on restart | Make sure the bot has `Manage Channels` permission |
| "Create VC" channel itself gets deleted | This should never happen — but verify the channel ID is correct in `.env` |

---

### Ticket System — Full Setup & Usage

The ticket system works like **TicketTool.xyz** — a persistent panel with a button, private ticket channels, staff-only close, and HTML transcripts.

#### How to Set Up

1. **Create a Category** for tickets (e.g., `Tickets`)
2. **Right-click the category** → Copy ID → paste as `TICKET_CATEGORY` in `.env`
3. **Create a Text Channel** for transcripts (e.g., `#transcripts`)
4. **Right-click** → Copy ID → paste as `TRANSCRIPT_CHANNEL` in `.env`
5. **Create a Text Channel** for ticket logs (e.g., `#ticket-log`)
6. **Right-click** → Copy ID → paste as `TICKET_LOG_CHANNEL` in `.env`
7. **Create a Role** for staff (e.g., `Staff`)
8. **Right-click the role** → Copy ID → paste as `STAFF_ROLE` in `.env`
9. **Start the bot**, then run `/panel` or `!panel` in the channel where you want the ticket panel

#### How It Works (Full Flow)

```
Staff runs /panel in #support
        ↓
Bot sends a beautiful embed with "📩 Open Ticket" button
        ↓
User clicks the button
        ↓
Bot creates #ticket-username (private channel)
  → Only the user + Staff role + Bot can see it
  → Channel topic set to opener's user ID
        ↓
Bot sends welcome embed with "🔒 Close Ticket" button
        ↓
User describes their issue, staff responds
        ↓
Staff clicks "🔒 Close Ticket"
        ↓
Bot fetches ALL messages from the channel
        ↓
Bot generates a professional HTML transcript
        ↓
Bot sends transcript file to #transcripts with details embed
        ↓
Bot logs the closure to #ticket-log
        ↓
Bot deletes the ticket channel after 5 seconds
```

#### Panel Embed

The panel sent by `/panel` includes:
- Title: "📋 Support Tickets"
- Description: "Need help? Click the button below to open a support ticket."
- Color: Discord Blurple (#5865F2)
- Server icon as thumbnail
- Server name + bot tag in footer
- A "📩 Open Ticket" button that **never expires** (works forever, even after restarts)

#### Ticket Channel Permissions

| Who | Permissions |
|-----|------------|
| @everyone | Cannot see the channel |
| Ticket opener | View, Send Messages, Read History, Attach Files |
| Staff role | View, Send Messages, Read History, Manage Messages, Attach Files |
| Bot | View, Send Messages, Read History, Manage Messages |

#### Ticket Numbering

- Each ticket gets a sequential number (#1, #2, #3...)
- Stored in `data/ticketCount.json` — persists across restarts
- Never resets (unless you manually edit the file)
- Shown in the welcome embed inside the ticket

#### HTML Transcript

When a ticket is closed, the bot generates a **self-contained HTML file** that looks like TicketTool.xyz transcripts:

- Dark Discord-like theme (#36393f background)
- Server icon and name in header
- Ticket info: name, opened by, closed by, dates, message count
- Each message shows: circular avatar, colored username (uses role color), timestamp
- Bot messages have a subtle different background + blue "BOT" badge
- Embeds shown as colored left-border blocks
- Attachments shown with 📎 icon and clickable filename
- URLs are auto-linked
- Avatar fallback if Discord CDN fails
- Footer with bot name and generation timestamp
- **No external dependencies** — fully self-contained, works offline

#### Persistence

| What | How It Persists |
|------|----------------|
| Panel button | Uses static `customId` — works forever without re-sending |
| Ticket counter | Saved to `data/ticketCount.json` on every ticket creation |
| Opener info | Stored in channel topic as `Opened by: {userId}` |
| `data/` folder | Auto-created on bot startup if it doesn't exist |

#### Duplicate Ticket Prevention

If a user tries to open a ticket while they already have one open, the bot replies with:
> ❌ You already have an open ticket: #ticket-username

#### Who Can Close Tickets

- **Only members with the Staff role** can click the "Close Ticket" button
- If a non-staff member clicks it, they get:
  > ❌ Only staff members can close tickets.

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
| Temp VC not created when joining | Verify `CREATE_VC_CHANNEL` ID matches exactly; bot needs Manage Channels permission |
| Ticket panel button stopped working | Old panels use `ticket_open` — run `/panel` again to send a new panel with the updated `open_ticket` ID |
| Ticket counter reset to 0 | Check that `data/ticketCount.json` exists and isn't being deleted on deploy |
| Transcript file is empty | Make sure the bot has Read Message History permission in the ticket channel |

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
