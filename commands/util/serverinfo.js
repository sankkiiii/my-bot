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

      const description = [
        `${e.owner} **Owner:** ${owner.user}`,
        `${e.calendar} **Created:** <t:${createdTimestamp}:F>`,
        `${e.region} **Region:** ${guild.preferredLocale || 'Auto'}`,
        `${e.verified} **Verified:** ${guild.verified ? 'Yes' : 'No'}  •  🔒 **2FA:** ${guild.mfaLevel === 1 ? 'Yes' : 'No'}`,
        ].join('\n');

        const fields = [
        { name: `${e.members} Members`, value: `${guild.memberCount}`, inline: true },
        { name: `${e.bot} Bots`, value: `${bots}`, inline: true },
        { name: `${e.user} Humans`, value: `${humans}`, inline: true },

        { name: `${e.channels} Text`, value: `${textChannels}`, inline: true },
        { name: '🎙️ Voice', value: `${voiceChannels}`, inline: true },
        { name: `${e.info} Categories`, value: `${categories}`, inline: true },
        { name: `${e.role} Roles`, value: `${guild.roles.cache.size}`, inline: true },
        { name: `${e.emojis} Emojis`, value: `${guild.emojis.cache.size}`, inline: true },
        { name: `${e.info} Stickers`, value: `${guild.stickers.cache.size}`, inline: true },

        { name: `${e.boost} Boost Level`, value: `Level ${guild.premiumTier}`, inline: true },
        { name: `${e.boost} Boosts`, value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: `${e.info} System`, value: guild.systemChannel ? `${guild.systemChannel}` : 'None', inline: true },
      ];

      if (guild.description) {
        fields.push({ name: `${e.info} Description`, value: guild.description, inline: false });
      }

      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
        .setColor(0x5865F2)
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: `Requested by ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[ServerInfo]', err);
    }
  },
};
