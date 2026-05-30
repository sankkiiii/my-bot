const { Events } = require('discord.js');
const config = require('../config');
const guildConfig = require('../database/guildConfig');
const formatDuration = require('../utils/formatDuration');
const { success, error } = require('../utils/emoji');

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {
      if (message.author.bot) return;
      if (message.editedTimestamp !== null) return;
      if (!message.guild) return;

      let authorAFK;
      try {
        authorAFK = guildConfig.getAFK(message.guild.id, message.author.id);
      } catch (err) {
        console.error('[AFK Error]', err);
      }

      if (authorAFK) {
        try {
          guildConfig.removeAFK(message.guild.id, message.author.id);
        } catch (err) {
          console.error('[AFK Error]', err);
        }

        const setAt = new Date(authorAFK.set_at);
        const diffMs = Date.now() - setAt;
        const diffSecs = Math.floor(diffMs / 1000);
        const duration = formatDuration(diffSecs);

        try {
          if (message.member.displayName.startsWith('[AFK]')) {
            const originalName = message.member.displayName
              .replace(/^\[AFK\]\s*/, '');
            await message.member.setNickname(
              originalName === message.member.user.username
                ? null
                : originalName,
            );
          }
        } catch (err) {
          console.error('[AFK Nickname Error]', err);
        }

        const msg = await message.channel.send({
          content: `${success(`Welcome back **${message.member.displayName}**! I removed your AFK.`)}\nYou were away for **${duration}**`,
        });
        setTimeout(() => msg.delete().catch((err) => console.error('[AFK Cleanup Error]', err)), 5000);
      }

      if (message.mentions.users.size > 0 && message.guild) {
        for (const [userId, user] of message.mentions.users) {
          if (userId === message.author.id) continue;
          if (user.bot) continue;

          let afkData;
          try {
            afkData = guildConfig.getAFK(message.guild.id, userId);
          } catch (err) {
            console.error('[AFK Error]', err);
            continue;
          }
          if (!afkData) continue;

          const setAt = new Date(afkData.set_at);
          const diffMs = Date.now() - setAt;
          const diffSecs = Math.floor(diffMs / 1000);
          const duration = formatDuration(diffSecs);

          const afkMember = message.guild.members.cache.get(userId);
          const displayName = afkMember?.displayName || user.username;

          const notif = await message.channel.send({
            content: `**${displayName}** went AFK **${duration} ago**\n**Reason:** ${afkData.reason}`,
          });
          setTimeout(() => notif.delete().catch((err) => console.error('[AFK Cleanup Error]', err)), 5000);
        }
      }

      // No-Prefix check (separate from ownership)
      let isNoPrefix = false;
      try {
        isNoPrefix = guildConfig.isNoPrefixUser(message.guild.id, message.author.id);
      } catch (err) {
        console.error('[NoPrefix Error]', err);
      }

      const startsWithPrefix = message.content.startsWith(config.prefix);

      let args;
      let commandName;

      if (startsWithPrefix) {
        args = message.content.slice(config.prefix.length).trim().split(/\s+/);
        commandName = args.shift().toLowerCase();
      } else if (isNoPrefix) {
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
