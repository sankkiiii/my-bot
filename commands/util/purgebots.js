const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purgebots')
    .setDescription('Purge last X bot messages from this channel')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of bot messages to delete (default: 50)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purgebots',
  aliases: ['cleanbots', 'deletebots', 'pb'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check
    const remaining = cooldown.check('purgebots', executor.id, guild.id, 3000);
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
      amount = interaction.options.getInteger('amount') || 50;
    } else {
      const args = message.content.trim().split(/\s+/).slice(1);
      amount = parseInt(args[0], 10) || 50;
      if (amount < 1 || amount > 100) {
        return prefixError(message, `${e.error} Please provide a number between 1 and 100.`);
      }
      // Delete trigger instantly
      await message.delete().catch(() => {});
    }

    try {
      const channel = interactionOrMessage.channel;
      const fetched = await channel.messages.fetch({ limit: 100 });
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      const botMessages = fetched
        .filter((m) => m.author.bot && m.createdTimestamp > twoWeeksAgo)
        .first(amount);

      if (botMessages.length === 0) {
        const msg = `${e.error} No recent bot messages found to delete.`;
        return isSlash ? interaction.editReply(msg) : prefixError(message, msg);
      }

      const deleted = await channel.bulkDelete(botMessages, true);

      if (isSlash) {
        return interaction.editReply(`${e.purge} Deleted **${deleted.size}** bot messages.`);
      } else {
        const successMsg = await channel.send(`${e.purge} Deleted **${deleted.size}** bot messages.`);
        setTimeout(() => successMsg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[PurgeBots]', err);
      const msg = `${e.error} An error occurred while purging bot messages.`;
      if (isSlash) return interaction.editReply(msg);
      return prefixError(message, msg);
    }
  },
};
