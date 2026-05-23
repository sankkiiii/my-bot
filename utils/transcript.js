/**
 * Generates a professional HTML transcript from Discord messages.
 * @param {import('discord.js').Message[]} messages - Sorted oldest-first.
 * @param {{
 *   ticketName: string,
 *   openedBy: string,
 *   closedBy: string,
 *   guildName: string,
 *   guildIconUrl?: string,
 *   botTag?: string,
 * }} ticketInfo
 * @returns {Buffer}
 */
function generateTranscript(messages, ticketInfo) {
  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const linkify = (text) =>
    escapeHtml(text).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    );

  const formatTimestamp = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  let messagesHtml = '';

  for (const msg of messages) {
    const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const username = escapeHtml(msg.author.tag || `${msg.author.username}#${msg.author.discriminator}`);
    const isBot = msg.author.bot;
    const timestamp = formatTimestamp(msg.createdAt);

    // Get role color
    let usernameColor = '#ffffff';
    if (msg.member && msg.member.displayHexColor && msg.member.displayHexColor !== '#000000') {
      usernameColor = msg.member.displayHexColor;
    }

    const contentHtml = msg.content ? linkify(msg.content).replace(/\n/g, '<br>') : '';

    // Embeds
    let embedsHtml = '';
    if (msg.embeds && msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        const borderColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865f2';
        const embedTitle = embed.title
          ? `<div class="embed-title">${escapeHtml(embed.title)}</div>`
          : '';
        const embedDesc = embed.description
          ? `<div class="embed-desc">${linkify(embed.description).replace(/\n/g, '<br>')}</div>`
          : '';
        let fieldsHtml = '';
        if (embed.fields && embed.fields.length > 0) {
          fieldsHtml = '<div class="embed-fields">';
          for (const field of embed.fields) {
            const inlineClass = field.inline ? ' inline' : '';
            fieldsHtml += `<div class="embed-field${inlineClass}"><div class="field-name">${escapeHtml(field.name)}</div><div class="field-value">${escapeHtml(field.value)}</div></div>`;
          }
          fieldsHtml += '</div>';
        }
        const embedFooter = embed.footer
          ? `<div class="embed-footer">${escapeHtml(embed.footer.text)}</div>`
          : '';
        embedsHtml += `<div class="embed-block" style="border-left-color:${borderColor}">${embedTitle}${embedDesc}${fieldsHtml}${embedFooter}</div>`;
      }
    }

    // Attachments
    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.size > 0) {
      for (const [, att] of msg.attachments) {
        attachmentsHtml += `<div class="attachment">\uD83D\uDCCE <a href="${escapeHtml(att.url)}" target="_blank">${escapeHtml(att.name || 'attachment')}</a></div>`;
      }
    }

    const botTag = isBot ? '<span class="bot-tag">BOT</span>' : '';
    const msgBgClass = isBot ? ' bot-message' : '';

    messagesHtml += `
      <div class="message${msgBgClass}">
        <img class="avatar" src="${avatarUrl}" alt="avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22%235865f2%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2218%22>${escapeHtml(msg.author.username.charAt(0).toUpperCase())}</text></svg>'" />
        <div class="message-body">
          <div class="message-header">
            <span class="username" style="color:${usernameColor}">${username}</span>
            ${botTag}
            <span class="timestamp">${timestamp}</span>
          </div>
          ${contentHtml ? `<div class="content">${contentHtml}</div>` : ''}
          ${embedsHtml}
          ${attachmentsHtml}
        </div>
      </div>`;
  }

  const serverIcon = ticketInfo.guildIconUrl
    ? `<img class="server-icon" src="${escapeHtml(ticketInfo.guildIconUrl)}" alt="icon" onerror="this.style.display='none'" />`
    : '<div class="server-icon-placeholder"></div>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(ticketInfo.ticketName)} \u2014 ${escapeHtml(ticketInfo.guildName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #36393f;
    color: #dcddde;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
  }
  a { color: #00aff4; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Header */
  .header {
    background: #2f3136;
    padding: 28px 32px;
    border-bottom: 3px solid #202225;
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }
  .server-icon, .server-icon-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .server-icon-placeholder {
    background: #5865f2;
  }
  .header-info { flex: 1; }
  .header h1 {
    color: #fff;
    font-size: 24px;
    margin-bottom: 12px;
    font-weight: 700;
  }
  .header .meta {
    color: #b9bbbe;
    font-size: 13px;
    line-height: 2;
  }
  .header .meta strong {
    color: #dcddde;
  }
  .divider {
    height: 1px;
    background: #40444b;
    margin: 16px 0 0 0;
  }

  /* Messages */
  .messages {
    padding: 8px 32px;
  }
  .message {
    display: flex;
    padding: 10px 8px;
    border-radius: 4px;
    margin: 2px 0;
  }
  .message:hover { background: #32353b; }
  .bot-message { background: #2a2d31; }
  .bot-message:hover { background: #282b30; }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    object-fit: cover;
  }
  .message-body { flex: 1; min-width: 0; }
  .message-header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }
  .username {
    font-weight: 600;
    font-size: 15px;
  }
  .bot-tag {
    background: #5865f2;
    color: #fff;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 600;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .timestamp {
    color: #72767d;
    font-size: 12px;
    margin-left: auto;
  }
  .content {
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-size: 15px;
    line-height: 1.5;
  }

  /* Embeds */
  .embed-block {
    background: #2f3136;
    border-left: 4px solid #5865f2;
    border-radius: 4px;
    padding: 12px 16px;
    margin-top: 8px;
    max-width: 520px;
  }
  .embed-title {
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 6px;
  }
  .embed-desc {
    color: #dcddde;
    font-size: 14px;
    margin-bottom: 8px;
  }
  .embed-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .embed-field {
    min-width: 100%;
    margin-bottom: 4px;
  }
  .embed-field.inline {
    min-width: 0;
    flex: 1;
    min-width: 120px;
  }
  .field-name {
    color: #dcddde;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .field-value {
    color: #b9bbbe;
    font-size: 14px;
  }
  .embed-footer {
    color: #72767d;
    font-size: 12px;
    margin-top: 8px;
  }

  /* Attachments */
  .attachment {
    margin-top: 6px;
    font-size: 14px;
  }

  /* Footer */
  .footer {
    background: #2f3136;
    padding: 20px 32px;
    border-top: 3px solid #202225;
    color: #72767d;
    font-size: 12px;
    text-align: center;
    line-height: 1.8;
  }
</style>
</head>
<body>
  <div class="header">
    ${serverIcon}
    <div class="header-info">
      <h1>${escapeHtml(ticketInfo.guildName)}</h1>
      <div class="meta">
        <strong>Ticket:</strong> ${escapeHtml(ticketInfo.ticketName)}<br>
        <strong>Opened by:</strong> ${escapeHtml(ticketInfo.openedBy)}<br>
        <strong>Closed by:</strong> ${escapeHtml(ticketInfo.closedBy)}<br>
        <strong>Date opened:</strong> ${messages.length > 0 ? formatTimestamp(messages[0].createdAt) : 'N/A'}<br>
        <strong>Date closed:</strong> ${formatTimestamp(Date.now())}<br>
        <strong>Total messages:</strong> ${messages.length}
      </div>
      <div class="divider"></div>
    </div>
  </div>
  <div class="messages">
    ${messagesHtml}
  </div>
  <div class="footer">
    Generated by ${escapeHtml(ticketInfo.botTag || 'Bot')}<br>
    ${formatTimestamp(Date.now())}
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}

module.exports = { generateTranscript };
