const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  CommandInteraction,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Show a user\'s profile banner')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to show banner for').setRequired(false),
    ),

  name: 'banner',

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
        requester = interaction.user.username;
        replyFn = (opts) => interaction.reply(opts);
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        const mentioned = message.mentions.users.first();
        targetUserId = mentioned ? mentioned.id : message.author.id;
        requester = message.author.username;
        replyFn = (opts) => message.reply(opts);
      }

      const fetchedUser = await client.users.fetch(targetUserId, { force: true });
      const member = await guild.members.fetch(targetUserId).catch(() => null);
      const displayName = member?.displayName || fetchedUser.displayName || fetchedUser.username;

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
