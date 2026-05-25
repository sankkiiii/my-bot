const guildConfig = require('../database/guildConfig');

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

module.exports = {
  get(guildId) {
    const cached = cache.get(guildId);
    if (cached && Date.now() - cached.timestamp < TTL) {
      return cached.data;
    }
    const data = guildConfig.getConfig(guildId);
    cache.set(guildId, { data, timestamp: Date.now() });
    return data;
  },

  invalidate(guildId) {
    cache.delete(guildId);
  },

  set(guildId, data) {
    cache.set(guildId, { data, timestamp: Date.now() });
  },
};
