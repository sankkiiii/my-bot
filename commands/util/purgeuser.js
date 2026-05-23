const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purgeuser')
    .setDescription('Purge last X messages from a specific user')
    .addUserOption((opt) =>
      opt.setName('user')
        .setDescription('Select a user from the list')
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('query')
        .setDescription('Or type a username / user ID')
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (default: 50)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purgeuser',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let member, amount, channel, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        amount = interaction.options.getInteger('amount') || 50;

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '\u274C You need the **Manage Messages** permission.', ephemeral: true });
        }

        const userOption = interaction.options.getUser('user');
        const queryOption = interaction.options.getString('query');

        if (userOption) {
          member = await interaction.guild.members.fetch(userOption.id).catch(() => null);
        } else if (queryOption) {
          member = await resolveUser(queryOption, interaction.guild);
        }

        if (!member) {
          return interaction.reply({ content: '\u274C Could not find that user. Try their @mention, username, or user ID.', ephemeral: true });
        }

        replyFn = (content) => interaction.reply({ content, ephemeral: true });
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        channel = message.channel;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return message.reply('\u274C You need the **Manage Messages** permission.');
        }

        let userInput;
        amount = 50;

        if (message.mentions.members.first()) {
          userInput = message.mentions.members.first().id;
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

        if (!userInput) {
          return message.reply('\u274C Please provide a user. Usage: `!purgeuser @user [amount]` or `!purgeuser username [amount]`');
        }

        amount = Math.min(Math.max(amount, 1), 100);
        member = await resolveUser(userInput, message.guild);

        if (!member) {
          return message.reply('\u274C Could not find that user. Try their @mention, username, or user ID.');
        }

        replyFn = (content) => message.reply(content);
      }

      const fetched = await channel.messages.fetch({ limit: 100 });
      const userMessages = fetched.filter((m) => m.author.id === member.id);
      const toDelete = [...userMessages.values()].slice(0, amount);

      if (toDelete.length === 0) {
        return replyFn('\u274C No messages found from that user.');
      }

      const deleted = await channel.bulkDelete(toDelete, true);
      const displayName = member.displayName;

      const reply = await (isSlash
        ? interactionOrMessage.reply({ content: `\uD83D\uDDD1\uFE0F Deleted **${deleted.size}** messages from **${displayName}**.`, ephemeral: true, fetchReply: true })
        : channel.send(`\uD83D\uDDD1\uFE0F Deleted **${deleted.size}** messages from **${displayName}**.`));

      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('[PurgeUser]', err);
    }
  },
};
