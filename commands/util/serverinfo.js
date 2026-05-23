const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  CommandInteraction,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show server information'),

  name: 'serverinfo',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let guild, replyFn, requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        requester = interaction.user;
        replyFn = (opts) => interaction.reply(opts);
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        requester = message.author;
        replyFn = (opts) => message.reply(opts);
      }

      await guild.fetch();
      const members = await guild.members.fetch();
      const owner = await guild.fetchOwner();

      const bots = members.filter((m) => m.user.bot).size;
      const humans = members.size - bots;

      const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
      const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
      const threads = guild.channels.cache.filter(
        (c) => c.type === ChannelType.PublicThread || c.type === ChannelType.PrivateThread,
      ).size;

      const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
        .setColor(0x5865F2)
        .addFields(
          { name: '\uD83D\uDC51 Owner', value: `${owner.user}`, inline: false },
          { name: '\uD83C\uDD94 Server ID', value: guild.id, inline: true },
          { name: '\uD83D\uDCC5 Created', value: `<t:${createdTimestamp}:F>`, inline: true },
          { name: '\uD83C\uDF0D Region', value: guild.preferredLocale || 'Auto', inline: true },
          { name: '\u2705 Verified', value: guild.verified ? 'Yes' : 'No', inline: true },
          { name: '\uD83D\uDD12 2FA Required', value: guild.mfaLevel === 1 ? 'Yes' : 'No', inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '\uD83D\uDC65 Members', value: `${guild.memberCount}`, inline: true },
          { name: '\uD83E\uDD16 Bots', value: `${bots}`, inline: true },
          { name: '\uD83D\uDC64 Humans', value: `${humans}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '\uD83D\uDCAC Text Channels', value: `${textChannels}`, inline: true },
          { name: '\uD83D\uDD0A Voice Channels', value: `${voiceChannels}`, inline: true },
          { name: '\uD83D\uDCC1 Categories', value: `${categories}`, inline: true },
          { name: '\uD83D\uDCE3 Threads', value: `${threads}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '\uD83C\uDFAD Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '\uD83D\uDE00 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
          { name: '\uD83C\uDF1F Stickers', value: `${guild.stickers.cache.size}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '\uD83D\uDE80 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
          { name: '\uD83D\uDC8E Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
          { name: '\uD83D\uDD14 System Channel', value: guild.systemChannel ? `${guild.systemChannel}` : 'None', inline: true },
        )
        .setFooter({ text: `Requested by ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      if (guild.description) {
        embed.setDescription(guild.description);
      }

      await replyFn({ embeds: [embed] });
    } catch (err) {
      console.error('[ServerInfo]', err);
    }
  },
};
