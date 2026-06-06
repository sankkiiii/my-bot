const guildConfig = require('../database/guildConfig');

module.exports = function isOwner(userId) {
  try {
    return guildConfig.isOwner(userId);
  } catch {
    return false;
  }
};
