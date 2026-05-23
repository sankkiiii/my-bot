const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

// In-memory map: channelId → creatorId
const tempChannels = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState, client) {
    try {
      // --- User joined the "Create VC" channel ---
      if (newState.channelId === config.createVcChannel) {
        const guild = newState.guild;
        const member = newState.member;

        const tempChannel = await guild.channels.create({
          name: `${member.user.username}'s VC`,
          type: ChannelType.GuildVoice,
          parent: config.tempVcCategory || undefined,
          permissionOverwrites: [
            {
              id: member.id,
              allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
            },
          ],
        });

        tempChannels.set(tempChannel.id, member.id);

        await member.voice.setChannel(tempChannel);
      }

      // --- User left a channel — check if it's a temp VC that's now empty ---
      if (oldState.channelId && tempChannels.has(oldState.channelId)) {
        const channel = oldState.guild.channels.cache.get(oldState.channelId);
        if (channel && channel.members.size === 0) {
          tempChannels.delete(oldState.channelId);
          await channel.delete().catch((err) =>
            console.error('[TempVC] Failed to delete channel:', err.message),
          );
        }
      }
    } catch (err) {
      console.error('[VoiceStateUpdate]', err);
    }
  },
};
