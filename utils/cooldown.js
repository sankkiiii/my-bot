const cooldowns = new Map();

module.exports = {
  check(commandName, userId, guildId, cooldownMs = 3000) {
    const key = `${commandName}:${userId}:${guildId}`;
    const now = Date.now();
    if (cooldowns.has(key)) {
      const expiry = cooldowns.get(key);
      if (now < expiry) {
        return expiry - now;
      }
    }
    cooldowns.set(key, now + cooldownMs);
    setTimeout(() => cooldowns.delete(key), cooldownMs);
    return 0;
  },
};
