const { SlashCommandBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Select user from list').setRequired(false))
    .addStringOption((opt) => opt.setName('query').setDescription('Or type username / user ID').setRequired(false))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the warning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  name: 'warn',
  aliases: ['warning'],

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
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return interaction.reply({ content: '\u274C You need the **Timeout Members** permission to use this command.', ephemeral: true });
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');
        reason = interaction.options.getString('reason') || 'No reason provided';

        if (!userOption && !query) {
          return interaction.reply({ content: '\u274C Please provide a user (select or type username/ID).', ephemeral: true });
        }

        if (userOption) {
          targetUser = userOption;
        } else {
          const member = await resolveUser(query, guild);
          if (member) {
            targetUser = member.user;
          }
        }

        if (!targetUser) {
          return replyFn('\u274C Could not find that user.');
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        executor = message.author;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return message.reply('\u274C You need the **Timeout Members** permission to use this command.');
        }

        if (!args[0]) return message.reply('Please provide a user to warn.');

        const input = args[0];
        const member = await resolveUser(input, guild);
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);

        if (!member) {
          return replyFn('\u274C Could not find that user.');
        }
        targetUser = member.user;
      }

      try {
        await targetUser.send(`You have been **warned** in **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (_) { /* DMs may be disabled */ }

      await replyFn(`**${targetUser.username}** has been warned. Reason: ${reason}`);
    } catch (err) {
      console.error('[Warn]', err);
    }
  },
};
