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
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverbanner')
    .setDescription('Show the server banner'),

  name: 'serverbanner',
  aliases: ['sbanner', 'guildbanner'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let guild, replyError, replySuccess, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        requester = interaction.user.username;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('serverbanner', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        requester = message.author.username;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('serverbanner', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }
      }

      if (!guild.banner) {
        return replyError(`${e.error} This server does not have a banner.`);
      }

      const bannerUrl = guild.bannerURL({ size: 4096, dynamic: true });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ dynamic: true }),
        })
        .setDescription(`🖼️ | Server banner for **${guild.name}**`)
        .setImage(bannerUrl)
        .setFooter({ text: `Requested by ${(isSlash ? interactionOrMessage.user : interactionOrMessage.author).tag}` });

      const buttons = [];
      const baseUrl = bannerUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      const row = new ActionRowBuilder().addComponents(buttons);

      await replySuccess({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[ServerBanner]', err);
    }
  },
};
