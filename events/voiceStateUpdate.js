const {
  Events,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
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

function buildControlPanel() {
  const embed = new EmbedBuilder()
    .setTitle('\uD83C\uDF99\uFE0F Voice Channel Controls')
    .setDescription(
      'Use the buttons below to manage your voice channel.\nOnly you (the channel creator) can use these controls.',
    )
    .setColor(0x5865f2)
    .addFields(
      { name: '\uD83C\uDFF7\uFE0F Rename', value: 'Change channel name', inline: true },
      { name: '\uD83D\uDC65 Limit', value: 'Set user limit', inline: true },
      { name: '\uD83D\uDD12 Lock', value: 'Block new joins', inline: true },
      { name: '\uD83D\uDD13 Unlock', value: 'Allow joins', inline: true },
      { name: '\uD83D\uDC41\uFE0F Hide', value: 'Hide from list', inline: true },
      { name: '\uD83D\uDC41\uFE0F Unhide', value: 'Show in list', inline: true },
      { name: '\u231B Waiting Room', value: 'See but can\'t join', inline: true },
      { name: '\uD83D\uDEAB Reject User', value: 'Block a user', inline: true },
      { name: '\u2795 Trust User', value: 'Allow a user', inline: true },
      { name: '\uD83D\uDDD1\uFE0F Delete VC', value: 'Delete channel', inline: true },
    )
    .setFooter({ text: 'Controls are only usable by the channel creator' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vc_rename').setLabel('\uD83C\uDFF7\uFE0F Rename').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_limit').setLabel('\uD83D\uDC65 Set Limit').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_lock').setLabel('\uD83D\uDD12 Lock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_unlock').setLabel('\uD83D\uDD13 Unlock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_hide').setLabel('\uD83D\uDC41\uFE0F Hide').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vc_unhide').setLabel('\uD83D\uDC41\uFE0F Unhide').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_waiting').setLabel('\u231B Waiting').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_trust').setLabel('\u2795 Trust').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_reject').setLabel('\uD83D\uDEAB Reject').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_delete').setLabel('\uD83D\uDDD1\uFE0F Delete').setStyle(ButtonStyle.Danger),
  );

  return { embed, row1, row2 };
}

async function sendControlPanel(channel) {
  try {
    const { embed, row1, row2 } = buildControlPanel();
    await channel.send({ embeds: [embed], components: [row1, row2] });
  } catch (err) {
    console.error('[TempVC] Failed to send control panel:', err.message);
  }
}

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState) {
    const tempVCs = newState.client.tempVCs;

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

        tempVCs.set(tempChannel.id, { creatorId: member.id, guildId: guild.id, type: 'hub' });
        console.log('[TempVC] Created hub VC:', tempChannel.id, 'for:', member.id);
        console.log('[TempVC] Map size now:', tempVCs.size);

        try {
          await member.voice.setChannel(tempChannel);
        } catch (err) {
          console.error('[TempVC] Failed to move member to hub:', err.message);
          if (tempChannel.members.size === 0) {
            tempVCs.delete(tempChannel.id);
            await tempChannel.delete().catch(() => {});
          }
          return;
        }

        if (tempChannel.members.size === 0) {
          tempVCs.delete(tempChannel.id);
          await tempChannel.delete().catch(() => {});
        } else {
          await sendControlPanel(tempChannel);
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

        tempVCs.set(duoChannel.id, { creatorId: member.id, guildId: guild.id, type: 'duo' });
        console.log('[DuoVC] Created duo VC:', duoChannel.id, 'for:', member.id);
        console.log('[DuoVC] Map size now:', tempVCs.size);

        try {
          await member.voice.setChannel(duoChannel);
        } catch (err) {
          console.error('[DuoVC] Failed to move member to duo:', err.message);
          if (duoChannel.members.size === 0) {
            tempVCs.delete(duoChannel.id);
            await duoChannel.delete().catch(() => {});
          }
          return;
        }

        if (duoChannel.members.size === 0) {
          tempVCs.delete(duoChannel.id);
          await duoChannel.delete().catch(() => {});
        } else {
          await sendControlPanel(duoChannel);
        }
      }

      // --- User left or moved from a channel — check if it was a temp VC ---
      if (
        oldState.channelId &&
        oldState.channelId !== config.createVcChannel &&
        oldState.channelId !== config.createDuoChannel
      ) {
        if (tempVCs.has(oldState.channelId)) {
          const channel = oldState.guild.channels.cache.get(oldState.channelId);
          if (channel && channel.members.size === 0) {
            tempVCs.delete(oldState.channelId);
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
