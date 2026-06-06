const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const checkOwnerBypass = require('../../utils/isOwner');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const { success, error, getEmoji, withEmoji } = require('../../utils/emoji');

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
  aliases: ['clear', 'clean', 'delete', 'prune'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const bypassExecutorId = (typeof isSlash !== 'undefined' && isSlash) ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage && interactionOrMessage.author ? interactionOrMessage.author.id : (interactionOrMessage && interactionOrMessage.user ? interactionOrMessage.user.id : (typeof executorId !== 'undefined' ? executorId : (typeof executor !== 'undefined' ? executor.id : ''))));
    const ownerBypass = checkOwnerBypass(bypassExecutorId);
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check
    if (!ownerBypass) {
    const remaining = cooldown.check('purge', executor.id, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }
    }

    // Permission check
    if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error(`You need the **Manage Messages** permission.`);
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error(`I need **Manage Messages** permission.`);
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    try {
      const channel = interactionOrMessage.channel;
      let amount;
      let messages;

      if (isSlash) {
        amount = interaction.options.getInteger('amount') || 100;
        await interaction.reply({
          content: withEmoji('loading', 'Purging...'),
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
            error(`Please provide a number between 1 and 100.`)
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
        const msg = error(`No deletable messages found (must be under 12 days old).`);
        if (isSlash) {
          return interaction.editReply(msg);
        } else {
          const errReply = await channel.send(msg);
          setTimeout(() => errReply.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Single bulkDelete call
      const deleted = await channel.bulkDelete(deletable, true);
      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setAuthor({
          name: (isSlash ? interaction.user : message.author).username,
          iconURL: (isSlash ? interaction.user : message.author).displayAvatarURL({ dynamic: true }),
        })
        .setDescription(success(`Deleted **${deleted.size}** messages`))
        .setFooter({ text: `Requested by ${(isSlash ? interaction.user : message.author).tag}` });

      if (isSlash) {
        return interaction.editReply({ content: null, embeds: [embed] });
      } else {
        const msg = await channel.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[Purge]', err);
      const msg = error(`An error occurred while purging messages.`);
      if (isSlash) return interaction.editReply({ content: msg, embeds: [] });
      // Since message is already deleted, send to channel
      const errReply = await interactionOrMessage.channel.send(msg);
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
    }
  },
};
