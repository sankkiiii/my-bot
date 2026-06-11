const db = require('./db');
const guildConfig = require('./guildConfig');
const fs = require('fs');
const path = require('path');

module.exports = function migrate() {
  // Migrate noprefix.json → noprefix_users table
  const noprefixPath = path.join(__dirname, '../data/noprefix.json');
  if (fs.existsSync(noprefixPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(noprefixPath, 'utf8'));
      // Old JSON had no guild_id — use GUILD_ID from env as fallback
      const guildId = process.env.GUILD_ID;
      if (guildId && data.users?.length) {
        data.users.forEach((userId) => {
          guildConfig.addNoPrefixUser(guildId, userId, 'migrated');
        });
        console.log(`[Migrate] Migrated ${data.users.length} noprefix users`);
      }
      fs.renameSync(
        noprefixPath,
        path.join(__dirname, '../data/noprefix.json.migrated'),
      );
    } catch (e) {
      console.error('[Migrate] noprefix migration failed:', e.message);
    }
  }

  // Migrate ticketCount.json → ticket_count table
  const ticketCountPath = path.join(__dirname, '../data/ticketCount.json');
  if (fs.existsSync(ticketCountPath)) {
    try {
      const data = JSON.parse(
        fs.readFileSync(ticketCountPath, 'utf8'),
      );
      const guildId = process.env.GUILD_ID;
      if (guildId && data.count > 0) {
        db.prepare(`
          INSERT OR IGNORE INTO ticket_count (guild_id, count)
          VALUES (?, ?)
        `).run(guildId, data.count);
        console.log(`[Migrate] Migrated ticket count: ${data.count}`);
      }
      fs.renameSync(
        ticketCountPath,
        path.join(__dirname, '../data/ticketCount.json.migrated'),
      );
    } catch (e) {
      console.error('[Migrate] ticketCount migration failed:', e.message);
    }
  }

  console.log('[Migrate] Migration check complete');
};
