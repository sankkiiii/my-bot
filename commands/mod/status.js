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
const e = require('../../config/emojis');

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
    .setTitle(`${e.stats} Bot Status`)
    .setColor(0x5865f2)
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: `${e.ping} API Ping`, value: `${ping}ms`, inline: true },
      { name: `${e.info} Latency`, value: `${latency}ms`, inline: true },
      { name: `${e.uptime} Uptime`, value: uptime, inline: true },
      { name: `${e.memory} Memory`, value: `${memUsed}MB / ${memTotal}MB`, inline: true },
      { name: `${e.stats} Servers`, value: `${serverCount}`, inline: true },
      { name: `${e.members} Users`, value: `${userCount}`, inline: true },
      { name: `${e.channels} Channels`, value: `${channelCount}`, inline: true },
      { name: `${e.stats} Commands`, value: `${commandCount}`, inline: true },
      { name: `${e.info} Status`, value: statusText, inline: true },
      { name: `${e.playing} Activity`, value: activity, inline: true },
      { name: `${e.info} Node.js`, value: process.version, inline: true },
      { name: `${e.info} discord.js`, value: `v${djsVersion}`, inline: true },
    )
    .setFooter({ text: `Requested by ${user.username}` })
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
            content: `${e.error} You need **Administrator** permission.`,
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
          return message.reply(`${e.error} You need **Administrator** permission.`);
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
