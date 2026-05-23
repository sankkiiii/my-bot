const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption((opt) => opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the warning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  name: 'warn',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let targetUser, reason, guild, executor, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        targetUser = interaction.options.getUser('user');
        reason = interaction.options.getString('reason') || 'No reason provided';
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return interaction.reply({ content: '\u274C You need the **Timeout Members** permission to use this command.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        executor = message.author;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply('\u274C You need the **Timeout Members** permission to use this command.');
        }

        targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('Please mention a user to warn.');
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);
      }

      try {
        await targetUser.send(`You have been **warned** in **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (_) { /* DMs may be disabled */ }

      const embed = new EmbedBuilder()
        .setTitle('Member Warned')
        .setColor(0xff9900)
        .addFields(
          { name: 'Action', value: 'Warn', inline: true },
          { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${executor.tag}`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setTimestamp();

      await sendLog(client, config.modLogChannel, embed);
      await replyFn(`**${targetUser.tag}** has been warned. Reason: ${reason}`);
    } catch (err) {
      console.error('[Warn]', err);
    }
  },
};
