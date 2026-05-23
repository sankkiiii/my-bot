const { SlashCommandBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((opt) => opt.setName('user').setDescription('Select user from list').setRequired(false))
    .addStringOption((opt) => opt.setName('query').setDescription('Or type username / user ID').setRequired(false))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  name: 'kick',
  aliases: ['remove'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let member, targetUser, reason, guild, executor, executorMember, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
          return interaction.reply({ content: '\u274C You need the **Kick Members** permission to use this command.', ephemeral: true });
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');
        reason = interaction.options.getString('reason') || 'No reason provided';

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

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
          return message.reply('\u274C You need the **Kick Members** permission to use this command.');
        }

        if (!args[0]) return message.reply('Please provide a user to kick.');

        const input = args[0];
        member = await resolveUser(input, guild);
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);

        if (!member) {
          return replyFn('\u274C Could not find that user in this server.');
        }
        targetUser = member.user;
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
        return replyFn('\u274C I don\'t have the **Kick Members** permission to do this.');
      }

      if (!isOwner && member.roles.highest.position >= executorMember.roles.highest.position) {
        return replyFn('\u274C You cannot moderate someone with an equal or higher role than you.');
      }

      if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
        return replyFn('\u274C I cannot moderate this user as their role is higher than or equal to mine.');
      }

      try {
        await targetUser.send(`You have been **kicked** from **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (_) { /* DMs may be disabled */ }

      await member.kick(reason);

      await replyFn(`**${targetUser.username}** has been kicked. Reason: ${reason}`);
    } catch (err) {
      console.error('[Kick]', err);
    }
  },
};
