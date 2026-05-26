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
const e = require('../../config/emojis');

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

        const remaining = cooldown.check('banner', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
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
          return replyError(`${e.error} Could not find that user. Try their @mention, username, or user ID.`);
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

        const remaining = cooldown.check('banner', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
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
          return replyError(`${e.error} Could not find that user. Try their @mention, username, or user ID.`);
        }
      }

      const { member, user, inGuild } = resolved;

      // Always fetch with force:true to get banner data
      const fetchedUser = await client.users.fetch(user.id, { force: true });
      const displayName = inGuild ? member.displayName : user.username;

      if (!fetchedUser.banner) {
        return replyError(`${e.error} **${displayName}** does not have a profile banner.`);
      }

      const bannerUrl = fetchedUser.bannerURL({ size: 4096, dynamic: true });
      const color = fetchedUser.accentColor || 0x5865F2;

      const embed = new EmbedBuilder()
        .setTitle(`${displayName}'s Banner`)
        .setColor(color)
        .setImage(bannerUrl)
        .setFooter({ text: `Requested by ${requester}` });

      if (!inGuild) {
        embed.setDescription(`${e.warning} This user is not in the server — showing global profile only.`);
      }

      const buttons = [];
      const baseUrl = bannerUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (fetchedUser.banner?.startsWith('a_')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      const row = new ActionRowBuilder().addComponents(buttons);

      await replySuccess({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[Banner]', err);
    }
  },
};
