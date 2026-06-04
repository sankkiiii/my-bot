const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config');
const e = require('../config/emojis');

function parseEmoji(emojiStr) {
  if (!emojiStr || emojiStr.includes('EMOJI_ID_HERE')) return null;
  const match = emojiStr.match(/<:(\w+):(\d+)>/);
  if (match) return { name: match[1], id: match[2] };
  return emojiStr;
}

function buildButton(customId, emojiKey, fallbackLabel, style) {
  const btn = new ButtonBuilder()
    .setCustomId(customId)
    .setStyle(style);
  const emoji = parseEmoji(emojiKey);
  if (emoji) btn.setEmoji(emoji);
  else btn.setLabel(fallbackLabel);
  return btn;
}

function buildVcPanel() {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎙️ Voice Controls')
    .setDescription(
      '> Use the buttons below to manage\n' +
      '> your voice channel.\n' +
      '\u200b'
    )
    .setFooter({
      text: '🔐 Only the channel creator can use these'
    });

  if (config.vcPanelImage) {
    embed.setImage(config.vcPanelImage);
  } else {
    embed.addFields(
      { name: '🔧 Channel', value: 'Rename  •  Limit  •  Delete', inline: true },
      { name: '🔒 Access', value: 'Lock  •  Unlock  •  Hide  •  Unhide  •  Wait', inline: true },
      { name: '\u200b', value: '\u200b', inline: false },
      { name: '👥 Members', value: 'Trust  •  Reject  •  Kick  •  Ban  •  Unban  •  Claim  •  Transfer', inline: true }
    );
  }

  // Row 1 — 5 buttons
  const row1 = new ActionRowBuilder().addComponents(
    buildButton('vc_rename',  e.vcRenameBtn,  'Name',     ButtonStyle.Secondary),
    buildButton('vc_limit',   e.vcLimitBtn,   'Limit',    ButtonStyle.Secondary),
    buildButton('vc_lock',    e.vcLockBtn,    'Lock',     ButtonStyle.Secondary),
    buildButton('vc_unlock',  e.vcUnlockBtn,  'Unlock',   ButtonStyle.Secondary),
    buildButton('vc_hide',    e.vcHideBtn,    'Hide',     ButtonStyle.Secondary),
  );

  // Row 2 — 5 buttons
  const row2 = new ActionRowBuilder().addComponents(
    buildButton('vc_unhide',  e.vcUnhideBtn,  'Unhide',   ButtonStyle.Secondary),
    buildButton('vc_waiting', e.vcWaitBtn,    'Waiting',  ButtonStyle.Secondary),
    buildButton('vc_trust',   e.vcTrustBtn,   'Trust',    ButtonStyle.Secondary),
    buildButton('vc_reject',  e.vcRejectBtn,  'Reject',   ButtonStyle.Secondary),
    buildButton('vc_kick',    e.vcKickBtn,    'Kick',     ButtonStyle.Secondary),
  );

  // Row 3 — 5 buttons
  const row3 = new ActionRowBuilder().addComponents(
    buildButton('vc_ban',      e.vcBanBtn,      'Ban',      ButtonStyle.Secondary),
    buildButton('vc_unban',    e.vcUnbanBtn,    'Unban',    ButtonStyle.Secondary),
    buildButton('vc_claim',    e.vcClaimBtn,    'Claim',    ButtonStyle.Secondary),
    buildButton('vc_transfer', e.vcTransferBtn, 'Transfer', ButtonStyle.Secondary),
    buildButton('vc_delete',   e.vcDeleteBtn,   'Delete',   ButtonStyle.Secondary),
  );

  return { embed, rows: [row1, row2, row3] };
}

module.exports = buildVcPanel;
