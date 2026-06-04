const {
  SlashCommandBuilder,
  EmbedBuilder,
  CommandInteraction,
  PermissionFlagsBits,
} = require('discord.js');
const resolveUserGlobal = require('../../utils/resolveUserGlobal');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { error, withEmoji } = require('../../utils/emoji');

const flagsMap = {
  Staff: 'Discord Staff',
  Partner: 'Partnered Owner',
  Hypesquad: 'HypeSquad Events',
  BugHunterLevel1: 'Bug Hunter',
  BugHunterLevel2: 'Bug Hunter Gold',
  HypeSquadOnlineHouse1: 'Bravery',
  HypeSquadOnlineHouse2: 'Brilliance',
  HypeSquadOnlineHouse3: 'Balance',
  PremiumEarlySupporter: 'Early Supporter',
  VerifiedBot: 'Verified Bot',
  VerifiedDeveloper: 'Early Bot Dev',
  CertifiedModerator: 'Certified Mod',
  ActiveDeveloper: 'Active Developer',
};

const permMap = {
  Administrator: 'Administrator',
  KickMembers: 'Kick Members',
  BanMembers: 'Ban Members',
  ManageChannels: 'Manage Channels',
  ManageMessages: 'Manage Messages',
  MentionEveryone: 'Mention Everyone',
  ManageNicknames: 'Manage Nicknames',
  ManageRoles: 'Manage Roles',
  ManageWebhooks: 'Manage Webhooks',
  ManageEmojisAndStickers: 'Manage Emojis',
  ModerateMembers: 'Moderate Members',
  ViewAuditLog: 'View Audit Log',
  ManageGuild: 'Manage Server',
  ManageThreads: 'Manage Threads',
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
  aliases: ['whois', 'user', 'lookup'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let resolved;
      let guild;
      let replyError;
      let replySuccess;
      let executor;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        executor = interaction.user;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('userinfo', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
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
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        executor = message.author;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('userinfo', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }

        const input = message.mentions.users.first()?.id || args.join(' ');

        if (!input || input === '') {
          const member = message.member;
          const user = await client.users.fetch(message.author.id, { force: true });
          resolved = { member, user, inGuild: true };
        } else {
          resolved = await resolveUserGlobal(input, message.guild, client);
        }
      }

      if (!resolved.user) {
        return replyError(error('Could not find that user.'));
      }

      const { member, user, inGuild } = resolved;
      const fetchedUser = await client.users.fetch(user.id, { force: true });
      const createdTimestamp = Math.floor(fetchedUser.createdTimestamp / 1000);
      const badges = fetchedUser.flags?.toArray()
        .map((f) => flagsMap[f])
        .filter(Boolean)
        .join(', ') || 'None';

      const color = inGuild ? (member.displayHexColor || 0x5865F2) : 0x5865F2;

      let description = '';

      if (!inGuild) {
        description = `**General Information**
Name: ${fetchedUser.username}
ID: ${fetchedUser.id}
Bot: ${fetchedUser.bot ? '✅' : '❌'}

**Account Info**
Badges: ${badges}
Created: <t:${createdTimestamp}:R>

${withEmoji('warning', 'This user is not in this server.')}`;

        const embed = new EmbedBuilder()
          .setColor(color)
          .setAuthor({
            name: `${fetchedUser.username}'s Information`,
            iconURL: guild.iconURL({ dynamic: true }),
          })
          .setThumbnail(fetchedUser.displayAvatarURL({ size: 256, dynamic: true }))
          .setDescription(description)
          .setFooter({ text: `Requested by ${executor.tag}` });

        return await replySuccess({ embeds: [embed] });
      }

      // Guild user
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position);
      const roleCount = roles.size;
      const rolesDisplay = roles.size > 0
        ? roles.map((r) => r.toString()).slice(0, 10).join(', ') + (roles.size > 10 ? ` +${roles.size - 10} more` : '')
        : 'None';

      const keyPerms = Object.entries(permMap)
        .filter(([perm]) => member.permissions.has(PermissionFlagsBits[perm]))
        .map(([, label]) => label)
        .join(', ');
      const keyPermissions = keyPerms || 'None';

      let acknowledgement = 'Server Member';
      if (member.id === guild.ownerId) acknowledgement = 'Server Owner';
      else if (member.permissions.has(PermissionFlagsBits.Administrator)) acknowledgement = 'Server Administrator';
      else if (member.permissions.has(PermissionFlagsBits.ManageGuild)) acknowledgement = 'Server Manager';
      else if (member.permissions.has(PermissionFlagsBits.ManageMessages)) acknowledgement = 'Server Moderator';

      description = `**General Information**
Name: ${fetchedUser.username}
ID: ${fetchedUser.id}
Nickname: ${member.nickname || 'None'}
Bot: ${fetchedUser.bot ? '✅' : '❌'}

**Account Info**
Badges: ${badges}
Created: <t:${createdTimestamp}:R>
Joined: <t:${joinedTimestamp}:R>

**Role Info**
Roles [${roleCount}]: ${rolesDisplay}
Color: ${member.displayHexColor}

**Extra**
Acknowledgement: ${acknowledgement}
Boosting: ${member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : 'No'}

**Key Permissions**
${keyPermissions}`;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: `${member.displayName}'s Information`,
          iconURL: guild.iconURL({ dynamic: true }),
        })
        .setThumbnail(member.displayAvatarURL({ size: 256, dynamic: true }))
        .setDescription(description)
        .setFooter({ text: `Requested by ${executor.tag}` });

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[UserInfo]', err);
    }
  },
};
