const {
  EmbedBuilder,
} = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const checkOwnerBypass = require('../../utils/isOwner');
const resolveUser = require('../../utils/resolveUser');
const cooldown = require('../../utils/cooldown');
const {
  prefixSuccess,
} = require('../../utils/replyHelper');
const { success, withEmoji } = require('../../utils/emoji');

module.exports = {
  name: 'owner',
  aliases: ['addowner', 'botowner', 'owners'],

  async execute(message, args, client) {
    try {
      const guild = message.guild;
      if (!guild) return;

      const executorId = message.author.id;

      // Permission check: Only bot owners can use this command
      if (!guildConfig.isOwner(executorId)) {
        return; // Silent
      }

      const bypassExecutorId = executorId;
      const checkOwnerBypassFunc = require('../../utils/isOwner');
      const ownerBypass = checkOwnerBypassFunc(bypassExecutorId);

      // Cooldown check (3s)
      if (!ownerBypass) {
        const remaining = cooldown.check('owner', executorId, guild.id, 3000);
        if (remaining > 0) {
          return; // Silent
        }
      }

      const subcommand = (args[0] || '').toLowerCase();

      if (subcommand === 'add' || subcommand === 'remove') {
        const input = args.slice(1).join(' ');
        if (!input) return; // Silent

        const member = await resolveUser(input, guild);
        const targetUser = member?.user || await client.users.fetch(input.replace(/[<@!>]/g, '')).catch(() => null);

        if (!targetUser) return; // Silent
        if (targetUser.bot) return; // Silent

        if (subcommand === 'add') {
          if (guildConfig.isOwner(targetUser.id)) return; // Silent
          guildConfig.addOwner(targetUser.id, executorId);
          return prefixSuccess(message, { content: `✅ **${targetUser.username}** has been added as a bot owner.` });
        }

        if (subcommand === 'remove') {
          if (targetUser.id === executorId) return; // Silent
          if (!guildConfig.isOwner(targetUser.id)) return; // Silent
          guildConfig.removeOwner(targetUser.id);
          return prefixSuccess(message, { content: `✅ **${targetUser.username}** has been removed from bot owners.` });
        }
      }

      if (subcommand === 'list') {
        const owners = guildConfig.getOwners();
        const ownerLines = [];
        for (let i = 0; i < owners.length; i++) {
          const id = owners[i];
          const user = await client.users.fetch(id).catch(() => null);
          ownerLines.push(`${i + 1}. ${user ? user.tag : 'Unknown User'} (\`${id}\`)`);
        }

        const embed = new EmbedBuilder()
          .setColor('#FF7043')
          .setAuthor({
            name: client.user.username,
            iconURL: client.user.displayAvatarURL({ dynamic: true })
          })
          .setDescription(withEmoji('crown', `**Bot Owners**\n\n${ownerLines.length > 0 ? ownerLines.join('\n') : 'No bot owners found.'}`));

        return prefixSuccess(message, { embeds: [embed] });
      }
    } catch (err) {
      return; // Silent
    }
  },
};
