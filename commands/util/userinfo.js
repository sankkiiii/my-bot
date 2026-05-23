const {
  SlashCommandBuilder,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');

const flagsMap = {
  Staff: '👨‍💼 Discord Staff',
  Partner: '🤝 Partnered Server Owner',
  Hypesquad: '🏠 HypeSquad Events',
  BugHunterLevel1: '🐛 Bug Hunter Level 1',
  BugHunterLevel2: '🐛 Bug Hunter Level 2',
  HypeSquadOnlineHouse1: '🏠 HypeSquad Bravery',
  HypeSquadOnlineHouse2: '🏠 HypeSquad Brilliance',
  HypeSquadOnlineHouse3: '🏠 HypeSquad Balance',
  PremiumEarlySupporter: '⭐ Early Supporter',
  VerifiedBot: '✅ Verified Bot',
  VerifiedDeveloper: '🔨 Early Verified Bot Developer',
  CertifiedModerator: '🛡️ Discord Certified Moderator',
  ActiveDeveloper: '👨‍💻 Active Developer',
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

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let member, guild, replyFn, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        requester = interaction.user;
        replyFn = (opts) => interaction.reply(opts);

        const userOption = interaction.options.getUser('user');
        const queryOption = interaction.options.getString('query');

        if (userOption) {
          member = await guild.members.fetch(userOption.id).catch(() => null);
        } else if (queryOption) {
          member = await resolveUser(queryOption, guild);
        } else {
          member = await guild.members.fetch(interaction.user.id);
        }

        if (!member) {
          return interaction.reply({ content: '❌ Could not find that user. Try their @mention, username, or user ID.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        requester = message.author;
        replyFn = (opts) => message.reply(opts);

        const input = message.mentions.members.first()
          ? message.mentions.members.first().id
          : args.join(' ');

        if (input) {
          member = await resolveUser(input, guild);
        } else {
          member = await guild.members.fetch(message.author.id);
        }

        if (!member) {
          return message.reply('❌ Could not find that user. Try their @mention, username, or user ID.');
        }
      }

      const user = await client.users.fetch(member.id, { force: true });
      const color = member.displayColor || 0x5865F2;

      const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString());
      const rolesDisplay = roles.length > 0
        ? roles.slice(0, 15).join(' ') + (roles.length > 15 ? ` +${roles.length - 15} more` : '')
        : 'None';

      const badges = user.flags?.toArray()
        .map((f) => flagsMap[f])
        .filter(Boolean) || [];

      // Build compact description
      const description = [
        `🆔 **${user.id}**  •  🤖 Bot: ${user.bot ? 'Yes' : 'No'}`,
        `📅 Created: <t:${createdTimestamp}:R> (<t:${createdTimestamp}:D>)`,
        `📥 Joined: <t:${joinedTimestamp}:R> (<t:${joinedTimestamp}:D>)`,
      ].join('\n');

      // Build fields array — only add fields that have real values
      const fields = [
        { name: '🎭 Display Name', value: member.displayName, inline: true },
        { name: '🌈 Top Role', value: `${member.roles.highest}`, inline: true },
        { name: '🎨 Color', value: member.displayHexColor, inline: true },
        { name: `📋 Roles (${roles.length})`, value: rolesDisplay, inline: false },
      ];

      // Boosting — only if actively boosting
      if (member.premiumSince) {
        const boostTimestamp = Math.floor(member.premiumSinceTimestamp / 1000);
        fields.push({ name: '🚀 Boosting', value: `<t:${boostTimestamp}:R>`, inline: true });
      }

      // Timeout — only if currently timed out
      if (member.communicationDisabledUntil) {
        const timeoutTimestamp = Math.floor(member.communicationDisabledUntilTimestamp / 1000);
        fields.push({ name: '⏰ Timeout', value: `<t:${timeoutTimestamp}:R>`, inline: true });
      }

      // Badges — only if user has any
      if (badges.length > 0) {
        fields.push({ name: '🏷️ Badges', value: badges.join('\n'), inline: false });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${member.displayName} (${user.username})`)
        .setThumbnail(member.displayAvatarURL({ size: 256, dynamic: true }))
        .setColor(color)
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: `Requested by ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await replyFn({ embeds: [embed] });
    } catch (err) {
      console.error('[UserInfo]', err);
    }
  },
};
