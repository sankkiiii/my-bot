const {
  Events,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const getConfig = require('../utils/getConfig');
const buildVcPanel = require('../utils/buildVcPanel');

const DUO_PREFIX = '𝄢・duo ';

const superscriptMap = {
  '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4,
  '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9
};

function toSuperscript(num) {
  const superDigits = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹'];
  return String(num).split('').map(d => superDigits[parseInt(d)]).join('');
}

function superscriptToNumber(str) {
  if (!str || str.trim() === '') return null;
  let result = 0;
  let valid = false;
  for (const char of str.trim()) {
    if (superscriptMap[char] !== undefined) {
      result = result * 10 + superscriptMap[char];
      valid = true;
    } else {
      return null; // invalid character
    }
  }
  return valid ? result : null;
}

function isDuoVC(channel, cfg) {
  if (!cfg?.temp_vc_category) return false;
  return (
    channel.parentId === cfg.temp_vc_category &&
    channel.type === ChannelType.GuildVoice &&
    channel.name.startsWith(DUO_PREFIX) &&
    channel.id !== cfg.create_vc_channel &&
    channel.id !== cfg.create_duo_channel
  );
}

function getNextDuoNumber(guild, cfg) {
  const usedNumbers = new Set();

  guild.channels.cache
    .filter(ch => isDuoVC(ch, cfg))
    .forEach(ch => {
      const suffix = ch.name.slice(DUO_PREFIX.length);
      const num = superscriptToNumber(suffix);
      if (num !== null) {
        usedNumbers.add(num);
        console.log(`[DuoVC] Found existing: "${ch.name}" → number ${num}`);
      }
    });

  let next = 1;
  while (usedNumbers.has(next)) next++;
  console.log(`[DuoVC] Next number: ${next}, used: [${[...usedNumbers].join(',')}]`);
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
    const client = newState.client;
    const tempVCs = client.tempVCs;
    const creating = client.tempVCsCreating;
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

        // Build permission overwrites array
        const permOverwrites = [
          {
            id: guild.id,
            allow: [],
            deny: []
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
            ]
          },
          {
            id: guild.members.me.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
            ]
          }
        ];

        // Copy roles from trigger channel
        const inheritedRoleIds = [];
        if (triggerChannel) {
          for (const [id, overwrite] of triggerChannel.permissionOverwrites.cache) {
            if (id === guild.id) continue;
            if (overwrite.type !== 0) continue; 
            if (id === guild.members.me.id) continue;

            permOverwrites.push({
              id: id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.SendMessages,
              ]
            });
            inheritedRoleIds.push(id);
          }
        }

        let tempChannel;
        try {
          tempChannel = await guild.channels.create({
            name: `${member.displayName}'s VC`,
            type: ChannelType.GuildVoice,
            parent: TEMP_VC_CATEGORY || undefined,
            permissionOverwrites: permOverwrites,
          });
        } catch (err) {
          console.error('[TempVC] Failed to create hub channel:', err.message);
          return;
        }

        // Add to creating lock set and main Map
        creating.add(tempChannel.id);
        tempVCs.set(tempChannel.id, {
          creatorId: member.id,
          guildId: guild.id,
          type: 'hub',
          inheritedRoles: inheritedRoleIds
        });

        console.log(`[TempVC] Created: ${tempChannel.name} for ${member.user.tag}`);

        let userMoved = false;
        try {
          await member.voice.setChannel(tempChannel);
          userMoved = true;
        } catch (err) {
          console.error('[TempVC] Failed to move member to hub:', err.message);
        }

        // Grace period logic
        if (userMoved) {
          setTimeout(() => {
            creating.delete(tempChannel.id);
          }, 1000);
        } else {
          setTimeout(() => {
            creating.delete(tempChannel.id);
            const ch = guild.channels.cache.get(tempChannel.id);
            if (ch) {
              const humans = ch.members.filter(m => !m.user.bot);
              if (humans.size === 0) {
                tempVCs.delete(tempChannel.id);
                ch.delete().catch(() => {});
                console.log('[TempVC] Deleted empty VC after grace:', ch.name);
              }
            }
          }, 3000);
        }

        await sendControlPanel(tempChannel);
        
        // Position logic for Hub VC
        try {
          const existingHubVCs = guild.channels.cache
            .filter(ch =>
              ch.parentId === TEMP_VC_CATEGORY &&
              ch.type === ChannelType.GuildVoice &&
              !ch.name.startsWith(DUO_PREFIX) &&
              ch.id !== CREATE_VC_CHANNEL &&
              ch.id !== CREATE_DUO_CHANNEL &&
              ch.id !== tempChannel.id
            )
            .sort((a, b) => a.position - b.position);

          if (existingHubVCs.size > 0) {
            const lastHub = existingHubVCs.last();
            await tempChannel.setPosition(lastHub.position + 1, { relative: false });
          } else if (triggerChannel) {
            await tempChannel.setPosition(triggerChannel.position + 1, { relative: false });
          }
        } catch (err) {
          console.error('[TempVC] Failed to set position:', err.message);
        }
      }

      // --- User joined the "Create Duo" channel ---
      if (CREATE_DUO_CHANNEL && newState.channelId === CREATE_DUO_CHANNEL) {
        const guild = newState.guild;
        const member = newState.member;
        const duoTriggerChannel = guild.channels.cache.get(CREATE_DUO_CHANNEL);

        console.log('[DuoVC] User joined trigger:', member.displayName);
        console.log('[DuoVC] Category:', TEMP_VC_CATEGORY);
        console.log('[DuoVC] Channels in category:',
          guild.channels.cache
            .filter(ch => ch.parentId === TEMP_VC_CATEGORY)
            .map(ch => `"${ch.name}"`)
            .join(', ')
        );

        const duoNumber = getNextDuoNumber(guild, cfg);
        const duoName = `${DUO_PREFIX}${toSuperscript(duoNumber)}`;

        // Build permission overwrites array
        const permOverwrites = [
          {
            id: guild.id,
            allow: [],
            deny: []
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
            ]
          },
          {
            id: guild.members.me.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
            ]
          }
        ];

        // Inherit roles from trigger channel
        const inheritedRoleIds = [];
        if (duoTriggerChannel) {
          for (const [id, overwrite] of duoTriggerChannel.permissionOverwrites.cache) {
            if (id === guild.id) continue;
            if (overwrite.type !== 0) continue;
            if (id === guild.members.me.id) continue;

            permOverwrites.push({
              id: id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.SendMessages,
              ]
            });
            inheritedRoleIds.push(id);
          }
        }

        let duoChannel;
        try {
          console.log('[DuoVC] Creating:', duoName);
          duoChannel = await guild.channels.create({
            name: duoName,
            type: ChannelType.GuildVoice,
            parent: TEMP_VC_CATEGORY || undefined,
            userLimit: 2,
            permissionOverwrites: permOverwrites,
          });
        } catch (err) {
          console.error('[DuoVC] Failed to create duo channel:', err.message);
          return;
        }

        // Add to creating lock set
        creating.add(duoChannel.id);
        tempVCs.set(duoChannel.id, {
          creatorId: member.id,
          guildId: guild.id,
          type: 'duo',
          inheritedRoles: inheritedRoleIds
        });

        console.log(`[TempVC] Created: ${duoChannel.name} for ${member.user.tag}`);

        let userMoved = false;
        try {
          await member.voice.setChannel(duoChannel);
          userMoved = true;
        } catch (err) {
          console.error('[DuoVC] Failed to move member to duo:', err.message);
        }

        // Grace period logic
        if (userMoved) {
          setTimeout(() => {
            creating.delete(duoChannel.id);
          }, 1000);
        } else {
          setTimeout(() => {
            creating.delete(duoChannel.id);
            const ch = guild.channels.cache.get(duoChannel.id);
            if (ch) {
              const humans = ch.members.filter(m => !m.user.bot);
              if (humans.size === 0) {
                tempVCs.delete(duoChannel.id);
                ch.delete().catch(() => {});
                console.log('[TempVC] Deleted empty VC after grace:', ch.name);
              }
            }
          }, 3000);
        }

        await sendControlPanel(duoChannel);

        // Position logic for Duo VC
        try {
          console.log('[DuoVC] Existing duo VCs:',
            guild.channels.cache
              .filter(ch => isDuoVC(ch, cfg))
              .map(ch => `"${ch.name}"`)
              .join(', ')
          );

          const existingDuoVCs = guild.channels.cache
            .filter(ch => isDuoVC(ch, cfg) && ch.id !== duoChannel.id)
            .map(ch => {
              const suffix = ch.name.slice(DUO_PREFIX.length);
              const num = superscriptToNumber(suffix);
              return { channel: ch, num: num ?? 999 };
            })
            .sort((a, b) => a.num - b.num);

          if (existingDuoVCs.length > 0) {
            const lastDuo = existingDuoVCs[existingDuoVCs.length - 1];
            await duoChannel.setPosition(lastDuo.channel.position + 1, { relative: false });
            console.log(`[DuoVC] Placed "${duoChannel.name}" after "${lastDuo.channel.name}"`);
          } else if (duoTriggerChannel) {
            await duoChannel.setPosition(duoTriggerChannel.position + 1, { relative: false });
          }
        } catch (err) {
          console.error('[DuoVC] Position set failed:', err.message);
        }
      }

      // --- User left or moved from a channel — check if it was a temp VC ---
      if (
        oldState.channelId &&
        oldState.channelId !== CREATE_VC_CHANNEL &&
        oldState.channelId !== CREATE_DUO_CHANNEL
      ) {
        const channelId = oldState.channelId;

        // SKIP if channel is being created
        if (creating.has(channelId)) {
          console.log('[TempVC] Skipping deletion — in creating Set:', channelId);
          return;
        }

        // SKIP if not a tracked temp VC
        if (!tempVCs.has(channelId)) return;

        // Deletion delay reduced to 500ms
        await new Promise(resolve => setTimeout(resolve, 500));

        // Re-fetch channel after delay
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
