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
    .setName('servericon')
    .setDescription('Show the server icon'),

  name: 'servericon',
  aliases: ['sicon', 'guildicon'],

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

      if (!guild.icon) {
        return replyFn({ content: '\u274C This server does not have an icon.' });
      }

      const iconUrl = guild.iconURL({ size: 4096, dynamic: true });

      const embed = new EmbedBuilder()
        .setTitle(`${guild.name}'s Icon`)
        .setColor(0x5865F2)
        .setImage(iconUrl)
        .setFooter({ text: `Requested by ${requester}` });

      const buttons = [];
      const baseUrl = iconUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (guild.icon?.startsWith('a_')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      const row = new ActionRowBuilder().addComponents(buttons);

      await replyFn({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[ServerIcon]', err);
    }
  },
};
