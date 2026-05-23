const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member, client) {
    try {
      const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

      const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setColor(0x57f287)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User', value: `${member.user.tag} (${member.user.id})` },
          { name: 'Account Age', value: `${accountAge} day(s)` },
          { name: 'Member Count', value: `${member.guild.memberCount}` },
        )
        .setTimestamp();

      await sendLog(client, config.joinLogChannel, embed);
    } catch (err) {
      console.error('[GuildMemberAdd]', err);
    }
  },

  init(client) {
    client.on(Events.GuildMemberRemove, async (member) => {
      try {
        const roles = member.roles.cache
          .filter((r) => r.id !== member.guild.id)
          .map((r) => r.name)
          .join(', ') || 'None';

        const joinedAt = member.joinedTimestamp
          ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24))
          : null;

        const embed = new EmbedBuilder()
          .setTitle('Member Left')
          .setColor(0xed4245)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'User', value: `${member.user.tag} (${member.user.id})` },
            { name: 'Roles', value: roles.substring(0, 1024) },
            { name: 'Time in Server', value: joinedAt !== null ? `${joinedAt} day(s)` : 'Unknown' },
          )
          .setTimestamp();

        await sendLog(client, config.joinLogChannel, embed);
      } catch (err) {
        console.error('[GuildMemberRemove]', err);
      }
    });

    console.log('[Events] Loaded: guildMemberRemove (via guildMemberAdd init)');
  },
};
