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
  deleteTrigger,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purge',
  aliases: ['clear', 'clean', 'prune'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let amount;
      let channel;
      let executor;
      let guild;
      let replyError;
      let replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return interaction.reply({
            content: 'This command only works in a server.',
            ephemeral: true,
          });
        }
        channel = interaction.channel;
        guild = interaction.guild;
        executor = interaction.user;
        amount = interaction.options.getInteger('amount');
        replyError = (content) => slashError(interaction, content);
        replySuccess = (payload) => slashSuccess(interaction, payload);

        const remaining = cooldown.check('purge', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return replyError(`${e.error} You need the **Manage Messages** permission to use this command.`);
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return message.reply('This command only works in a server.');
        }
        channel = message.channel;
        guild = message.guild;
        executor = message.author;
        replyError = (content) => prefixError(message, content);
        replySuccess = (payload) => prefixSuccess(message, payload);

        const remaining = cooldown.check('purge', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return replyError(`${e.error} You need the **Manage Messages** permission to use this command.`);
        }

        amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return replyError(`${e.error} Please provide a number between 1 and 100.`);
        }
      }

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return replyError(`${e.error} I don't have the **Manage Messages** permission to do this.`);
      }

      if (!isSlash) {
        await deleteTrigger(interactionOrMessage, 0);
      }

      const deleted = await channel.bulkDelete(amount, true);

      const moderatorTag = executor.tag || executor.username;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setDescription(`${e.purge} Deleted **${deleted.size}** messages`)
        .setFooter({ text: `Requested by ${moderatorTag}` });

      if (isSlash) {
        await replySuccess({ embeds: [embed] });
      } else {
        const msg = await replySuccess({ embeds: [embed] });
        if (msg) {
          setTimeout(() => msg.delete().catch((err) => {
            console.error('[Purge Cleanup Error]', err);
          }), 3000);
        }
      }
    } catch (err) {
      console.error('[Purge]', err);
    }
  },
};
