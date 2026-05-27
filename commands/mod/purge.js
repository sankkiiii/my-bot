const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purge',
  aliases: ['clear', 'clean', 'prune'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check
    const remaining = cooldown.check('purge', executor.id, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Permission check
    if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = `${e.error} You need the **Manage Messages** permission.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = `${e.error} I need **Manage Messages** permission.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    try {
      const channel = interactionOrMessage.channel;
      let amount;
      let messages;

      if (isSlash) {
        amount = interaction.options.getInteger('amount') || 100;
        await interaction.reply({
          content: `${e.loading} Purging...`,
          ephemeral: true,
        });
        messages = await channel.messages.fetch({
          limit: Math.min(amount, 100),
        });
      } else {
        const args = message.content.trim().split(/\s+/).slice(1);
        amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return prefixError(
            message,
            `${e.error} Please provide a number between 1 and 100.`
          );
        }
        
        // Do fetch and delete trigger in parallel
        const [_, fetchedMsgs] = await Promise.all([
          message.delete().catch(() => {}),
          channel.messages.fetch({ limit: Math.min(amount + 1, 100) })
        ]);
        messages = fetchedMsgs;
      }

      // Use 12 days to avoid edge case errors with Discord API
      const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;
      const deletable = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      if (deletable.size === 0) {
        const msg = `${e.error} No deletable messages found (must be under 12 days old).`;
        if (isSlash) {
          return interaction.editReply(msg);
        } else {
          return prefixError(channel, msg); // Note: using channel since message is deleted
        }
      }

      // Single bulkDelete call
      const deleted = await channel.bulkDelete(deletable, true);
      const successMsgContent = `${e.purge} Deleted **${deleted.size}** messages.`;

      if (isSlash) {
        return interaction.editReply(successMsgContent);
      } else {
        const msg = await channel.send(successMsgContent);
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[Purge]', err);
      const msg = `${e.error} An error occurred while purging messages.`;
      if (isSlash) return interaction.editReply(msg);
      // Since message is already deleted, send to channel
      const errReply = await interactionOrMessage.channel.send(msg);
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
    }
  },
};
