/**
 * Generates an HTML transcript from an array of Discord messages.
 * @param {import('discord.js').Message[]} messages - Sorted oldest-first.
 * @param {{ ticketName: string, openedBy: string, closedBy: string, guildName: string }} ticketInfo
 * @returns {Buffer}
 */
function generateTranscript(messages, ticketInfo) {
  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const formatTimestamp = (date) =>
    new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

  let messagesHtml = '';

  for (const msg of messages) {
    const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const username = escapeHtml(msg.author.tag || `${msg.author.username}#${msg.author.discriminator}`);
    const isBot = msg.author.bot;
    const timestamp = formatTimestamp(msg.createdAt);
    const content = escapeHtml(msg.content || '');

    let embedsHtml = '';
    if (msg.embeds && msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        const embedTitle = embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : '';
        const embedDesc = embed.description ? `<div class="embed-desc">${escapeHtml(embed.description)}</div>` : '';
        let fieldsHtml = '';
        if (embed.fields && embed.fields.length > 0) {
          fieldsHtml = '<div class="embed-fields">';
          for (const field of embed.fields) {
            fieldsHtml += `<div class="embed-field"><strong>${escapeHtml(field.name)}</strong><br>${escapeHtml(field.value)}</div>`;
          }
          fieldsHtml += '</div>';
        }
        embedsHtml += `<div class="embed-block">${embedTitle}${embedDesc}${fieldsHtml}</div>`;
      }
    }

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.size > 0) {
      for (const [, att] of msg.attachments) {
        attachmentsHtml += `<div class="attachment"><a href="${escapeHtml(att.url)}" target="_blank">${escapeHtml(att.name || 'attachment')}</a></div>`;
      }
    }

    const roleTag = isBot ? '<span class="bot-tag">BOT</span>' : '';

    messagesHtml += `
      <div class="message">
        <img class="avatar" src="${avatarUrl}" alt="avatar" />
        <div class="message-body">
          <div class="message-header">
            <span class="username">${username}</span>
            ${roleTag}
            <span class="timestamp">${timestamp}</span>
          </div>
          ${content ? `<div class="content">${content}</div>` : ''}
          ${embedsHtml}
          ${attachmentsHtml}
        </div>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(ticketInfo.ticketName)} — ${escapeHtml(ticketInfo.guildName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #36393f;
    color: #dcddde;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px;
    line-height: 1.4;
  }
  .header {
    background: #2f3136;
    padding: 24px 32px;
    border-bottom: 2px solid #202225;
  }
  .header h1 {
    color: #fff;
    font-size: 22px;
    margin-bottom: 8px;
  }
  .header .meta {
    color: #b9bbbe;
    font-size: 13px;
    line-height: 1.8;
  }
  .messages {
    padding: 16px 32px;
  }
  .message {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #40444b;
  }
  .message:last-child { border-bottom: none; }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 16px;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .message-body { flex: 1; min-width: 0; }
  .message-header { margin-bottom: 4px; }
  .username {
    color: #fff;
    font-weight: 600;
    margin-right: 6px;
  }
  .bot-tag {
    background: #5865f2;
    color: #fff;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 600;
    margin-right: 6px;
    vertical-align: middle;
  }
  .timestamp {
    color: #72767d;
    font-size: 12px;
  }
  .content {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .embed-block {
    background: #2f3136;
    border-left: 4px solid #5865f2;
    border-radius: 4px;
    padding: 12px;
    margin-top: 6px;
  }
  .embed-title {
    color: #fff;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .embed-desc {
    color: #dcddde;
    font-size: 14px;
    white-space: pre-wrap;
  }
  .embed-fields { margin-top: 8px; }
  .embed-field {
    display: inline-block;
    vertical-align: top;
    margin-right: 16px;
    margin-bottom: 6px;
    font-size: 14px;
  }
  .attachment {
    margin-top: 6px;
  }
  .attachment a {
    color: #00aff4;
    text-decoration: none;
  }
  .attachment a:hover { text-decoration: underline; }
  .footer {
    background: #2f3136;
    padding: 16px 32px;
    border-top: 2px solid #202225;
    color: #72767d;
    font-size: 12px;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(ticketInfo.guildName)}</h1>
    <div class="meta">
      <strong>Ticket:</strong> ${escapeHtml(ticketInfo.ticketName)}<br>
      <strong>Opened by:</strong> ${escapeHtml(ticketInfo.openedBy)}<br>
      <strong>Closed by:</strong> ${escapeHtml(ticketInfo.closedBy)}<br>
      <strong>Date:</strong> ${formatTimestamp(Date.now())}<br>
      <strong>Messages:</strong> ${messages.length}
    </div>
  </div>
  <div class="messages">
    ${messagesHtml}
  </div>
  <div class="footer">
    Transcript generated for ${escapeHtml(ticketInfo.guildName)}
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}

module.exports = { generateTranscript };
