const { EmbedBuilder } = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const isOwnerCheck = require('../../utils/isOwner');
const resolveUser = require('../../utils/resolveUser');
const cooldown = require('../../utils/cooldown');

module.exports = {
  name: 'owner',
  aliases: ['addowner', 'botowner', 'owners'],

  async execute(message, args, client) {
    try {
      // Must be in a server
      if (!message.guild) return;

      const executorId = message.author.id;
      const ownerBypass = isOwnerCheck(executorId);

      // Cooldown check (3s) - owners bypass silently
      if (!ownerBypass) {
        const remaining = cooldown.check('owner', executorId, message.guild.id, 3000);
        if (remaining > 0) return;
      }

      const sub = args[0]?.toLowerCase();

      // ── LIST ──
      if (!sub || sub === 'list') {
        // Must be owner to list
        if (!ownerBypass) return;

        const owners = guildConfig.getOwners();

        if (owners.length === 0) {
          return message.reply('No bot owners found.');
        }

        const ownerLines = [];
        for (const id of owners) {
          try {
            const user = await client.users.fetch(id);
            ownerLines.push(`• ${user.tag} (${id})`);
          } catch {
            ownerLines.push(`• Unknown User (${id})`);
          }
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('Bot Owners')
          .setDescription(ownerLines.join('\n'))
          .setFooter({ text: `Total: ${owners.length} owner(s)` });

        return message.reply({ embeds: [embed] });
      }

      // ── ADD ──
      if (sub === 'add') {
        if (!ownerBypass) return;

        const input = message.mentions.members.first()?.id
          || args[1];
        if (!input) return;

        let target;
        try {
          target = await resolveUser(input, message.guild);
          if (!target) {
            // Try global fetch by ID
            if (/^\d{17,19}$/.test(input)) {
              const user = await client.users.fetch(input).catch(() => null);
              if (!user) return;
              target = { id: user.id, user };
            } else return;
          }
        } catch { return; }

        const targetId = target.id;
        if (target.user?.bot) return;
        if (guildConfig.isOwner(targetId)) return;

        guildConfig.addOwner(targetId, executorId);

        const username = target.displayName
          || target.user?.username
          || targetId;
        return message.reply(
          `✅ **${username}** has been added as a bot owner.`
        );
      }

      // ── REMOVE ──
      if (sub === 'remove') {
        if (!ownerBypass) return;

        const input = message.mentions.members.first()?.id
          || args[1];
        if (!input) return;

        let targetId;
        try {
          const target = await resolveUser(input, message.guild);
          if (target) {
            targetId = target.id;
          } else if (/^\d{17,19}$/.test(input)) {
            targetId = input;
          } else return;
        } catch { return; }

        if (!targetId) return;
        if (targetId === executorId) return;
        if (!guildConfig.isOwner(targetId)) return;

        guildConfig.removeOwner(targetId);

        let username = targetId;
        try {
          const user = await client.users.fetch(targetId);
          username = user.tag;
        } catch {}

        return message.reply(
          `✅ **${username}** has been removed from bot owners.`
        );
      }

      // Unknown subcommand — silent
      return;

    } catch (err) {
      console.error('[Owner CMD Error]', err);
      return; // silent on unexpected errors
    }
  }
};
