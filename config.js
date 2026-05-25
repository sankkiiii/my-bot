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
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  prefix: process.env.PREFIX || '!',
  ownerId: process.env.OWNER_ID,
};
