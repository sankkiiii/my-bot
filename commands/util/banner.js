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
    .setName('banner')
    .setDescription('Show a user\'s profile banner')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Select a user from the list').setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Or type a username / user ID').setRequired(false),
    ),

  name: 'banner',
  aliases: ['userbanner', 'profilebanner'],

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

      const fetchedUser = await client.users.fetch(member.id, { force: true });
      const displayName = member.displayName;

      if (!fetchedUser.banner) {
        return replyFn({ content: `\u274C **${displayName}** does not have a profile banner.`, ephemeral: true });
      }

      const bannerUrl = fetchedUser.bannerURL({ size: 4096, dynamic: true });
      const color = fetchedUser.accentColor || 0x5865F2;

      const embed = new EmbedBuilder()
        .setTitle(`${displayName}'s Banner`)
        .setColor(color)
        .setImage(bannerUrl)
        .setFooter({ text: `Requested by ${requester}` });

      const buttons = [];
      const baseUrl = bannerUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (fetchedUser.banner?.startsWith('a_')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      const row = new ActionRowBuilder().addComponents(buttons);

      await replyFn({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[Banner]', err);
    }
  },
};
