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
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { withEmoji } = require('../../utils/emoji');
const formatDuration = require('../../utils/formatDuration');

function getPresenceInfo() {
  const PRESENCE_PATH = path.join(__dirname, '..', '..', 'data', 'presence.json');
  try {
    if (fs.existsSync(PRESENCE_PATH)) {
      const data = JSON.parse(fs.readFileSync(PRESENCE_PATH, 'utf-8'));
      if (data.type === 'CLEAR') return 'None';
      return `${data.type.charAt(0) + data.type.slice(1).toLowerCase()} ${data.text}`;
    }
  } catch (err) {
    console.error('[Status] Failed to read presence.json:', err);
  }
  return 'None';
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
}

function buildStatusEmbed(client, ping, latency, user) {
  const mem = process.memoryUsage();
  const memUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const uptime = formatUptime(process.uptime());
  const guilds = client.guilds.cache.size;
  const users = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const commands = client.commands.size;
  const presence = getPresenceInfo();

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setAuthor({
      name: client.user.username,
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setDescription(
      `**Performance**\n` +
      `${withEmoji('ping', `Ping: ${ping}ms`)}\n` +
      `${withEmoji('latency', `Latency: ${latency}ms`)}\n` +
      `${withEmoji('uptime', `Uptime: ${uptime}`)}\n` +
      `${withEmoji('memory', `Memory: ${memUsed}MB`)}\n\n` +

      `**Stats**\n` +
      `${withEmoji('servers', `Servers: ${guilds}`)}\n` +
      `${withEmoji('members', `Users: ${users}`)}\n` +
      `${withEmoji('commands', `Commands: ${commands}`)}\n\n` +

      `**System**\n` +
      `${withEmoji('nodejs', `Node.js: ${process.version}`)}\n` +
      `${withEmoji('djs', `discord.js: v${djsVersion}`)}\n` +
      `${presence && presence !== 'None' ? `\n**Activity**\n${withEmoji('playing', presence)}` : ''}`
    )
    .setFooter({ text: `Requested by ${user.tag}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show bot statistics and status'),

  name: 'status',
  aliases: ['stats', 'botstats', 'info', 'botinfo'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;

    try {
      if (isSlash) {
        const interaction = interactionOrMessage;
        const remaining = cooldown.check('status', interaction.user.id, interaction.guild?.id || 'DM', 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return slashError(interaction, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
        }

        const start = Date.now();
        await interaction.deferReply();
        const latency = Date.now() - start;
        const ping = client.ws.ping;

        const embed = buildStatusEmbed(client, ping, latency, interaction.user);
        await interaction.editReply({ embeds: [embed] });
      } else {
        const message = interactionOrMessage;
        const remaining = cooldown.check('status', message.author.id, message.guild?.id || 'DM', 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return prefixError(message, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
        }

        const start = Date.now();
        const placeholder = await message.reply(withEmoji('loading', 'Fetching status...'));
        const latency = Date.now() - start;
        const ping = client.ws.ping;

        const embed = buildStatusEmbed(client, ping, latency, message.author);
        await placeholder.edit({ content: null, embeds: [embed] });
      }
    } catch (err) {
      console.error('[Status]', err);
    }
  },
};
