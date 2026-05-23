const fs = require('fs');
const path = require('path');
const { ActivityType, ChannelType } = require('discord.js');
const config = require('../config');

const TICKET_COUNT_PATH = path.join(__dirname, '..', 'data', 'ticketCount.json');
const NOPREFIX_PATH = path.join(__dirname, '..', 'data', 'noprefix.json');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    try {
      console.log(`[Ready] Logged in as ${client.user.tag}`);
      client.user.setPresence({
        activities: [{ name: 'your server \uD83D\uDC40', type: ActivityType.Watching }],
        status: 'online',
      });

      // --- Ensure ticket counter file exists ---
      try {
        if (!fs.existsSync(TICKET_COUNT_PATH)) {
          fs.writeFileSync(TICKET_COUNT_PATH, JSON.stringify({ count: 0 }, null, 2));
          console.log('[Ready] Created data/ticketCount.json');
        } else {
          const data = JSON.parse(fs.readFileSync(TICKET_COUNT_PATH, 'utf-8'));
          console.log(`[Ready] Ticket counter loaded: ${data.count}`);
        }
      } catch (err) {
        console.error('[Ready] Failed to init ticket counter:', err.message);
      }

      // --- Ensure no-prefix file exists ---
      try {
        if (!fs.existsSync(NOPREFIX_PATH)) {
          fs.writeFileSync(NOPREFIX_PATH, JSON.stringify({ users: [] }, null, 2));
          console.log('[Ready] Created data/noprefix.json');
        } else {
          const data = JSON.parse(fs.readFileSync(NOPREFIX_PATH, 'utf-8'));
          console.log(`[Ready] No-prefix users loaded: ${data.users.length}`);
        }
      } catch (err) {
        console.error('[Ready] Failed to init noprefix file:', err.message);
      }

      // --- Owner ID check ---
      if (!config.ownerId) {
        console.log('[Ready] WARNING: OWNER_ID not set in .env, owner no-prefix disabled');
      }

      // --- Temp VC cleanup on startup ---
      if (config.tempVcCategory) {
        try {
          let cleaned = 0;
          for (const guild of client.guilds.cache.values()) {
            const channels = guild.channels.cache.filter(
              (ch) =>
                ch.parentId === config.tempVcCategory &&
                ch.type === ChannelType.GuildVoice &&
                ch.id !== config.createVcChannel &&
                ch.id !== config.createDuoChannel,
            );

            for (const [, channel] of channels) {
              if (channel.members.size === 0) {
                await channel.delete().catch((err) =>
                  console.error(`[Ready] Failed to delete leftover VC ${channel.name}:`, err.message),
                );
                cleaned++;
              }
            }
          }
          if (cleaned > 0) {
            console.log(`[Ready] Cleaned up ${cleaned} leftover temp VC(s)`);
          } else {
            console.log('[Ready] No leftover temp VCs to clean up');
          }
        } catch (err) {
          console.error('[Ready] Temp VC cleanup error:', err.message);
        }
      } else {
        console.log('[Ready] TEMP_VC_CATEGORY not set, skipping temp VC cleanup');
      }
    } catch (err) {
      console.error('[Ready]', err);
    }
  },
};
