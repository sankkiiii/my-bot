const {
  SlashCommandBuilder,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');
const resolveUserGlobal = require('../../utils/resolveUserGlobal');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

const flagsMap = {
  Staff: `${e.badge} Discord Staff`,
  Partner: `${e.badge} Partnered Server Owner`,
  Hypesquad: `${e.badge} HypeSquad Events`,
  BugHunterLevel1: `${e.badge} Bug Hunter Level 1`,
  BugHunterLevel2: `${e.badge} Bug Hunter Level 2`,
  HypeSquadOnlineHouse1: `${e.badge} HypeSquad Bravery`,
  HypeSquadOnlineHouse2: `${e.badge} HypeSquad Brilliance`,
  HypeSquadOnlineHouse3: `${e.badge} HypeSquad Balance`,
  PremiumEarlySupporter: `${e.badge} Early Supporter`,
  VerifiedBot: `${e.verified} Verified Bot`,
  VerifiedDeveloper: `${e.badge} Early Verified Bot Developer`,
  CertifiedModerator: `${e.badge} Discord Certified Moderator`,
  ActiveDeveloper: `${e.badge} Active Developer`,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show user information')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Select a user from the list').setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Or type a username / user ID').setRequired(false),
    ),

  name: 'userinfo',
  aliases: ['ui', 'whois', 'user', 'lookup'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let resolved;
      let guild;
      let replyError;
      let replySuccess;
      let requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        requester = interaction.user;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('userinfo', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        const userOption = interaction.options.getUser('user');
        const queryOption = interaction.options.getString('query');

        if (userOption) {
          const member = await guild.members.fetch(userOption.id).catch(() => null);
          const user = await client.users.fetch(userOption.id, { force: true }).catch(() => null);
          resolved = { member, user: user || userOption, inGuild: !!member };
        } else if (queryOption) {
          resolved = await resolveUserGlobal(queryOption, guild, client);
        } else {
          const member = interaction.member;
          const user = await client.users.fetch(interaction.user.id, { force: true });
          resolved = { member, user, inGuild: true };
        }

        if (!resolved.user) {
          return replyError(`${e.error} Could not find that user. Try their @mention, username, or user ID.`);
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        requester = message.author;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('userinfo', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        const input = message.mentions.users.first()?.id || args.join(' ');

        if (!input || input === '') {
          const member = message.member;
          const user = await client.users.fetch(message.author.id, { force: true });
          resolved = { member, user, inGuild: true };
        } else {
          resolved = await resolveUserGlobal(input, message.guild, client);
        }

        if (!resolved.user) {
          return replyError(`${e.error} Could not find that user. Try their @mention, username, or user ID.`);
        }
      }

      const { member, user, inGuild } = resolved;

      const fetchedUser = await client.users.fetch(user.id, { force: true });

      const badges = fetchedUser.flags?.toArray()
        .map((f) => flagsMap[f])
        .filter(Boolean) || [];

      const color = inGuild ? (member.displayColor || 0x5865F2) : 0x5865F2;
      const created = Math.floor(fetchedUser.createdTimestamp / 1000);
      const joined = inGuild ? Math.floor(member.joinedTimestamp / 1000) : null;
      const topRole = inGuild ? member.roles.highest : null;
      const hexColor = inGuild ? member.displayHexColor : null;

      const roles = inGuild ? member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString()) : [];
      const rolesDisplay = roles.length > 0
        ? roles.slice(0, 15).join(' ') + (roles.length > 15 ? ` +${roles.length - 15} more` : '')
        : '';

      const boosting = inGuild && member.premiumSince;
      const boostTimestamp = boosting ? Math.floor(member.premiumSinceTimestamp / 1000) : null;
      const timeout = inGuild && member.communicationDisabledUntil;
      const timeoutTimestamp = timeout ? Math.floor(member.communicationDisabledUntilTimestamp / 1000) : null;

      const descriptionLines = [
        `🆔 **ID:** ${fetchedUser.id}`,
        `📅 **Created:** <t:${created}:R>`,
      ];

      if (joined) descriptionLines.push(`📥 **Joined:** <t:${joined}:R>`);
      if (topRole) descriptionLines.push(`🌈 **Top Role:** ${topRole}`);
      if (hexColor) descriptionLines.push(`🎨 **Color:** ${hexColor}`);
      if (rolesDisplay) descriptionLines.push(`📋 **Roles:** ${rolesDisplay}`);
      if (boosting) descriptionLines.push(`🚀 **Boosting since:** <t:${boostTimestamp}:R>`);
      if (timeout) descriptionLines.push(`⏰ **Timeout until:** <t:${timeoutTimestamp}:R>`);
      if (badges.length > 0) descriptionLines.push(`🏷️ **Badges:** ${badges.join(' ')}`);

      if (!inGuild) {
        descriptionLines.unshift(`${e.warning} **This user is not in this server.**\n`);
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: fetchedUser.username,
          iconURL: fetchedUser.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(fetchedUser.displayAvatarURL({ size: 256, dynamic: true }))
        .setDescription(descriptionLines.join('\n'));

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[UserInfo]', err);
    }
  },
};
