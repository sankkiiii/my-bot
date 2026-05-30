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
const { success, error, withEmoji, getEmoji } = require('../../utils/emoji');

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
  } catch (err) {
    console.error('[Status] Failed to read presence:', err);
  }
  return 'None';
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
      `${withEmoji('ping', `**Ping:** ${ping}ms`)}\n` +
      `${withEmoji('latency', `**Latency:** ${latency}ms`)}\n` +
      `${withEmoji('uptime', `**Uptime:** ${uptime}`)}\n` +
      `${withEmoji('memory', `**Memory:** ${memUsed}MB`)}\n` +
      `${withEmoji('servers', `**Servers:** ${guilds}`)}\n` +
      `${withEmoji('members', `**Users:** ${users}`)}\n` +
      `${withEmoji('commands', `**Commands:** ${commands}`)}\n` +
      `${withEmoji('nodejs', `**Node.js:** ${process.version}`)}\n` +
      `${withEmoji('djs', `**discord.js:** v${djsVersion}`)}\n` +
      `${presence && presence !== 'None' ? `${withEmoji('playing', `**Activity:** ${presence}`)}` : ''}`
    )
    .setFooter({ text: `Requested by ${user.tag}` });
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
        if (!interaction.guild) {
          return slashError(interaction, 'This command only works in a server.');
        }

        const remaining = cooldown.check('status', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return slashError(interaction, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return slashError(interaction, error('You need **Administrator** permission.'));
        }

        const sent = await slashSuccess(interaction, { content: 'Calculating...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const ping = client.ws.ping;

        const embed = buildStatusEmbed(client, ping, latency, interaction.user);
        await interaction.editReply({ content: null, embeds: [embed] });
      } else {
        const message = interactionOrMessage;
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }

        const remaining = cooldown.check('status', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return prefixError(message, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return prefixError(message, error('You need **Administrator** permission.'));
        }

        const start = Date.now();
        const ping = client.ws.ping;
        const placeholder = await prefixSuccess(message, { content: 'Calculating...' });
        const latency = Date.now() - start;

        const embed = buildStatusEmbed(client, ping, latency, message.author);
        await placeholder.edit({ content: null, embeds: [embed] });
      }
    } catch (err) {
      console.error('[Status]', err);
    }
  },
};
