const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((opt) => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  name: 'ban',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

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

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return interaction.reply({ content: '\u274C You need the **Ban Members** permission to use this command.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        executor = message.author;
        executorMember = message.member;

        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return message.reply('\u274C You need the **Ban Members** permission to use this command.');
        }

        targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('Please mention a user to ban.');
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return replyFn('\u274C I don\'t have the **Ban Members** permission to do this.');
      }

      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) return replyFn('Could not find that member in this server.');

      if (member.roles.highest.position >= executorMember.roles.highest.position) {
        return replyFn('\u274C You cannot moderate someone with an equal or higher role than you.');
      }

      if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
        return replyFn('\u274C I cannot moderate this user as their role is higher than or equal to mine.');
      }

      try {
        await targetUser.send(`You have been **banned** from **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (_) { /* DMs may be disabled */ }

      await member.ban({ reason });

      const embed = new EmbedBuilder()
        .setTitle('Member Banned')
        .setColor(0xff0000)
        .addFields(
          { name: 'Action', value: 'Ban', inline: true },
          { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${executor.tag}`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setTimestamp();

      await sendLog(client, config.modLogChannel, embed);
      await replyFn(`**${targetUser.tag}** has been banned. Reason: ${reason}`);
    } catch (err) {
      console.error('[Ban]', err);
    }
  },
};
