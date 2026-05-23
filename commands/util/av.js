const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');

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

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let member, guild, replyFn, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        requester = interaction.user.username;
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
          return interaction.reply({ content: '\u274C Could not find that user. Try their @mention, username, or user ID.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        requester = message.author.username;
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
          return message.reply('\u274C Could not find that user. Try their @mention, username, or user ID.');
        }
      }

      const targetUser = await client.users.fetch(member.id, { force: true });
      const globalAvatar = targetUser.displayAvatarURL({ size: 4096, dynamic: true });
      const serverAvatar = member.displayAvatarURL({ size: 4096, dynamic: true });
      const displayName = member.displayName;
      const color = member.displayColor || 0x5865F2;

      const embeds = [];
      const components = [];

      const mainAvatar = serverAvatar || globalAvatar;
      const embed = new EmbedBuilder()
        .setTitle(`${displayName}'s Avatar`)
        .setColor(color)
        .setImage(mainAvatar)
        .setFooter({ text: `Requested by ${requester}` });
      embeds.push(embed);

      const buttons = [];
      const baseUrl = mainAvatar.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (targetUser.avatar?.startsWith('a_') || member.avatar?.startsWith('a_')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      components.push(new ActionRowBuilder().addComponents(buttons));

      if (serverAvatar && globalAvatar && serverAvatar !== globalAvatar) {
        const globalEmbed = new EmbedBuilder()
          .setTitle(`${displayName}'s Global Avatar`)
          .setColor(color)
          .setImage(globalAvatar);
        embeds.push(globalEmbed);
      }

      await replyFn({ embeds, components });
    } catch (err) {
      console.error('[Avatar]', err);
    }
  },
};
