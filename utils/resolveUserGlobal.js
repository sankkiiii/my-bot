const resolveUser = require('./resolveUser');

/**
 * Resolve a user from any input format, with fallback to global Discord user fetch.
 * Tries guild member first (for server-specific info), then global user by ID.
 * @param {string} input - Raw user input (mention, ID, or name)
 * @param {import('discord.js').Guild} guild - The guild to search in
 * @param {import('discord.js').Client} client - The Discord client
 * @returns {Promise<{ member: import('discord.js').GuildMember|null, user: import('discord.js').User|null, inGuild: boolean }>}
 */
module.exports = async function resolveUserGlobal(input, guild, client) {
  if (!input) return { member: null, user: null, inGuild: false };

  const cleaned = input.replace(/[<@!>]/g, '').trim();
  if (!cleaned) return { member: null, user: null, inGuild: false };

  // STEP 1: Try resolving as guild member
  try {
    const member = await resolveUser(cleaned, guild);
    if (member) {
      const user = await client.users.fetch(member.id, { force: true });
      return { member, user, inGuild: true };
    }
  } catch {}

  // STEP 2: Try fetching as global Discord user by ID
  if (/^\d{17,19}$/.test(cleaned)) {
    try {
      const user = await client.users.fetch(cleaned, { force: true });
      if (user) return { member: null, user, inGuild: false };
    } catch {}
  }

  return { member: null, user: null, inGuild: false };
};
