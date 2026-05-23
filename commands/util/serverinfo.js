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
  aliases: ['si', 'server', 'guildinfo', 'guild'],

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

      const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

      const description = [
        `👑 **Owner:** ${owner.user}`,
        `📅 **Created:** <t:${createdTimestamp}:F>`,
        `🌍 **Region:** ${guild.preferredLocale || 'Auto'}`,
        `✅ **Verified:** ${guild.verified ? 'Yes' : 'No'}  •  🔒 **2FA:** ${guild.mfaLevel === 1 ? 'Yes' : 'No'}`,
      ].join('\n');

      const fields = [
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '🤖 Bots', value: `${bots}`, inline: true },
        { name: '👤 Humans', value: `${humans}`, inline: true },

        { name: '💬 Text', value: `${textChannels}`, inline: true },
        { name: '🔊 Voice', value: `${voiceChannels}`, inline: true },
        { name: '📁 Categories', value: `${categories}`, inline: true },

        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: '🌟 Stickers', value: `${guild.stickers.cache.size}`, inline: true },

        { name: '🚀 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
        { name: '💎 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: '🔔 System', value: guild.systemChannel ? `${guild.systemChannel}` : 'None', inline: true },
      ];

      if (guild.description) {
        fields.push({ name: '📝 Description', value: guild.description, inline: false });
      }

      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
        .setColor(0x5865F2)
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: `Requested by ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await replyFn({ embeds: [embed] });
    } catch (err) {
      console.error('[ServerInfo]', err);
    }
  },
};
