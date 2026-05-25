const db = require('./db');

module.exports = {

  // Get full config for a guild
  getConfig(guildId) {
    return db.prepare(
      'SELECT * FROM guild_configs WHERE guild_id = ?',
    ).get(guildId) || null;
  },

  // Set a specific key for a guild
  setKey(guildId, key, value) {
    const existing = this.getConfig(guildId);
    if (existing) {
      db.prepare(`
        UPDATE guild_configs
        SET ${key} = ?, updated_at = ?
        WHERE guild_id = ?
      `).run(value, new Date().toISOString(), guildId);
    } else {
      db.prepare(`
        INSERT INTO guild_configs (guild_id, ${key}, updated_at)
        VALUES (?, ?, ?)
      `).run(guildId, value, new Date().toISOString());
    }
  },

  // Set multiple keys at once
  setMany(guildId, data) {
    const existing = this.getConfig(guildId);
    const now = new Date().toISOString();
    if (existing) {
      const keys = Object.keys(data);
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = [...Object.values(data), now, guildId];
      db.prepare(`
        UPDATE guild_configs
        SET ${setClause}, updated_at = ?
        WHERE guild_id = ?
      `).run(...values);
    } else {
      const keys = ['guild_id', ...Object.keys(data), 'updated_at'];
      const placeholders = keys.map(() => '?').join(', ');
      const values = [guildId, ...Object.values(data), now];
      db.prepare(`
        INSERT INTO guild_configs (${keys.join(', ')})
        VALUES (${placeholders})
      `).run(...values);
    }
  },

  // Delete config for a guild (reset)
  deleteConfig(guildId) {
    db.prepare(
      'DELETE FROM guild_configs WHERE guild_id = ?',
    ).run(guildId);
  },

  // Ticket count operations
  getTicketCount(guildId) {
    const row = db.prepare(
      'SELECT count FROM ticket_count WHERE guild_id = ?',
    ).get(guildId);
    return row?.count || 0;
  },

  incrementTicketCount(guildId) {
    db.prepare(`
      INSERT INTO ticket_count (guild_id, count) VALUES (?, 1)
      ON CONFLICT(guild_id) DO UPDATE SET count = count + 1
    `).run(guildId);
    return this.getTicketCount(guildId);
  },

  // Noprefix operations
  getNoPrefixUsers(guildId) {
    return db.prepare(
      'SELECT user_id FROM noprefix_users WHERE guild_id = ?',
    ).all(guildId).map((r) => r.user_id);
  },

  addNoPrefixUser(guildId, userId, addedBy) {
    db.prepare(`
      INSERT OR IGNORE INTO noprefix_users
      (guild_id, user_id, added_by, added_at)
      VALUES (?, ?, ?, ?)
    `).run(guildId, userId, addedBy, new Date().toISOString());
  },

  removeNoPrefixUser(guildId, userId) {
    db.prepare(
      'DELETE FROM noprefix_users WHERE guild_id = ? AND user_id = ?',
    ).run(guildId, userId);
  },

  isNoPrefixUser(guildId, userId) {
    return !!db.prepare(
      'SELECT 1 FROM noprefix_users WHERE guild_id = ? AND user_id = ?',
    ).get(guildId, userId);
  },
};
