const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const { error, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purgeuser')
    .setDescription('Purge last X messages from a specific user')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Select a user from the list')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Or type a username / user ID')
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (default: 50)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purgeuser',
  aliases: ['clearuser', 'deluser', 'purgeuser'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check
    const remaining = cooldown.check('purgeuser', executor.id, guild.id, 3000);
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

    let targetMember;
    let amount = 50;

    if (isSlash) {
      amount = interaction.options.getInteger('amount') || 50;
      const userOption = interaction.options.getUser('user');
      const queryOption = interaction.options.getString('query');

      if (userOption) {
        targetMember = await guild.members.fetch(userOption.id).catch(() => null);
      } else if (queryOption) {
        targetMember = await resolveUser(queryOption, guild);
      }
    } else {
      const args = message.content.trim().split(/\s+/).slice(1);
      let userInput;

      if (message.mentions.members.first()) {
        targetMember = message.mentions.members.first();
        amount = parseInt(args[1], 10) || 50;
      } else if (args.length > 0) {
        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg) && !/^\d{17,19}$/.test(lastArg)) {
          amount = parseInt(lastArg, 10);
          userInput = args.slice(0, -1).join(' ');
        } else {
          userInput = args.join(' ');
        }
      }

      if (userInput && !targetMember) {
        targetMember = await resolveUser(userInput, guild);
      }
    }

    if (!targetMember) {
      const msg = error('Could not find that user. Try their @mention, username, or user ID.');
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    amount = Math.min(Math.max(amount, 1), 100);

    try {
      const channel = interactionOrMessage.channel;
      let fetched;

      if (isSlash) {
        await interaction.reply({
          content: withEmoji('loading', 'Purging...'),
          ephemeral: true,
        });
        fetched = await channel.messages.fetch({ limit: 100 });
      } else {
        // Fetch and delete trigger in parallel
        const [_, fetchedMsgs] = await Promise.all([
          message.delete().catch(() => {}),
          channel.messages.fetch({ limit: 100 })
        ]);
        fetched = fetchedMsgs;
      }

      // Use 12 days to avoid edge case errors
      const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;

      const userMessages = fetched
        .filter(
          (m) =>
            m.author.id === targetMember.id &&
            m.createdTimestamp > twoWeeksAgo
        )
        .first(amount);

      if (userMessages.length === 0) {
        const msg = error(`No recent messages found from **${targetMember.displayName}**.`);
        if (isSlash) {
          return interaction.editReply(msg);
        } else {
          const errReply = await channel.send(msg);
          setTimeout(() => errReply.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Single bulkDelete call
      const deleted = await channel.bulkDelete(userMessages, true);
      const successMsgContent = withEmoji('purge', `Deleted **${deleted.size}** messages from **${targetMember.displayName}**.`);

      if (isSlash) {
        return interaction.editReply(successMsgContent);
      } else {
        const successMsg = await channel.send(successMsgContent);
        setTimeout(() => successMsg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[PurgeUser]', err);
      const msg = error('An error occurred while purging messages.');
      if (isSlash) return interaction.editReply(msg);
      const errReply = await interactionOrMessage.channel.send(msg);
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
    }
  },
};
