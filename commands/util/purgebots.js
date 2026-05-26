const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
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
    .setName('purgebots')
    .setDescription('Purge last X bot messages from this channel')
    .addIntegerOption((opt) =>
      opt.setName('amount')
        .setDescription('Number of bot messages to delete (default: 50)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purgebots',
  aliases: ['cleanbots', 'deletebots'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
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

        const remaining = cooldown.check('purgebots', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return replyError(`${e.error} You need the **Manage Messages** permission.`);
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        channel = message.channel;
        amount = parseInt(args[0], 10) || 50;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('purgebots', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return replyError(`${e.error} You need the **Manage Messages** permission.`);
        }

        if (amount < 1 || amount > 100) {
          return replyError(`${e.error} Please provide a number between 1 and 100.`);
        }
      }

      if (!isSlash) {
        await deleteTrigger(interactionOrMessage, 0);
      }

      const fetched = await channel.messages.fetch({ limit: 100 });
      const botMessages = fetched.filter((m) => m.author.bot);
      const toDelete = [...botMessages.values()].slice(0, amount);

      if (toDelete.length === 0) {
        return replyError(`${e.error} No bot messages found to delete.`);
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      if (isSlash) {
        await replySuccess({ content: `${e.bot} Deleted **${deleted.size}** bot messages.` });
      } else {
        const msg = await replySuccess({ content: `${e.bot} Deleted **${deleted.size}** bot messages.` });
        if (msg) {
          setTimeout(() => msg.delete().catch((err) => {
            console.error('[PurgeBots Cleanup Error]', err);
          }), 3000);
        }
      }
    } catch (err) {
      console.error('[PurgeBots]', err);
    }
  },
};
