const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');
const config = require('../config');

const NOPREFIX_PATH = path.join(__dirname, '..', 'data', 'noprefix.json');

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;

      // --- Load no-prefix list fresh on every message ---
      let noprefixUsers = [];
      try {
        const data = JSON.parse(fs.readFileSync(NOPREFIX_PATH, 'utf-8'));
        noprefixUsers = data.users || [];
      } catch {}

      const isOwner = config.ownerId && message.author.id === config.ownerId;
      const isNoPrefix = noprefixUsers.includes(message.author.id);
      const startsWithPrefix = message.content.startsWith(config.prefix);

      let args;
      let commandName;

      if (startsWithPrefix) {
        args = message.content.slice(config.prefix.length).trim().split(/\s+/);
        commandName = args.shift().toLowerCase();
      } else if (isOwner || isNoPrefix) {
        args = message.content.trim().split(/\s+/);
        commandName = args.shift().toLowerCase();
      } else {
        return;
      }

      const command = client.commands.get(commandName);
      if (!command) return;

      await command.execute(message, args, client);
    } catch (err) {
      console.error('[MessageCreate]', err);
    }
  },
};
