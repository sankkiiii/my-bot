const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');

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

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let amount, channel, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        amount = interaction.options.getInteger('amount') || 50;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '\u274C You need the **Manage Messages** permission.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        channel = message.channel;
        amount = parseInt(args[0], 10) || 50;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return message.reply('\u274C You need the **Manage Messages** permission.');
        }

        if (amount < 1 || amount > 100) {
          return message.reply('Please provide a number between 1 and 100.');
        }
        replyFn = (content) => message.reply(content);
      }

      const fetched = await channel.messages.fetch({ limit: 100 });
      const botMessages = fetched.filter((m) => m.author.bot);
      const toDelete = [...botMessages.values()].slice(0, amount);

      if (toDelete.length === 0) {
        return replyFn('\u274C No bot messages found to delete.');
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      const reply = await (isSlash
        ? interactionOrMessage.reply({ content: `\uD83E\uDD16 Deleted **${deleted.size}** bot messages.`, ephemeral: true, fetchReply: true })
        : channel.send(`\uD83E\uDD16 Deleted **${deleted.size}** bot messages.`));

      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('[PurgeBots]', err);
    }
  },
};
