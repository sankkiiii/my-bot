const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  CommandInteraction,
} = require('discord.js');
const guildConfig = require('../../database/guildConfig');
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
  aliases: ['avatar', 'pfp', 'icon', 'pic'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const guild = interactionOrMessage.guild;

    if (guild) {
      const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
      const memberRoleIds = [...interactionOrMessage.member.roles.cache.keys()];

      const canUse = guildConfig.hasCommandRole(
        guild.id,
        'av',
        executorId,
        memberRoleIds
      );

      if (!canUse) {
        // Silently ignore — no reply, just return
        return;
      }
    }

    try {
      let resolved;
      let replyError;
      let replySuccess;
      let requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        const guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        requester = interaction.user.username;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('avatar', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }

        const userOption = interaction.options.getUser('user');
        const queryOption = interaction.options.getString('query');

        if (userOption) {
          const member = await guild.members.fetch(userOption.id).catch(() => null);
          const user = await client.users.fetch(userOption.id).catch(() => null);
          resolved = { member, user: user || userOption, inGuild: !!member };
        } else if (queryOption) {
          resolved = await resolveUserGlobal(queryOption, guild, client);
        } else {
          const member = interaction.member;
          const user = interaction.user;
          resolved = { member, user, inGuild: true };
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

        const remaining = cooldown.check('avatar', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }

        const input = message.mentions.users.first()?.id || args.join(' ');

        if (!input || input === '') {
          const member = message.member;
          const user = message.author;
          resolved = { member, user, inGuild: true };
        } else {
          resolved = await resolveUserGlobal(input, message.guild, client);
        }
      }

      if (!resolved.user) {
        return replyError(error('Could not find that user. Try their @mention, username, or user ID.'));
      }

      const { member, user, inGuild } = resolved;
      const avatarUrl = (inGuild && member.avatar)
        ? member.displayAvatarURL({ size: 4096, dynamic: true })
        : user.displayAvatarURL({ size: 4096, dynamic: true });

      const displayName = inGuild ? member.displayName : user.username;

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({
          name: user.username,
          iconURL: user.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(withEmoji('avatar', `Avatar for **${displayName}**`))
        .setImage(avatarUrl)
        .setFooter({ text: `Requested by ${(isSlash ? interactionOrMessage.user : interactionOrMessage.author).tag}` });

      const buttons = [];
      const baseUrl = avatarUrl.split('?')[0];
      buttons.push(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=png'));
      buttons.push(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=jpg'));
      buttons.push(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=webp'));
      if (avatarUrl.includes('.gif')) {
        buttons.push(new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(baseUrl + '?size=4096&format=gif'));
      }
      const components = [new ActionRowBuilder().addComponents(buttons)];

      const embeds = [embed];

      // If they have a server-specific avatar, add the global one too
      if (inGuild && member.avatar) {
        const globalAvatarUrl = user.displayAvatarURL({ size: 4096, dynamic: true });
        const globalEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({ dynamic: true }),
          })
          .setDescription(withEmoji('avatar', `Global avatar for **${user.username}**`))
          .setImage(globalAvatarUrl)
          .setFooter({ text: `Requested by ${(isSlash ? interactionOrMessage.user : interactionOrMessage.author).tag}` });
        embeds.push(globalEmbed);
      }

      await replySuccess({ embeds, components });
    } catch (err) {
      console.error('[Avatar]', err);
    }
  },
};
