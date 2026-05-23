/**
 * Sends a log embed to a specified channel.
 * @param {import('discord.js').Client} client
 * @param {string} channelId
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function sendLog(client, channelId, embed) {
  try {
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`[Logger] Failed to send log to ${channelId}:`, err.message);
  }
}

module.exports = { sendLog };
