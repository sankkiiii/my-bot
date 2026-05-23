const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purge',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let amount, channel, executor, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        executor = interaction.user;
        amount = interaction.options.getInteger('amount');
        replyFn = (content) => interaction.reply({ content, ephemeral: true });
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        channel = message.channel;
        executor = message.author;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return message.reply('You do not have permission to manage messages.');
        }

        amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return message.reply('Please provide a number between 1 and 100.');
        }
        replyFn = (content) => message.reply(content);
      }

      const deleted = await channel.bulkDelete(amount, true);

      const embed = new EmbedBuilder()
        .setTitle('Messages Purged')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Action', value: 'Purge', inline: true },
          { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
          { name: 'Moderator', value: `${executor.tag}`, inline: true },
          { name: 'Messages Deleted', value: `${deleted.size}` },
        )
        .setTimestamp();

      await sendLog(client, config.modLogChannel, embed);
      await replyFn(`Deleted **${deleted.size}** messages.`);
    } catch (err) {
      console.error('[Purge]', err);
    }
  },
};
