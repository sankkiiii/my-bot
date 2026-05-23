/**
 * Resolve a guild member from any input format: @mention, user ID, or username/display name search.
 * @param {string} input - Raw user input (mention, ID, or name)
 * @param {import('discord.js').Guild} guild - The guild to search in
 * @returns {Promise<import('discord.js').GuildMember|null>}
 */
module.exports = async function resolveUser(input, guild) {
  if (!input) return null;

  const cleaned = input.replace(/[<@!>]/g, '').trim();
  if (!cleaned) return null;

  // 1. Try direct User ID (17-19 digit snowflake)
  if (/^\d{17,19}$/.test(cleaned)) {
    try {
      const member = await guild.members.fetch(cleaned);
      if (member) return member;
    } catch {}
  }

  // 2. Try username / displayName / nickname search (case insensitive)
  try {
    const members = await guild.members.fetch();
    const lower = cleaned.toLowerCase();

    // Exact username match
    const exactUsername = members.find((m) => m.user.username.toLowerCase() === lower);
    if (exactUsername) return exactUsername;

    // Exact display name match
    const exactDisplay = members.find((m) => m.displayName.toLowerCase() === lower);
    if (exactDisplay) return exactDisplay;

    // Partial username match
    const partialUsername = members.find((m) => m.user.username.toLowerCase().includes(lower));
    if (partialUsername) return partialUsername;

    // Partial display name match
    const partialDisplay = members.find((m) => m.displayName.toLowerCase().includes(lower));
    if (partialDisplay) return partialDisplay;
  } catch {}

  return null;
};
