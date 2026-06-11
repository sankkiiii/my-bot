const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

async function start() {
  // Ensure data/ directory exists
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Initialize database
  const db = require('./database/db');
  await db.init();
  console.log('[DB] SQLite initialized');

  // Migrate existing data on first run
  const migrate = require('./database/migrate');
  migrate();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  client.commands = new Collection();
  client.tempVCs = new Map();
  client.tempVCsCreating = new Set();
  console.log('[Index] tempVCs Map initialized');
  console.log('[Index] tempVCsCreating Set initialized');

  loadCommands(client);
  loadEvents(client);

  // Global crash handlers — prevent silent process exits in production
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
  });

  client.login(config.token);
}

start().catch((err) => {
  console.error('[Index] Startup failed:', err);
});
