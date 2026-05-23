const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  version: djsVersion,
} = require('discord.js');
const config = require('../../config');

const PRESENCE_PATH = path.join(__dirname, '..', '..', 'data', 'presence.json');

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function getPresenceInfo() {
  try {
    if (fs.existsSync(PRESENCE_PATH)) {
      const saved = JSON.parse(fs.readFileSync(PRESENCE_PATH, 'utf-8'));
      if (saved.type && saved.type !== 'CLEAR' && saved.text) {
        return `${saved.type}: ${saved.text}`;
      }
    }
  } catch {
    // ignore
  }
  return 'None';
}

function buildStatusEmbed(client, ping, latency, user) {
  const mem = process.memoryUsage();
  const memUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const memTotal = (mem.heapTotal / 1024 / 1024).toFixed(2);
  const uptime = formatUptime(process.uptime());
  const serverCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const channelCount = client.channels.cache.size;
  const commandCount = client.commands.size;
  const presence = client.user.presence;
  const statusText = presence?.status || 'online';
  const activity = getPresenceInfo();

  return new EmbedBuilder()
    .setTitle('\uD83D\uDCCA Bot Status')
    .setColor(0x5865f2)
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '\uD83C\uDFD3 API Ping', value: `${ping}ms`, inline: true },
      { name: '\u21A9\uFE0F Latency', value: `${latency}ms`, inline: true },
      { name: '\u23F1\uFE0F Uptime', value: uptime, inline: true },
      { name: '\uD83E\uDDE0 Memory', value: `${memUsed}MB / ${memTotal}MB`, inline: true },
      { name: '\uD83C\uDF10 Servers', value: `${serverCount}`, inline: true },
      { name: '\uD83D\uDC65 Users', value: `${userCount}`, inline: true },
      { name: '\uD83D\uDCE2 Channels', value: `${channelCount}`, inline: true },
      { name: '\u2699\uFE0F Commands', value: `${commandCount}`, inline: true },
      { name: '\uD83D\uDFE2 Status', value: statusText, inline: true },
      { name: '\uD83C\uDFAE Activity', value: activity, inline: true },
      { name: '\uD83D\uDD27 Node.js', value: process.version, inline: true },
      { name: '\uD83D\uDCE6 discord.js', value: `v${djsVersion}`, inline: true },
    )
    .setFooter({ text: `Requested by ${user.tag}` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show the bot current stats and health')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  name: 'status',
  aliases: ['stats', 'botinfo', 'info'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      if (isSlash) {
        const interaction = interactionOrMessage;

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '\u274C You need **Administrator** permission.',
            ephemeral: true,
          });
        }

        const sent = await interaction.reply({ content: 'Calculating...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const ping = client.ws.ping;

        const embed = buildStatusEmbed(client, ping, latency, interaction.user);
        await interaction.editReply({ content: null, embeds: [embed] });
      } else {
        const message = interactionOrMessage;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return message.reply('\u274C You need **Administrator** permission.');
        }

        const start = Date.now();
        const ping = client.ws.ping;
        const placeholder = await message.reply('Calculating...');
        const latency = Date.now() - start;

        const embed = buildStatusEmbed(client, ping, latency, message.author);
        await placeholder.edit({ content: null, embeds: [embed] });
      }
    } catch (err) {
      console.error('[Status]', err);
    }
  },
};
