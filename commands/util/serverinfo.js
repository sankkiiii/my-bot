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
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show server information'),

  name: 'serverinfo',
  aliases: ['si', 'server', 'guildinfo', 'guild'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let guild;
      let replyError;
      let replySuccess;
      let requester;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        requester = interaction.user;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('serverinfo', interaction.user.id, interaction.guild.id, 3000);
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
        requester = message.author;
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('serverinfo', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }
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

      const description = `👑 **Owner:** ${owner.user}
📅 **Created:** <t:${createdTimestamp}:R>
🌍 **Region:** ${guild.preferredLocale || 'Auto'}
✅ **Verified:** ${guild.verified ? 'Yes' : 'No'} • 🔒 **2FA:** ${guild.mfaLevel === 1 ? 'Yes' : 'No'}

👥 **Members:** ${guild.memberCount} (🤖 ${bots} bots • 👤 ${humans} humans)
💬 **Channels:** ${textChannels} text • 🔊 ${voiceChannels} voice • 📁 ${categories} categories
🎭 **Roles:** ${guild.roles.cache.size} • 😀 **Emojis:** ${guild.emojis.cache.size} • 🌟 **Stickers:** ${guild.stickers.cache.size}
🚀 **Boost:** Level ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boosts)`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ dynamic: true }),
        })
        .setDescription(description);

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[ServerInfo]', err);
    }
  },
};
