const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purgeuser')
    .setDescription('Purge last X messages from a specific user')
    .addUserOption((opt) =>
      opt.setName('user')
        .setDescription('User whose messages to delete')
        .setRequired(true),
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
      let targetUserId, amount, channel, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        const targetUser = interaction.options.getUser('user');
        targetUserId = targetUser.id;
        amount = interaction.options.getInteger('amount') || 50;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '\u274C You need the **Manage Messages** permission.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        channel = message.channel;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return message.reply('\u274C You need the **Manage Messages** permission.');
        }

        const mentioned = message.mentions.users.first();
        if (!mentioned) {
          return message.reply('\u274C Please mention a user. Usage: `!purgeuser @user [amount]`');
        }
        targetUserId = mentioned.id;
        amount = parseInt(args[1], 10) || 50;

        if (amount < 1 || amount > 100) {
          return message.reply('Please provide a number between 1 and 100.');
        }
        replyFn = (content) => message.reply(content);
      }

      const fetched = await channel.messages.fetch({ limit: 100 });
      const userMessages = fetched.filter((m) => m.author.id === targetUserId);
      const toDelete = [...userMessages.values()].slice(0, amount);

      if (toDelete.length === 0) {
        return replyFn('\u274C No messages found from that user.');
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      const member = await channel.guild.members.fetch(targetUserId).catch(() => null);
      const displayName = member?.displayName || 'that user';

      const reply = await (isSlash
        ? interactionOrMessage.reply({ content: `\uD83D\uDDD1\uFE0F Deleted **${deleted.size}** messages from **${displayName}**.`, ephemeral: true, fetchReply: true })
        : channel.send(`\uD83D\uDDD1\uFE0F Deleted **${deleted.size}** messages from **${displayName}**.`));

      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('[PurgeUser]', err);
    }
  },
};
