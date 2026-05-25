const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
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
        replyError = (content) => interaction.reply({ content, ephemeral: true });
        replySuccess = (payload) => interaction.reply(payload);

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
        replyError = (content) => message.reply(content);
        replySuccess = (payload) => message.reply(payload);

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

      const deleted = await channel.bulkDelete(amount, true);

      const moderatorTag = executor.tag || executor.username;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setDescription(`${e.purge} Deleted **${deleted.size}** messages`)
        .setFooter({ text: `Requested by ${moderatorTag}` });

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[Purge]', err);
    }
  },
};
