const {
  SlashCommandBuilder,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');

const flagsMap = {
  Staff: '\uD83D\uDC68\u200D\uD83D\uDCBC Discord Staff',
  Partner: '\uD83E\uDD1D Partnered Server Owner',
  Hypesquad: '\uD83C\uDFE0 HypeSquad Events',
  BugHunterLevel1: '\uD83D\uDC1B Bug Hunter Level 1',
  BugHunterLevel2: '\uD83D\uDC1B Bug Hunter Level 2',
  HypeSquadOnlineHouse1: '\uD83C\uDFE0 HypeSquad Bravery',
  HypeSquadOnlineHouse2: '\uD83C\uDFE0 HypeSquad Brilliance',
  HypeSquadOnlineHouse3: '\uD83C\uDFE0 HypeSquad Balance',
  PremiumEarlySupporter: '\u2B50 Early Supporter',
  VerifiedBot: '\u2705 Verified Bot',
  VerifiedDeveloper: '\uD83D\uDD28 Early Verified Bot Developer',
  CertifiedModerator: '\uD83D\uDEE1\uFE0F Discord Certified Moderator',
  ActiveDeveloper: '\uD83D\uDC68\u200D\uD83D\uDCBB Active Developer',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show user information')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to show info for').setRequired(false),
    ),

  name: 'userinfo',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let targetUserId, guild, replyFn, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        const optUser = interaction.options.getUser('user');
        targetUserId = optUser ? optUser.id : interaction.user.id;
        requester = interaction.user;
        replyFn = (opts) => interaction.reply(opts);
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        const mentioned = message.mentions.users.first();
        targetUserId = mentioned ? mentioned.id : message.author.id;
        requester = message.author;
        replyFn = (opts) => message.reply(opts);
      }

      const member = await guild.members.fetch(targetUserId).catch(() => null);
      if (!member) {
        return replyFn({ content: '\u274C User not found.' });
      }

      const user = await client.users.fetch(targetUserId, { force: true });
      const color = member.displayColor || 0x5865F2;

      const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString());
      const rolesDisplay = roles.length > 0
        ? roles.slice(0, 20).join(' ') + (roles.length > 20 ? ` +${roles.length - 20} more` : '')
        : 'None';

      const badges = user.flags?.toArray()
        .map((f) => flagsMap[f])
        .filter(Boolean)
        .join('\n') || 'None';

      const boostingSince = member.premiumSince
        ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:F>`
        : 'None';

      const timeoutUntil = member.communicationDisabledUntil
        ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:F>`
        : 'None';

      const serverAvatar = member.displayAvatarURL({ size: 4096, dynamic: true });
      const globalAvatar = user.displayAvatarURL({ size: 4096, dynamic: true });
      const avatarLinks = serverAvatar !== globalAvatar
        ? `[Server](${serverAvatar}) | [Global](${globalAvatar})`
        : `[Link](${globalAvatar})`;

      const embed = new EmbedBuilder()
        .setTitle(`${member.displayName} (${user.tag})`)
        .setThumbnail(member.displayAvatarURL({ size: 256, dynamic: true }))
        .setColor(color)
        .addFields(
          { name: '\uD83C\uDD94 User ID', value: user.id, inline: true },
          { name: '\uD83E\uDD16 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: '\uD83D\uDCC5 Account Created', value: `<t:${createdTimestamp}:F>`, inline: true },
          { name: '\uD83D\uDCE5 Joined Server', value: `<t:${joinedTimestamp}:F>`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '\uD83C\uDFAD Display Name', value: member.displayName, inline: true },
          { name: '\uD83C\uDF08 Top Role', value: `${member.roles.highest}`, inline: true },
          { name: '\uD83C\uDFA8 Color', value: member.displayHexColor, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: `\uD83D\uDCCB Roles (${roles.length})`, value: rolesDisplay, inline: false },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '\uD83D\uDE80 Boosting Since', value: boostingSince, inline: true },
          { name: '\u23F0 Timeout Until', value: timeoutUntil, inline: true },
          { name: '\uD83D\uDDBC\uFE0F Avatar', value: avatarLinks, inline: true },
          { name: '\uD83C\uDFF7\uFE0F Badges', value: badges, inline: true },
        )
        .setFooter({ text: `Requested by ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await replyFn({ embeds: [embed] });
    } catch (err) {
      console.error('[UserInfo]', err);
    }
  },
};
