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
      let targetUser, reason, guild, executor, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        targetUser = interaction.options.getUser('user');
        reason = interaction.options.getString('reason') || 'No reason provided';
        replyFn = (content) => interaction.reply({ content, ephemeral: true });
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        executor = message.author;

        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return message.reply('You do not have permission to ban members.');
        }

        targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('Please mention a user to ban.');
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);
      }

      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) return replyFn('Could not find that member in this server.');
      if (!member.bannable) return replyFn('I cannot ban this user. They may have a higher role than me.');

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
