const { SlashCommandBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Select user from list').setRequired(false))
    .addStringOption((opt) => opt.setName('query').setDescription('Or type username / user ID').setRequired(false))
    .addIntegerOption((opt) =>
      opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  name: 'mute',
  aliases: ['timeout'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let member, targetUser, durationMinutes, reason, guild, executor, executorMember, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        durationMinutes = interaction.options.getInteger('duration');
        reason = interaction.options.getString('reason') || 'No reason provided';
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return interaction.reply({ content: '\u274C You need the **Timeout Members** permission to use this command.', ephemeral: true });
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');

        if (!userOption && !query) {
          return interaction.reply({ content: '\u274C Please provide a user (select or type username/ID).', ephemeral: true });
        }

        if (userOption) {
          member = await guild.members.fetch(userOption.id).catch(() => null);
          targetUser = userOption;
        } else {
          member = await resolveUser(query, guild);
          if (member) {
            targetUser = member.user;
          }
        }

        if (!member) {
          return replyFn('\u274C Could not find that user in this server.');
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

        if (!args[0]) return message.reply('Please provide a user to mute.');

        const input = args[0];
        member = await resolveUser(input, guild);
        replyFn = (content) => message.reply(content);

        if (!member) {
          return replyFn('\u274C Could not find that user in this server.');
        }
        targetUser = member.user;

        durationMinutes = parseInt(args[1], 10);
        if (isNaN(durationMinutes) || durationMinutes < 1) {
          return message.reply('Please provide a valid duration in minutes. Usage: `!mute <user> <minutes> [reason]`');
        }
        reason = args.slice(2).join(' ') || 'No reason provided';
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return replyFn('\u274C I don\'t have the **Timeout Members** permission to do this.');
      }

      const durationMs = Math.min(durationMinutes * 60 * 1000, MAX_TIMEOUT_MS);

      if (!isOwner && member.roles.highest.position >= executorMember.roles.highest.position) {
        return replyFn('\u274C You cannot moderate someone with an equal or higher role than you.');
      }

      if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
        return replyFn('\u274C I cannot moderate this user as their role is higher than or equal to mine.');
      }

      await member.timeout(durationMs, reason);

      await replyFn(`**${targetUser.tag}** has been muted for ${durationMinutes} minute(s). Reason: ${reason}`);
    } catch (err) {
      console.error('[Mute]', err);
    }
  },
};
