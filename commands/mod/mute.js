const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const resolveUser = require('../../utils/resolveUser');
const e = require('../../config/emojis');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    // Required options MUST come before optional ones (Discord API requirement)
    .addIntegerOption((opt) =>
      opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addUserOption((opt) => opt.setName('user').setDescription('Select user from list').setRequired(false))
    .addStringOption((opt) => opt.setName('query').setDescription('Or type username / user ID').setRequired(false))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  name: 'mute',
  aliases: ['timeout'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let member;
      let targetUser;
      let durationMinutes;
      let reason;
      let guild;
      let executor;
      let executorMember;
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
        executorMember = interaction.member;
        durationMinutes = interaction.options.getInteger('duration');
        reason = interaction.options.getString('reason') || 'No reason provided';
        replyError = (content) => slashError(interaction, content);
        replySuccess = (payload) => slashSuccess(interaction, payload);

        const remaining = cooldown.check('mute', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return replyError(`${e.error} You need the **Timeout Members** permission to use this command.`);
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');

        if (!userOption && !query) {
          return replyError(`${e.error} Please provide a user (select or type username/ID).`);
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
          return replyError(`${e.error} Could not find that user in this server.`);
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return message.reply('This command only works in a server.');
        }
        guild = message.guild;
        executor = message.author;
        executorMember = message.member;
        replyError = (content) => prefixError(message, content);
        replySuccess = (payload) => prefixSuccess(message, payload);

        const remaining = cooldown.check('mute', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return replyError(`${e.error} You need the **Timeout Members** permission to use this command.`);
        }

        if (!args[0]) return replyError(`${e.error} Please provide a user to mute.`);

        const input = args[0];
        member = await resolveUser(input, guild);
        if (!member) {
          return replyError(`${e.error} Could not find that user in this server.`);
        }
        targetUser = member.user;

        durationMinutes = parseInt(args[1], 10);
        if (isNaN(durationMinutes) || durationMinutes < 1) {
          return replyError(`${e.error} Please provide a valid duration in minutes. Usage: \`!mute <user> <minutes> [reason]\``);
        }
        reason = args.slice(2).join(' ') || 'No reason provided';
      }

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return replyError(`${e.error} I don't have the **Timeout Members** permission to do this.`);
      }

      const durationMs = Math.min(durationMinutes * 60 * 1000, MAX_TIMEOUT_MS);

      if (!isOwner && member.roles.highest.position >= executorMember.roles.highest.position) {
        return replyError(`${e.error} You cannot moderate someone with an equal or higher role than you.`);
      }

      if (member.roles.highest.position >= botMember.roles.highest.position) {
        return replyError(`${e.error} I cannot moderate this user as their role is higher than or equal to mine.`);
      }

      await member.timeout(durationMs, reason);

      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(`🔇 | Muted **${targetUser.tag}** for **${durationMinutes}m**\n**Reason:** ${reason}`);

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[Mute]', err);
    }
  },
};
