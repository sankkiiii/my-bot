const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
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

    let amount;
    if (isSlash) {
      await interaction.deferReply({ ephemeral: true });
      amount = interaction.options.getInteger('amount');
    } else {
      const args = message.content.trim().split(/\s+/).slice(1);
      amount = parseInt(args[0], 10);
      if (isNaN(amount) || amount < 1 || amount > 100) {
        return prefixError(message, `${e.error} Please provide a number between 1 and 100.`);
      }
      // Delete trigger instantly
      await message.delete().catch(() => {});
    }

    try {
      const channel = interactionOrMessage.channel;
      const messages = await channel.messages.fetch({ limit: amount });

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const deletable = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      if (deletable.size === 0) {
        const msg = `${e.error} No messages found that can be deleted (must be under 14 days old).`;
        return isSlash ? interaction.editReply(msg) : prefixError(message, msg);
      }

      const deleted = await channel.bulkDelete(deletable, true);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setDescription(`${e.purge} Deleted **${deleted.size}** messages`)
        .setFooter({ text: `Requested by ${executor.user.tag}` });

      if (isSlash) {
        return interaction.editReply({ embeds: [embed] });
      } else {
        const successMsg = await channel.send({ embeds: [embed] });
        setTimeout(() => successMsg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[Purge]', err);
      const msg = `${e.error} An error occurred while purging messages.`;
      if (isSlash) return interaction.editReply(msg);
      return prefixError(message, msg);
    }
  },
};
