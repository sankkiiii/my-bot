const { ChannelType } = require('discord.js');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    console.log(`[Guild] Joined: ${guild.name} (${guild.id})`);
    try {
      const channel = guild.systemChannel
        || guild.channels.cache.find((c) =>
          c.type === ChannelType.GuildText
          && c.permissionsFor(guild.members.me)?.has('SendMessages'),
        );
      if (channel) {
        await channel.send({
          embeds: [{
            title: '👋 Thanks for adding me!',
            description: [
              'To get started, run these commands:',
              '',
              '🎫 `/setup tickets` — Configure ticket system',
              '🔊 `/setup tempvc` — Configure temp voice channels',
              '⚙️ `/config` — View current configuration',
              '',
              'All features require setup before use.',
              'You need **Administrator** permission to run setup.',
            ].join('\n'),
            color: 0x5865F2,
            footer: { text: guild.name },
          }],
        });
      }
    } catch {}
  },
};
