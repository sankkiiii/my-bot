const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');
const e = require('../../config/emojis');

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
      let targetUser;
      let reason;
      let guild;
      let executor;
      let replyError;
      let replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return interaction.reply({
            content: 'This command only works in a server.',
            ephemeral: true,
          });
        }
        guild = interaction.guild;
        executor = interaction.user;
        replyError = (content) => interaction.reply({ content, ephemeral: true });
        replySuccess = (payload) => interaction.reply(payload);

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return replyError(`${e.error} You need the **Timeout Members** permission to use this command.`);
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');
        reason = interaction.options.getString('reason') || 'No reason provided';

        if (!userOption && !query) {
          return replyError(`${e.error} Please provide a user (select or type username/ID).`);
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
          return replyError(`${e.error} Could not find that user.`);
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return message.reply('This command only works in a server.');
        }
        guild = message.guild;
        executor = message.author;
        replyError = (content) => message.reply(content);
        replySuccess = (payload) => message.reply(payload);

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return replyError(`${e.error} You need the **Timeout Members** permission to use this command.`);
        }

        if (!args[0]) return replyError(`${e.error} Please provide a user to warn.`);

        const input = args[0];
        const member = await resolveUser(input, guild);
        reason = args.slice(1).join(' ') || 'No reason provided';

        if (!member) {
          return replyError(`${e.error} Could not find that user.`);
        }
        targetUser = member.user;
      }

      try {
        await targetUser.send(`You have been **warned** in **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (err) {
        console.error('[Warn DM Error]', err);
      }

      const targetTag = targetUser.tag || targetUser.username;
      const moderatorTag = executor.tag || executor.username;
      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setAuthor({
          name: `Warning | ${targetTag}`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .addFields(
          { name: `${e.user} User`, value: `${targetUser} (${targetTag})`, inline: true },
          { name: `${e.id} ID`, value: targetUser.id, inline: true },
          { name: `${e.warn} Reason`, value: reason, inline: false },
          { name: `${e.user} Moderator`, value: `${executor}`, inline: true },
        )
        .setFooter({ text: `Action by ${moderatorTag}` })
        .setTimestamp();

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[Warn]', err);
    }
  },
};
