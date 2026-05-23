const fs = require('fs');
const path = require('path');
const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { sendLog } = require('../utils/logger');

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

  init(client) {
    // --- Message Deleted ---
    client.on(Events.MessageDelete, async (message) => {
      try {
        if (!message.guild) return;
        if (message.partial) {
          const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(0xed4245)
            .addFields(
              { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
              { name: 'Content', value: 'Unknown (message was not cached)' },
            )
            .setTimestamp();

          return sendLog(client, config.messageLogChannel, embed);
        }

        if (message.author.bot) return;

        const embed = new EmbedBuilder()
          .setTitle('Message Deleted')
          .setColor(0xed4245)
          .addFields(
            { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
            { name: 'Content', value: message.content ? message.content.substring(0, 1024) : 'No text content' },
          )
          .setTimestamp();

        await sendLog(client, config.messageLogChannel, embed);
      } catch (err) {
        console.error('[MessageDelete]', err);
      }
    });

    // --- Message Edited ---
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      try {
        if (!newMessage.guild) return;
        if (newMessage.partial) await newMessage.fetch().catch(() => null);
        if (oldMessage.partial) await oldMessage.fetch().catch(() => null);
        if (newMessage.author && newMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
          .setTitle('Message Edited')
          .setColor(0xfee75c)
          .addFields(
            { name: 'Author', value: `${newMessage.author ? `${newMessage.author.tag} (${newMessage.author.id})` : 'Unknown'}`, inline: true },
            { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
            { name: 'Before', value: (oldMessage.content || 'Unknown').substring(0, 1024) },
            { name: 'After', value: (newMessage.content || 'Unknown').substring(0, 1024) },
          )
          .setTimestamp();

        await sendLog(client, config.messageLogChannel, embed);
      } catch (err) {
        console.error('[MessageUpdate]', err);
      }
    });

    console.log('[Events] Loaded: messageDelete (via messageCreate init)');
    console.log('[Events] Loaded: messageUpdate (via messageCreate init)');
  },
};
