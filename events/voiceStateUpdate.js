const {
  Events,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const getConfig = require('../utils/getConfig');
const buildVcPanel = require('../utils/buildVcPanel');

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

async function sendControlPanel(channel) {
  try {
    const { embed, rows } = buildVcPanel();
    await channel.send({ embeds: [embed], components: rows });
  } catch (err) {
    console.error('[TempVC] Failed to send control panel:', err.message);
  }
}

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState) {
    const tempVCs = newState.client.tempVCs;
    const creating = newState.client.tempVCsCreating;
    const cfg = getConfig(newState.guild.id);
    const CREATE_VC_CHANNEL = cfg?.create_vc_channel;
    const CREATE_DUO_CHANNEL = cfg?.create_duo_channel;
    const TEMP_VC_CATEGORY = cfg?.temp_vc_category;

    try {
      // --- User joined the "Create VC" channel (Hub) ---
      if (CREATE_VC_CHANNEL && newState.channelId === CREATE_VC_CHANNEL) {
        const guild = newState.guild;
        const member = newState.member;
        const triggerChannel = guild.channels.cache.get(CREATE_VC_CHANNEL);

        let tempChannel;
        try {
          tempChannel = await guild.channels.create({
            name: `${member.displayName}'s VC`,
            type: ChannelType.GuildVoice,
            parent: TEMP_VC_CATEGORY || undefined,
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

        // Add to creating lock set
        creating.add(tempChannel.id);
        tempVCs.set(tempChannel.id, { creatorId: member.id, guildId: guild.id, type: 'hub' });
        console.log(`[TempVC] Created: ${tempChannel.name} for ${member.user.tag}`);

        try {
          await member.voice.setChannel(tempChannel);
        } catch (err) {
          console.error('[TempVC] Failed to move member to hub:', err.message);
        }

        // 3 second grace period to allow voice state to settle
        setTimeout(() => {
          creating.delete(tempChannel.id);
        }, 3000);

        await sendControlPanel(tempChannel);
        
        // Place directly below trigger channel
        if (triggerChannel) {
          try {
            await tempChannel.setPosition(triggerChannel.position + 1, { relative: false });
          } catch (err) {
            console.error('[TempVC] Failed to set position:', err.message);
          }
        }
      }

      // --- User joined the "Create Duo" channel ---
      if (CREATE_DUO_CHANNEL && newState.channelId === CREATE_DUO_CHANNEL) {
        const guild = newState.guild;
        const member = newState.member;
        const duoTriggerChannel = guild.channels.cache.get(CREATE_DUO_CHANNEL);

        const duoNumber = getNextDuoNumber(guild, TEMP_VC_CATEGORY);
        const channelName = `\uD834\uDD22\u30FBduo ${toSuperscript(duoNumber)}`;

        let duoChannel;
        try {
          duoChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: TEMP_VC_CATEGORY || undefined,
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

        // Add to creating lock set
        creating.add(duoChannel.id);
        tempVCs.set(duoChannel.id, { creatorId: member.id, guildId: guild.id, type: 'duo' });
        console.log(`[TempVC] Created: ${duoChannel.name} for ${member.user.tag}`);

        try {
          await member.voice.setChannel(duoChannel);
        } catch (err) {
          console.error('[DuoVC] Failed to move member to duo:', err.message);
        }

        // 3 second grace period
        setTimeout(() => {
          creating.delete(duoChannel.id);
        }, 3000);

        await sendControlPanel(duoChannel);

        // Place directly below duo trigger channel
        if (duoTriggerChannel) {
          try {
            await duoChannel.setPosition(duoTriggerChannel.position + 1, { relative: false });
          } catch (err) {
            console.error('[DuoVC] Failed to set position:', err.message);
          }
        }
      }

      // --- User left or moved from a channel — check if it was a temp VC ---
      if (
        oldState.channelId &&
        oldState.channelId !== CREATE_VC_CHANNEL &&
        oldState.channelId !== CREATE_DUO_CHANNEL
      ) {
        const channelId = oldState.channelId;

        // SKIP if channel is being created (race condition protection)
        if (creating.has(channelId)) {
          console.log('[TempVC] Skipping deletion — in creating Set:', channelId);
          return;
        }

        // SKIP if not a tracked temp VC
        if (!tempVCs.has(channelId)) return;

        // Small delay before checking if empty to allow user move to finalize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Re-fetch channel after delay (it might be deleted already)
        const freshChannel = oldState.guild.channels.cache.get(channelId);
        if (!freshChannel) {
          tempVCs.delete(channelId);
          return;
        }

        // Still in creating Set? skip
        if (creating.has(channelId)) return;

        const humanMembers = freshChannel.members.filter(m => !m.user.bot);
        if (humanMembers.size === 0) {
          tempVCs.delete(channelId);
          await freshChannel.delete().catch((err) =>
            console.error('[TempVC] Failed to delete channel:', err.message),
          );
          console.log('[TempVC] Deleted empty VC:', freshChannel.name);
        }
      }
    } catch (err) {
      console.error('[VoiceStateUpdate]', err);
    }
  },
};
