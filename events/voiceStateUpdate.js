const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState, client) {
    try {
      if (!config.createVcChannel) return;

      // --- User joined the "Create VC" channel ---
      if (newState.channelId === config.createVcChannel) {
        const guild = newState.guild;
        const member = newState.member;

        let tempChannel;
        try {
          tempChannel = await guild.channels.create({
            name: `${member.user.username}'s VC`,
            type: ChannelType.GuildVoice,
            parent: config.tempVcCategory || undefined,
            permissionOverwrites: [
              {
                id: member.id,
                allow: [
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                ],
              },
            ],
          });
        } catch (err) {
          console.error('[TempVC] Failed to create channel:', err.message);
          return;
        }

        client.tempVCs.set(tempChannel.id, { creatorId: member.id, guildId: guild.id });

        try {
          await member.voice.setChannel(tempChannel);
        } catch (err) {
          console.error('[TempVC] Failed to move member:', err.message);
          // User left before we could move them — delete the empty VC
          if (tempChannel.members.size === 0) {
            client.tempVCs.delete(tempChannel.id);
            await tempChannel.delete().catch(() => {});
          }
          return;
        }

        // Edge case: user left during the move — channel is now empty
        if (tempChannel.members.size === 0) {
          client.tempVCs.delete(tempChannel.id);
          await tempChannel.delete().catch(() => {});
        }
      }

      // --- User left or moved from a channel — check if it was a temp VC ---
      if (oldState.channelId && oldState.channelId !== config.createVcChannel) {
        // Check our tracked map first
        if (client.tempVCs.has(oldState.channelId)) {
          const channel = oldState.guild.channels.cache.get(oldState.channelId);
          if (channel && channel.members.size === 0) {
            client.tempVCs.delete(oldState.channelId);
            await channel.delete().catch((err) =>
              console.error('[TempVC] Failed to delete channel:', err.message),
            );
          }
        }
      }
    } catch (err) {
      console.error('[VoiceStateUpdate]', err);
    }
  },
};
