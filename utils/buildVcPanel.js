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
      '**🔧 Channel:** Rename • Limit • Delete\n' +
      '**🔒 Access:** Lock • Unlock • Hide • Unhide\n' +
      '**👥 Members:** Trust • Kick • Ban • Unban • Claim • Transfer'
    )
    .setFooter({
      text: '🔐 Only the channel creator can use these'
    });

  if (config.vcPanelImage) {
    embed.setImage(config.vcPanelImage);
  }

  // Row 1 — 4 buttons
  const row1 = new ActionRowBuilder().addComponents(
    buildButton('vc_rename',  e.vcRenameBtn,  'Rename',     ButtonStyle.Secondary),
    buildButton('vc_limit',   e.vcLimitBtn,   'Limit',      ButtonStyle.Secondary),
    buildButton('vc_lock',    e.vcLockBtn,    'Lock',       ButtonStyle.Secondary),
    buildButton('vc_unlock',  e.vcUnlockBtn,  'Unlock',     ButtonStyle.Secondary),
  );

  // Row 2 — 4 buttons
  const row2 = new ActionRowBuilder().addComponents(
    buildButton('vc_hide',    e.vcHideBtn,    'Hide',       ButtonStyle.Secondary),
    buildButton('vc_unhide',  e.vcUnhideBtn,  'Unhide',     ButtonStyle.Secondary),
    buildButton('vc_trust',   e.vcTrustBtn,   'Trust',      ButtonStyle.Secondary),
    buildButton('vc_kick',    e.vcKickBtn,    'Kick',       ButtonStyle.Secondary),
  );

  // Row 3 — 4 buttons
  const row3 = new ActionRowBuilder().addComponents(
    buildButton('vc_ban',      e.vcBanBtn,      'Ban',        ButtonStyle.Secondary),
    buildButton('vc_unban',    e.vcUnbanBtn,    'Unban',      ButtonStyle.Secondary),
    buildButton('vc_claim',    e.vcClaimBtn,    'Claim',      ButtonStyle.Secondary),
    buildButton('vc_transfer', e.vcTransferBtn, 'Transfer',   ButtonStyle.Secondary),
  );

  return { embed, rows: [row1, row2, row3] };
}

module.exports = buildVcPanel;
