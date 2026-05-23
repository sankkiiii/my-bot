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
    .setName('serverbanner')
    .setDescription('Show the server banner'),

  name: 'serverbanner',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let guild, replyFn, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        requester = interaction.user.username;
        replyFn = (opts) => interaction.reply(opts);
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        requester = message.author.username;
        replyFn = (opts) => message.reply(opts);
      }

      if (!guild.banner) {
        return replyFn({ content: '\u274C This server does not have a banner.' });
      }

      const bannerUrl = guild.bannerURL({ size: 4096, dynamic: true });

      const embed = new EmbedBuilder()
        .setTitle(`${guild.name}'s Banner`)
        .setColor(0x5865F2)
        .setImage(bannerUrl)
        .setFooter({ text: `Requested by ${requester}` });

      const buttons = [];
      const baseUrl = bannerUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      const row = new ActionRowBuilder().addComponents(buttons);

      await replyFn({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[ServerBanner]', err);
    }
  },
};
