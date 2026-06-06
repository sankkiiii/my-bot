const config = require('../config');

module.exports = function isOwner(userId) {
  if (!userId) return false;
  try {
    return Array.isArray(config.ownerIds) &&
           config.ownerIds.includes(String(userId));
  } catch {
    return false;
  }
};
