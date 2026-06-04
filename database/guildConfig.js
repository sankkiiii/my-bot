const db = require('./db');

const noPrefixCache = new Map();
const NO_PREFIX_TTL_MS = 60 * 1000;

function getCachedNoPrefix(guildId) {
  const cached = noPrefixCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < NO_PREFIX_TTL_MS) {
    return cached.users;
  }
  return null;
}

function setCachedNoPrefix(guildId, users) {
  noPrefixCache.set(guildId, { users, timestamp: Date.now() });
}

function invalidateNoPrefix(guildId) {
  noPrefixCache.delete(guildId);
}

module.exports = {

  // Get full config for a guild
  getConfig(guildId) {
    try {
      return db.prepare(
        'SELECT * FROM guild_configs WHERE guild_id = ?',
      ).get(guildId) || null;
    } catch (err) {
      console.error(`[DB] getConfig failed for ${guildId}:`, err.message);
      return null;
    }
  },

  // Set a specific key for a guild
  setKey(guildId, key, value) {
    try {
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
    } catch (err) {
      console.error(`[DB] setKey failed for ${guildId}:${key}:`, err.message);
    }
  },

  // Set multiple keys at once
  setMany(guildId, data) {
    try {
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
    } catch (err) {
      console.error(`[DB] setMany failed for ${guildId}:`, err.message);
    }
  },

  // Delete config for a guild (reset)
  deleteConfig(guildId) {
    try {
      db.prepare(
        'DELETE FROM guild_configs WHERE guild_id = ?',
      ).run(guildId);
    } catch (err) {
      console.error(`[DB] deleteConfig failed for ${guildId}:`, err.message);
    }
  },

  // Ticket count operations
  getTicketCount(guildId) {
    try {
      const row = db.prepare(
        'SELECT count FROM ticket_count WHERE guild_id = ?',
      ).get(guildId);
      return row?.count || 0;
    } catch (err) {
      console.error(`[DB] getTicketCount failed for ${guildId}:`, err.message);
      return 0;
    }
  },

  incrementTicketCount(guildId) {
    try {
      db.prepare(`
        INSERT INTO ticket_count (guild_id, count) VALUES (?, 1)
        ON CONFLICT(guild_id) DO UPDATE SET count = count + 1
      `).run(guildId);
      return this.getTicketCount(guildId);
    } catch (err) {
      console.error(`[DB] incrementTicketCount failed for ${guildId}:`, err.message);
      return 0;
    }
  },

  // Noprefix operations
  getNoPrefixUsers(guildId) {
    try {
      const cached = getCachedNoPrefix(guildId);
      if (cached) return cached;
      const users = db.prepare(
        'SELECT user_id FROM noprefix_users WHERE guild_id = ?',
      ).all(guildId).map((r) => r.user_id);
      setCachedNoPrefix(guildId, users);
      return users;
    } catch (err) {
      console.error(`[DB] getNoPrefixUsers failed for ${guildId}:`, err.message);
      return [];
    }
  },

  addNoPrefixUser(guildId, userId, addedBy) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO noprefix_users
        (guild_id, user_id, added_by, added_at)
        VALUES (?, ?, ?, ?)
      `).run(guildId, userId, addedBy, new Date().toISOString());
      invalidateNoPrefix(guildId);
    } catch (err) {
      console.error(`[DB] addNoPrefixUser failed for ${guildId}:${userId}:`, err.message);
    }
  },

  removeNoPrefixUser(guildId, userId) {
    try {
      db.prepare(
        'DELETE FROM noprefix_users WHERE guild_id = ? AND user_id = ?',
      ).run(guildId, userId);
      invalidateNoPrefix(guildId);
    } catch (err) {
      console.error(`[DB] removeNoPrefixUser failed for ${guildId}:${userId}:`, err.message);
    }
  },

  isNoPrefixUser(guildId, userId) {
    const users = this.getNoPrefixUsers(guildId);
    return users.includes(userId);
  },

  // AFK operations
  setAFK(guildId, userId, reason) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO afk_users
        (guild_id, user_id, reason, set_at)
        VALUES (?, ?, ?, ?)
      `).run(guildId, userId, reason, new Date().toISOString());
    } catch (err) {
      console.error(`[DB] setAFK failed for ${guildId}:${userId}:`, err.message);
    }
  },

  removeAFK(guildId, userId) {
    try {
      db.prepare(
        'DELETE FROM afk_users WHERE guild_id = ? AND user_id = ?',
      ).run(guildId, userId);
    } catch (err) {
      console.error(`[DB] removeAFK failed for ${guildId}:${userId}:`, err.message);
    }
  },

  getAFK(guildId, userId) {
    try {
      return db.prepare(
        'SELECT * FROM afk_users WHERE guild_id = ? AND user_id = ?',
      ).get(guildId, userId) || null;
    } catch (err) {
      console.error(`[DB] getAFK failed for ${guildId}:${userId}:`, err.message);
      return null;
    }
  },

  isAFK(guildId, userId) {
    try {
      return !!db.prepare(
        'SELECT 1 FROM afk_users WHERE guild_id = ? AND user_id = ?',
      ).get(guildId, userId);
    } catch (err) {
      return false;
    }
  },

  // Bot owner operations
  getOwners() {
    try {
      return db.prepare(
        'SELECT user_id FROM bot_owners'
      ).all().map(r => r.user_id);
    } catch (err) {
      console.error(`[DB] getOwners failed:`, err.message);
      return [];
    }
  },

  isOwner(userId) {
    try {
      return !!db.prepare(
        'SELECT 1 FROM bot_owners WHERE user_id = ?'
      ).get(userId);
    } catch (err) {
      return false;
    }
  },

  addOwner(userId, addedBy) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO bot_owners (user_id, added_by, added_at)
        VALUES (?, ?, ?)
      `).run(userId, addedBy, new Date().toISOString());
    } catch (err) {
      console.error(`[DB] addOwner failed for ${userId}:`, err.message);
    }
  },

  removeOwner(userId) {
    try {
      db.prepare(
        'DELETE FROM bot_owners WHERE user_id = ?'
      ).run(userId);
    } catch (err) {
      console.error(`[DB] removeOwner failed for ${userId}:`, err.message);
    }
  },
};
