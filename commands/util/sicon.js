const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const checkOwnerBypass = require('../../utils/isOwner');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { error, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servericon')
    .setDescription('Show the server icon'),

  name: 'servericon',
  aliases: ['servericon', 'srvicon'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const bypassExecutorId = (typeof isSlash !== 'undefined' && isSlash) ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage && interactionOrMessage.author ? interactionOrMessage.author.id : (interactionOrMessage && interactionOrMessage.user ? interactionOrMessage.user.id : (typeof executorId !== 'undefined' ? executorId : (typeof executor !== 'undefined' ? executor.id : ''))));
    const ownerBypass = checkOwnerBypass(bypassExecutorId);

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

        if (!ownerBypass) {
    const remaining = cooldown.check('servericon', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }
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

        if (!ownerBypass) {
    const remaining = cooldown.check('servericon', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }
    }
      }

      if (!guild.icon) {
        return replyError(error('This server does not have an icon.'));
      }

      const iconUrl = guild.iconURL({ size: 4096, dynamic: true });

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ dynamic: true }),
        })
        .setDescription(withEmoji('avatar', `Server icon for **${guild.name}**`))
        .setImage(iconUrl)
        .setFooter({ text: `Requested by ${(isSlash ? interactionOrMessage.user : interactionOrMessage.author).tag}` });

      const buttons = [];
      const baseUrl = iconUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (guild.icon?.startsWith('a_')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      const row = new ActionRowBuilder().addComponents(buttons);

      await replySuccess({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[ServerIcon]', err);
    }
  },
};
