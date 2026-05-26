const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a nickname')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to rename (leave empty for yourself)')
        .setRequired(false),
    )
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('New nickname (leave empty to clear)')
        .setMaxLength(32)
        .setRequired(false),
    ),
  name: 'nick',
  aliases: ['nickname', 'setnick', 'changenick'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let target;
      let nickname;
      let guild;
      let executor;
      let executorMember;
      let replyError;
      let replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (payload) => slashSuccess(interaction, payload);

        const remaining = cooldown.check('nick', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        const userOpt = interaction.options.getUser('user');
        nickname = interaction.options.getString('name') || null;
        target = userOpt
          ? await interaction.guild.members.fetch(userOpt.id).catch(() => null)
          : interaction.member;
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient || [];
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        guild = message.guild;
        executor = message.author;
        executorMember = message.member;
        replyError = (content) => prefixError(message, content);
        replySuccess = (payload) => prefixSuccess(message, payload);

        const remaining = cooldown.check('nick', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        const mentioned = message.mentions.members.first();
        if (mentioned) {
          target = mentioned;
          nickname = args.slice(1).join(' ') || null;
        } else {
          target = message.member;
          nickname = args.join(' ') || null;
        }
      }

      if (!target) return replyError(`${e.error} User not found.`);

      const isSelf = target.id === (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id);

      if (isSelf) {
        const memberPerms = executorMember.permissions;
        const hasPerms = memberPerms.has(PermissionFlagsBits.ChangeNickname)
          || memberPerms.has(PermissionFlagsBits.ManageNicknames);
        if (!hasPerms) {
          return replyError(`${e.error} You need **Change Nickname** permission.`);
        }
      } else {
        if (!executorMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
          return replyError(`${e.error} You need **Manage Nicknames** permission.`);
        }
        if (!isOwner && target.roles.highest.position >= executorMember.roles.highest.position) {
          return replyError(`${e.error} You cannot change the nickname of someone with an equal or higher role.`);
        }
        if (target.id === target.guild.ownerId) {
          return replyError(`${e.error} Cannot change the server owner's nickname.`);
        }
      }

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return replyError(`${e.error} I need **Manage Nicknames** permission.`);
      }
      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return replyError(`${e.error} I cannot change this user's nickname (role too high).`);
      }

      await target.setNickname(
        nickname,
        `Changed by ${executorMember.user?.tag || executor.tag}`,
      );

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({
          name: nickname
            ? `${target.user.tag}'s nickname has been set to ${nickname}`
            : `${target.user.tag}'s nickname has been cleared and set to ${target.user.username}`,
          iconURL: target.user.displayAvatarURL({ dynamic: true }),
        })
        .setFooter({ text: `Changed by ${executorMember.user?.tag || executor.tag}` })
        .setTimestamp();

      return replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[Nick]', err);
    }
  },
};
