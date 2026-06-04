const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { error } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show server information'),

  name: 'serverinfo',
  aliases: ['server', 'guildinfo', 'guild'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let guild;
      let replyError;
      let replySuccess;
      let executor;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        executor = interaction.user;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('serverinfo', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        executor = message.author;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('serverinfo', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }
      }

      await guild.fetch();
      const members = await guild.members.fetch();
      const owner = await guild.fetchOwner();

      const bots = members.filter((m) => m.user.bot).size;
      const humans = guild.memberCount - bots;

      const textCount = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
      const voiceCount = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
      const categoryCount = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
      const threadCount = guild.channels.cache.filter((c) => [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(c.type)).size;

      const roleCount = guild.roles.cache.size;
      const emojiCount = guild.emojis.cache.size;
      const stickerCount = guild.stickers.cache.size;

      const description = `**General Information**
Owner: ${owner.user}
ID: ${guild.id}
Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>

**Member Count**
Total: ${guild.memberCount}
Humans: ${humans}
Bots: ${bots}

**Channels**
Text: ${textCount} • Voice: ${voiceCount}
Categories: ${categoryCount} • Threads: ${threadCount}

**Server Assets**
Roles: ${roleCount}
Emojis: ${emojiCount}
Stickers: ${stickerCount}

**Boost Status**
Level: ${guild.premiumTier}
Boosts: ${guild.premiumSubscriptionCount || 0}
${guild.vanityURLCode ? `\n**Vanity:** discord.gg/${guild.vanityURLCode}` : ''}`;

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({
          name: `${guild.name}'s Information`,
          iconURL: guild.iconURL({ dynamic: true }),
        })
        .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
        .setDescription(description)
        .setFooter({ text: `Requested by ${executor.tag}` });

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[ServerInfo]', err);
    }
  },
};
