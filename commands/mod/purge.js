const { SlashCommandBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
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
      let amount, channel, executor, guild, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        guild = interaction.guild;
        executor = interaction.user;
        amount = interaction.options.getInteger('amount');
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({
            content: `${e.error} You need the **Manage Messages** permission to use this command.`,
            ephemeral: true,
          });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        channel = message.channel;
        guild = message.guild;
        executor = message.author;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return message.reply(`${e.error} You need the **Manage Messages** permission to use this command.`);
        }

        amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return message.reply('Please provide a number between 1 and 100.');
        }
        replyFn = (content) => message.reply(content);
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return replyFn(`${e.error} I don't have the **Manage Messages** permission to do this.`);
      }

      const deleted = await channel.bulkDelete(amount, true);

      try {
        await replyFn(`Deleted **${deleted.size}** messages.`);
      } catch {
        await channel.send(`Deleted **${deleted.size}** messages.`).catch(() => {});
      }
    } catch (err) {
      console.error('[Purge]', err);
    }
  },
};
