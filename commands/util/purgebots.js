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
const { error, withEmoji } = require('../../utils/emoji');

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
  aliases: ['cleanbots', 'deletebots', 'purge bots'],

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
      const msg = withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`);
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Permission check
    if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error('You need the **Manage Messages** permission.');
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error('I need **Manage Messages** permission.');
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    try {
      const channel = interactionOrMessage.channel;
      let amount;
      let fetched;

      if (isSlash) {
        amount = interaction.options.getInteger('amount') || 50;
        await interaction.reply({
          content: withEmoji('loading', 'Purging...'),
          ephemeral: true,
        });
        fetched = await channel.messages.fetch({ limit: 100 });
      } else {
        const args = message.content.trim().split(/\s+/).slice(1);
        amount = parseInt(args[0], 10) || 50;
        if (amount < 1 || amount > 100) {
          return prefixError(
            message,
            error('Please provide a number between 1 and 100.')
          );
        }
        
        // Do fetch and delete trigger in parallel
        const [_, fetchedMsgs] = await Promise.all([
          message.delete().catch(() => {}),
          channel.messages.fetch({ limit: 100 })
        ]);
        fetched = fetchedMsgs;
      }

      // Use 12 days to avoid edge case errors
      const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;
      
      const botMsgs = fetched
        .filter((m) => m.author.bot && m.createdTimestamp > twoWeeksAgo)
        .first(Math.min(amount, 100));

      if (!botMsgs.length) {
        const msg = error('No bot messages found to delete.');
        if (isSlash) {
          return interaction.editReply(msg);
        } else {
          // Fallback to sending in channel if message was deleted
          const errReply = await channel.send(msg);
          setTimeout(() => errReply.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Single bulkDelete call
      const deleted = await channel.bulkDelete(botMsgs, true);
      const successMsgContent = withEmoji('purge', `Deleted **${deleted.size}** bot messages.`);

      if (isSlash) {
        return interaction.editReply(successMsgContent);
      } else {
        const msg = await channel.send(successMsgContent);
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[PurgeBots]', err);
      const msg = error('An error occurred while purging bot messages.');
      if (isSlash) return interaction.editReply(msg);
      const errReply = await interactionOrMessage.channel.send(msg);
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
    }
  },
};
