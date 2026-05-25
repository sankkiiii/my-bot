const configCache = require('./configCache');

module.exports = function getConfig(guildId) {
  if (!guildId) return null;
  return configCache.get(guildId) || {};
};
