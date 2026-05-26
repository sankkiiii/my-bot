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

      if (!inGuild) {
        const createdTimestamp = Math.floor(fetchedUser.createdTimestamp / 1000);

        const description = [
          `${e.warning} This user is not in this server.`,
          'Showing global Discord profile only.',
          '',
          `${e.id} **${fetchedUser.id}**  •  ${e.bot} Bot: ${fetchedUser.bot ? 'Yes' : 'No'}`,
          `${e.calendar} Created: <t:${createdTimestamp}:R> (<t:${createdTimestamp}:D>)`,
        ].join('\n');

        const fields = [];

        if (badges.length > 0) {
          fields.push({ name: `${e.badge} Badges`, value: badges.join('\n'), inline: false });
        }

        const embed = new EmbedBuilder()
          .setTitle(`${fetchedUser.username} (Not in server)`)
          .setThumbnail(fetchedUser.displayAvatarURL({ size: 256, dynamic: true }))
          .setColor(0x5865F2)
          .setDescription(description)
          .setFooter({ text: `Requested by ${requester.username} • Not a server member`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
          .setTimestamp();

        if (fields.length > 0) {
          embed.addFields(fields);
        }

        return replySuccess({ embeds: [embed] });
      }

      const color = member.displayColor || 0x5865F2;
      const createdTimestamp = Math.floor(fetchedUser.createdTimestamp / 1000);
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString());
      const rolesDisplay = roles.length > 0
        ? roles.slice(0, 15).join(' ') + (roles.length > 15 ? ` +${roles.length - 15} more` : '')
        : 'None';

      const description = [
        `${e.id} **${fetchedUser.id}**  •  ${e.bot} Bot: ${fetchedUser.bot ? 'Yes' : 'No'}`,
        `${e.calendar} Created: <t:${createdTimestamp}:R> (<t:${createdTimestamp}:D>)`,
        `${e.join} Joined: <t:${joinedTimestamp}:R> (<t:${joinedTimestamp}:D>)`,
      ].join('\n');

      const fields = [
        { name: `${e.user} Display Name`, value: member.displayName, inline: true },
        { name: `${e.role} Top Role`, value: `${member.roles.highest}`, inline: true },
        { name: `${e.color} Color`, value: member.displayHexColor, inline: true },
        { name: `${e.role} Roles (${roles.length})`, value: rolesDisplay, inline: false },
      ];

      if (member.premiumSince) {
        const boostTimestamp = Math.floor(member.premiumSinceTimestamp / 1000);
        fields.push({ name: `${e.boost} Boosting`, value: `<t:${boostTimestamp}:R>`, inline: true });
      }

      if (member.communicationDisabledUntil) {
        const timeoutTimestamp = Math.floor(member.communicationDisabledUntilTimestamp / 1000);
        fields.push({ name: `${e.info} Timeout`, value: `<t:${timeoutTimestamp}:R>`, inline: true });
      }

      if (badges.length > 0) {
        fields.push({ name: `${e.badge} Badges`, value: badges.join('\n'), inline: false });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${member.displayName} (${fetchedUser.username})`)
        .setThumbnail(member.displayAvatarURL({ size: 256, dynamic: true }))
        .setColor(color)
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: `Requested by ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[UserInfo]', err);
    }
  },
};
