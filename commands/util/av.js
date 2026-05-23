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
    .setName('av')
    .setDescription('Show a user\'s avatar')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to show avatar for').setRequired(false),
    ),

  name: 'av',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      let targetUser, member, guild, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        targetUser = interaction.options.getUser('user') || interaction.user;
        member = await guild.members.fetch(targetUser.id).catch(() => null);
        replyFn = (opts) => interaction.reply(opts);
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        const mentioned = message.mentions.users.first();
        targetUser = mentioned || message.author;
        member = await guild.members.fetch(targetUser.id).catch(() => null);
        replyFn = (opts) => message.reply(opts);
      }

      const globalAvatar = targetUser.displayAvatarURL({ size: 4096, dynamic: true });
      const serverAvatar = member?.displayAvatarURL({ size: 4096, dynamic: true });
      const displayName = member?.displayName || targetUser.displayName || targetUser.username;
      const color = member?.displayColor || 0x5865F2;

      const embeds = [];
      const components = [];

      const mainAvatar = serverAvatar || globalAvatar;
      const embed = new EmbedBuilder()
        .setTitle(`${displayName}'s Avatar`)
        .setColor(color)
        .setImage(mainAvatar)
        .setFooter({ text: `Requested by ${isSlash ? interactionOrMessage.user.username : interactionOrMessage.author.username}` });
      embeds.push(embed);

      const buttons = [];
      const baseUrl = mainAvatar.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (targetUser.avatar?.startsWith('a_') || member?.avatar?.startsWith('a_')) {
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
