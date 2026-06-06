const fs = require('fs');
const path = require('path');
const { ActivityType, ChannelType } = require('discord.js');
const config = require('../config');
const getConfig = require('../utils/getConfig');

const PRESENCE_PATH = path.join(__dirname, '..', 'data', 'presence.json');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    try {
      console.log(`[Ready] Logged in as ${client.user.username}`);

      // --- Safety init for creation Set ---
      if (!client.tempVCsCreating) {
        client.tempVCsCreating = new Set();
      }

      // --- Load saved presence or set default ---
      let presenceRestored = false;
      try {
        if (fs.existsSync(PRESENCE_PATH)) {
          const saved = JSON.parse(fs.readFileSync(PRESENCE_PATH, 'utf-8'));
          const typeMap = {
            PLAYING: ActivityType.Playing,
            WATCHING: ActivityType.Watching,
            LISTENING: ActivityType.Listening,
            COMPETING: ActivityType.Competing,
          };
          if (saved.type && saved.type !== 'CLEAR' && saved.text) {
            client.user.setPresence({
              activities: [{ name: saved.text, type: typeMap[saved.type] }],
              status: saved.status || 'online',
            });
            console.log(`[Ready] Restored presence: ${saved.type} ${saved.text}`);
            presenceRestored = true;
          }
        }
      } catch (err) {
        console.log('[Ready] No saved presence found, using default.');
      }

      if (!presenceRestored) {
        client.user.setPresence({
          activities: [{ name: 'your server \uD83D\uDC40', type: ActivityType.Watching }],
          status: 'online',
        });
      }

      // --- Ensure presence file exists ---
      try {
        if (!fs.existsSync(PRESENCE_PATH)) {
          fs.writeFileSync(PRESENCE_PATH, JSON.stringify({ type: null, text: null, status: 'online' }, null, 2));
          console.log('[Ready] Created data/presence.json');
        }
      } catch (err) {
        console.error('[Ready] Failed to init presence file:', err.message);
      }

      // --- Temp VC cleanup on startup ---
      try {
        let cleaned = 0;
        for (const [guildId, guild] of client.guilds.cache) {
          const cfg = getConfig(guildId);
          if (!cfg?.temp_vc_category) continue;

          const channels = guild.channels.cache.filter(
            (ch) =>
              ch.parentId === cfg.temp_vc_category &&
              ch.type === ChannelType.GuildVoice &&
              ch.id !== cfg.create_vc_channel &&
              ch.id !== cfg.create_duo_channel,
          );

          for (const [, channel] of channels) {
            const humanMembers = channel.members.filter((m) => !m.user.bot);
            if (humanMembers.size === 0) {
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
    } catch (err) {
      console.error('[Ready]', err);
    }
  },
};
