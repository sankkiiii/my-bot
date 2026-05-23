const { ActivityType } = require('discord.js');

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
    } catch (err) {
      console.error('[Ready]', err);
    }
  },
};
