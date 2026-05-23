const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const { sendLog } = require('../../utils/logger');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    .addUserOption((opt) => opt.setName('user').setDescription('The user to mute').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  name: 'mute',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let targetUser, durationMinutes, reason, guild, executor, executorMember, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        targetUser = interaction.options.getUser('user');
        durationMinutes = interaction.options.getInteger('duration');
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
        executorMember = message.member;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply('\u274C You need the **Timeout Members** permission to use this command.');
        }

        targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('Please mention a user to mute.');
        durationMinutes = parseInt(args[1], 10);
        if (isNaN(durationMinutes) || durationMinutes < 1) {
          return message.reply('Please provide a valid duration in minutes. Usage: `!mute @user <minutes> [reason]`');
        }
        reason = args.slice(2).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return replyFn('\u274C I don\'t have the **Timeout Members** permission to do this.');
      }

      const durationMs = Math.min(durationMinutes * 60 * 1000, MAX_TIMEOUT_MS);
      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) return replyFn('Could not find that member in this server.');

      if (!isOwner && member.roles.highest.position >= executorMember.roles.highest.position) {
        return replyFn('\u274C You cannot moderate someone with an equal or higher role than you.');
      }

      if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
        return replyFn('\u274C I cannot moderate this user as their role is higher than or equal to mine.');
      }

      await member.timeout(durationMs, reason);

      const embed = new EmbedBuilder()
        .setTitle('Member Muted')
        .setColor(0xffcc00)
        .addFields(
          { name: 'Action', value: 'Mute (Timeout)', inline: true },
          { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${executor.tag}`, inline: true },
          { name: 'Duration', value: `${durationMinutes} minute(s)`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setTimestamp();

      await sendLog(client, config.modLogChannel, embed);
      await replyFn(`**${targetUser.tag}** has been muted for ${durationMinutes} minute(s). Reason: ${reason}`);
    } catch (err) {
      console.error('[Mute]', err);
    }
  },
};
