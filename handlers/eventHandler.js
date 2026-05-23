const fs = require('fs');
const path = require('path');

/**
 * Auto-loads all event files from events/ and registers them on the client.
 * Each event file must export: name (string), once? (boolean), execute (function).
 * @param {import('discord.js').Client} client
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (!event.name || !event.execute) {
      console.warn(`[Events] Skipping ${filePath} — missing "name" or "execute".`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    console.log(`[Events] Loaded: ${event.name}`);

    // Support optional init(client) for registering additional listeners
    if (typeof event.init === 'function') {
      event.init(client);
    }
  }
}

module.exports = { loadEvents };
