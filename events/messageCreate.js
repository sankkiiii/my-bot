const { Events } = require('discord.js');
const config = require('../config');
const guildConfig = require('../database/guildConfig');
const formatDuration = require('../utils/formatDuration');
const e = require('../config/emojis');

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {
      if (message.author.bot) return;
      if (message.editedTimestamp !== null) return;
      if (!message.guild) return;

      const authorAFK = guildConfig.getAFK(message.guild.id, message.author.id);
      if (authorAFK) {
        guildConfig.removeAFK(message.guild.id, message.author.id);

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
        } catch {}

        const msg = await message.channel.send({
          content:
            `${e.success} Welcome back **${message.member.displayName}**! I removed your AFK.\n` +
            `${e.uptime} You were away for **${duration}**`,
        });
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }

      if (message.mentions.users.size > 0) {
        for (const [userId, user] of message.mentions.users) {
          if (userId === message.author.id) continue;
          if (user.bot) continue;

          const afkData = guildConfig.getAFK(message.guild.id, userId);
          if (!afkData) continue;

          const setAt = new Date(afkData.set_at);
          const diffMs = Date.now() - setAt;
          const diffSecs = Math.floor(diffMs / 1000);
          const duration = formatDuration(diffSecs);

          const afkMember = message.guild.members.cache.get(userId);
          const displayName = afkMember?.displayName || user.username;

          const notif = await message.channel.send({
            content:
              `${e.afk} **${displayName}** went AFK **${duration} ago**\n` +
              `${e.reason} **Reason:** ${afkData.reason}`,
          });
          setTimeout(() => notif.delete().catch(() => {}), 5000);
        }
      }

      const isOwner = config.ownerId && message.author.id === config.ownerId;
      const isNoPrefix = guildConfig.isNoPrefixUser(
        message.guild.id,
        message.author.id,
      );
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
