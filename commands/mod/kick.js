const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((opt) => opt.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  name: 'kick',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let targetUser, reason, guild, executor, executorMember, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        targetUser = interaction.options.getUser('user');
        reason = interaction.options.getString('reason') || 'No reason provided';
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
          return interaction.reply({ content: '\u274C You need the **Kick Members** permission to use this command.', ephemeral: true });
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

        targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('Please mention a user to kick.');
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
        return replyFn('\u274C I don\'t have the **Kick Members** permission to do this.');
      }

      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) return replyFn('Could not find that member in this server.');

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

      const embed = new EmbedBuilder()
        .setTitle('Member Kicked')
        .setColor(0xffa500)
        .addFields(
          { name: 'Action', value: 'Kick', inline: true },
          { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${executor.tag}`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setTimestamp();

      await sendLog(client, config.modLogChannel, embed);
      await replyFn(`**${targetUser.tag}** has been kicked. Reason: ${reason}`);
    } catch (err) {
      console.error('[Kick]', err);
    }
  },
};
