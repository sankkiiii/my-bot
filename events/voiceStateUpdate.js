const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

const superscriptMap = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
};

const reverseSuperscript = {
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4',
  '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
};

function toSuperscript(num) {
  return String(num).split('').map((d) => superscriptMap[d] || d).join('');
}

function superscriptToNumber(str) {
  const digits = str.split('').map((c) => reverseSuperscript[c] || '').join('');
  const n = parseInt(digits, 10);
  return isNaN(n) ? null : n;
}

function getNextDuoNumber(guild, categoryId) {
  const usedNumbers = new Set();
  guild.channels.cache
    .filter((ch) => ch.parentId === categoryId && ch.name.startsWith('\uD834\uDD22\u30FBduo'))
    .forEach((ch) => {
      const match = ch.name.match(/duo\s(.+)$/);
      if (match) {
        const num = superscriptToNumber(match[1]);
        if (num) usedNumbers.add(num);
      }
    });

  let next = 1;
  while (usedNumbers.has(next)) next++;
  return next;
}

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState, client) {
    try {
      // --- User joined the "Create VC" channel (Hub) ---
      if (config.createVcChannel && newState.channelId === config.createVcChannel) {
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
          console.error('[TempVC] Failed to create hub channel:', err.message);
          return;
        }

        client.tempVCs.set(tempChannel.id, { creatorId: member.id, guildId: guild.id, type: 'hub' });

        try {
          await member.voice.setChannel(tempChannel);
        } catch (err) {
          console.error('[TempVC] Failed to move member to hub:', err.message);
          if (tempChannel.members.size === 0) {
            client.tempVCs.delete(tempChannel.id);
            await tempChannel.delete().catch(() => {});
          }
          return;
        }

        if (tempChannel.members.size === 0) {
          client.tempVCs.delete(tempChannel.id);
          await tempChannel.delete().catch(() => {});
        }
      }

      // --- User joined the "Create Duo" channel ---
      if (config.createDuoChannel && newState.channelId === config.createDuoChannel) {
        const guild = newState.guild;
        const member = newState.member;

        const duoNumber = getNextDuoNumber(guild, config.tempVcCategory);
        const channelName = `\uD834\uDD22\u30FBduo ${toSuperscript(duoNumber)}`;

        let duoChannel;
        try {
          duoChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: config.tempVcCategory || undefined,
            userLimit: 2,
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
          console.error('[DuoVC] Failed to create duo channel:', err.message);
          return;
        }

        client.tempVCs.set(duoChannel.id, { creatorId: member.id, guildId: guild.id, type: 'duo' });

        try {
          await member.voice.setChannel(duoChannel);
        } catch (err) {
          console.error('[DuoVC] Failed to move member to duo:', err.message);
          if (duoChannel.members.size === 0) {
            client.tempVCs.delete(duoChannel.id);
            await duoChannel.delete().catch(() => {});
          }
          return;
        }

        if (duoChannel.members.size === 0) {
          client.tempVCs.delete(duoChannel.id);
          await duoChannel.delete().catch(() => {});
        }
      }

      // --- User left or moved from a channel — check if it was a temp VC ---
      if (
        oldState.channelId &&
        oldState.channelId !== config.createVcChannel &&
        oldState.channelId !== config.createDuoChannel
      ) {
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
