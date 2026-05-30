const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const resolveUserGlobal = require('../../utils/resolveUserGlobal');
const { error, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('av')
    .setDescription('Show a user\'s avatar')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Select a user from the list').setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Or type a username / user ID').setRequired(false),
    ),

  name: 'av',
  aliases: ['avatar', 'pfp', 'icon'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let resolved, replyError, replySuccess, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        const guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        requester = interaction.user.username;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('av', interaction.user.id, interaction.guild.id, 3000);
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

        if (!resolved.user) {
          return replyError(error('Could not find that user. Try their @mention, username, or user ID.'));
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        requester = message.author.username;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('av', message.author.id, message.guild.id, 3000);
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

        if (!resolved.user) {
          return replyError(error('Could not find that user. Try their @mention, username, or user ID.'));
        }
      }

      const { member, user, inGuild } = resolved;

      // Avatar URLs
      const serverAvatar = inGuild
        ? member.displayAvatarURL({ size: 4096, dynamic: true })
        : null;
      const globalAvatar = user.displayAvatarURL({ size: 4096, dynamic: true });

      // Display name & color
      const displayName = inGuild ? member.displayName : user.username;
      const color = inGuild ? (member.displayColor || 0x5865F2) : 0x5865F2;

      const embeds = [];
      const components = [];

      const mainAvatar = serverAvatar || globalAvatar;
      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: user.username,
          iconURL: user.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(withEmoji('avatar', `Avatar for **${displayName}**`))
        .setImage(mainAvatar)
        .setFooter({ text: `Requested by ${(isSlash ? interactionOrMessage.user : interactionOrMessage.author).tag}` });

      embeds.push(embed);

      // Link buttons
      const buttons = [];
      const baseUrl = mainAvatar.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (user.avatar?.startsWith('a_') || member?.avatar?.startsWith('a_')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      components.push(new ActionRowBuilder().addComponents(buttons));

      // If server avatar differs from global, show both
      if (serverAvatar && globalAvatar && serverAvatar !== globalAvatar) {
        const globalEmbed = new EmbedBuilder()
          .setColor(color)
          .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({ dynamic: true }),
          })
          .setDescription(withEmoji('avatar', `Global Avatar for **${displayName}**`))
          .setImage(globalAvatar)
          .setFooter({ text: `Requested by ${(isSlash ? interactionOrMessage.user : interactionOrMessage.author).tag}` });
        embeds.push(globalEmbed);
      }

      await replySuccess({ embeds, components });
    } catch (err) {
      console.error('[Avatar]', err);
    }
  },
};
