const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
  deleteTrigger,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

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
  aliases: ['cleanuser', 'deleteuser'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let member;
      let amount;
      let channel;
      let replyError;
      let replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        channel = interaction.channel;
        amount = interaction.options.getInteger('amount') || 50;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('purgeuser', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return replyError(`${e.error} You need the **Manage Messages** permission.`);
        }

        const userOption = interaction.options.getUser('user');
        const queryOption = interaction.options.getString('query');

        if (userOption) {
          member = await interaction.guild.members.fetch(userOption.id).catch(() => null);
        } else if (queryOption) {
          member = await resolveUser(queryOption, interaction.guild);
        }

        if (!member) {
          return replyError(`${e.error} Could not find that user. Try their @mention, username, or user ID.`);
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        channel = message.channel;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('purgeuser', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return replyError(`${e.error} You need the **Manage Messages** permission.`);
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
          return replyError(`${e.error} Please provide a user. Usage: \`!purgeuser @user [amount]\` or \`!purgeuser username [amount]\``);
        }

        amount = Math.min(Math.max(amount, 1), 100);
        member = await resolveUser(userInput, message.guild);

        if (!member) {
          return replyError(`${e.error} Could not find that user. Try their @mention, username, or user ID.`);
        }
      }

      if (!isSlash) {
        await deleteTrigger(interactionOrMessage, 0);
      }

      const fetched = await channel.messages.fetch({ limit: 100 });
      const userMessages = fetched.filter((m) => m.author.id === member.id);
      const toDelete = [...userMessages.values()].slice(0, amount);

      if (toDelete.length === 0) {
        return replyError(`${e.error} No messages found from that user.`);
      }

      const deleted = await channel.bulkDelete(toDelete, true);
      const displayName = member.displayName;

      if (isSlash) {
        await replySuccess({ content: `${e.delete} Deleted **${deleted.size}** messages from **${displayName}**.` });
      } else {
        const msg = await replySuccess({ content: `${e.delete} Deleted **${deleted.size}** messages from **${displayName}**.` });
        if (msg) {
          setTimeout(() => msg.delete().catch((err) => {
            console.error('[PurgeUser Cleanup Error]', err);
          }), 3000);
        }
      }
    } catch (err) {
      console.error('[PurgeUser]', err);
    }
  },
};
