require('dotenv').config();

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
