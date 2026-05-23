require('dotenv').config();

// Validate required env vars at startup — fail fast with clear error messages
const required = ['TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Config] FATAL: Missing required env var: ${key}`);
    console.error('[Config] Check your .env file. Bot cannot start.');
    process.exit(1);
  }
}

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  prefix: process.env.PREFIX || '!',
  ticketLogChannel: process.env.TICKET_LOG_CHANNEL,
  transcriptChannel: process.env.TRANSCRIPT_CHANNEL,
  ticketCategory: process.env.TICKET_CATEGORY,
  tempVcCategory: process.env.TEMP_VC_CATEGORY,
  createVcChannel: process.env.CREATE_VC_CHANNEL,
  createDuoChannel: process.env.CREATE_DUO_CHANNEL,
  ownerId: process.env.OWNER_ID,
};
