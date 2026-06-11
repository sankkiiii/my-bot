require('dotenv').config();

// Validate required env vars at startup — fail fast with clear error messages
const required = ['TOKEN', 'CLIENT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Config] FATAL: Missing required env var: ${key}`);
    console.error('[Config] Check your .env file. Bot cannot start.');
    process.exit(1);
  }
}

module.exports = {
  // ── BOT CREDENTIALS (from .env) ──
  token:    process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId:  process.env.GUILD_ID,
  prefix:   process.env.PREFIX || '!',

  // ── PERMANENT HARDCODED VALUES ──
  // Edit these directly in this file
  // Restart bot after any changes here

  // Bot owners — add Discord user IDs here
  // These users bypass ALL command restrictions silently
  ownerIds: [
    '874953017227628554',
    '1120319562815115305',
    '447196156343222321'
  ],

  // VC Control Panel image URL
  // Upload image to Discord CDN → right click → Copy Link
  // Set to null to use text buttons instead
  vcPanelImage: 'https://media.discordapp.net/attachments/1322874646416064624/1514424733595341032/content.png?ex=6a2b5171&is=6a29fff1&hm=619992ab927b2e6a9c46fdd88d42e95b834ba5d80ffe2dc01bc4e785868d5852&=&format=webp&quality=lossless&width=1330&height=477',
};
