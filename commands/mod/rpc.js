const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  ActivityType,
} = require('discord.js');
const config = require('../../config');

const PRESENCE_PATH = path.join(__dirname, '..', '..', 'data', 'presence.json');

const activityTypes = {
  PLAYING: ActivityType.Playing,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
};

const typeEmojis = {
  PLAYING: '\uD83C\uDFAE Playing',
  WATCHING: '\uD83D\uDCFA Watching',
  LISTENING: '\uD83C\uDFB5 Listening',
  COMPETING: '\uD83C\uDFC6 Competing',
};

const statusEmojis = {
  online: '\uD83D\uDFE2 Online',
  idle: '\uD83C\uDF19 Idle',
  dnd: '\u26D4 DND',
  invisible: '\uD83D\uDC7B Invisible',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rpc')
    .setDescription('Change the bot rich presence')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Activity type')
        .setRequired(true)
        .addChoices(
          { name: '\uD83C\uDFAE Playing', value: 'PLAYING' },
          { name: '\uD83D\uDCFA Watching', value: 'WATCHING' },
          { name: '\uD83C\uDFB5 Listening', value: 'LISTENING' },
          { name: '\uD83C\uDFC6 Competing', value: 'COMPETING' },
          { name: '\u274C Clear (remove activity)', value: 'CLEAR' },
        ),
    )
    .addStringOption((opt) =>
      opt.setName('text').setDescription('The status text to display').setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Bot online status')
        .setRequired(false)
        .addChoices(
          { name: '\uD83D\uDFE2 Online', value: 'online' },
          { name: '\uD83C\uDF19 Idle', value: 'idle' },
          { name: '\u26D4 Do Not Disturb', value: 'dnd' },
          { name: '\uD83D\uDC7B Invisible', value: 'invisible' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  name: 'rpc',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let type, text, status, replyFn, user;

      if (isSlash) {
        const interaction = interactionOrMessage;
        user = interaction.user;

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '\u274C You need **Administrator** permission to change my presence.',
            ephemeral: true,
          });
        }

        replyFn = (opts) => interaction.reply({ ...opts, ephemeral: true });
        type = interaction.options.getString('type');
        text = interaction.options.getString('text');
        status = interaction.options.getString('status') || 'online';
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        user = message.author;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return message.reply('\u274C You need **Administrator** permission to change my presence.');
        }

        replyFn = (opts) => message.reply(opts);

        if (!args[0]) {
          return message.reply('\u274C Usage: `!rpc <playing|watching|listening|competing|clear> [text]`');
        }

        type = args[0].toUpperCase();
        if (!['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING', 'CLEAR'].includes(type)) {
          return message.reply('\u274C Invalid type. Use: `playing`, `watching`, `listening`, `competing`, or `clear`.');
        }

        text = args.slice(1).join(' ') || null;
        status = 'online';
      }

      if (type === 'CLEAR') {
        client.user.setPresence({ activities: [], status });

        const presenceData = {
          type: 'CLEAR',
          text: null,
          status,
          setBy: user.id,
          setAt: new Date().toISOString(),
        };
        fs.writeFileSync(PRESENCE_PATH, JSON.stringify(presenceData, null, 2));

        return replyFn({ content: '\u2705 Bot presence cleared.' });
      }

      if (!text) {
        return replyFn({ content: '\u274C Please provide a status text.' });
      }

      client.user.setPresence({
        activities: [{ name: text, type: activityTypes[type] }],
        status,
      });

      const presenceData = {
        type,
        text,
        status,
        setBy: user.id,
        setAt: new Date().toISOString(),
      };
      fs.writeFileSync(PRESENCE_PATH, JSON.stringify(presenceData, null, 2));

      const embed = new EmbedBuilder()
        .setTitle('\u2705 Rich Presence Updated')
        .setColor(0x57f287)
        .addFields(
          { name: 'Type', value: typeEmojis[type] || type, inline: true },
          { name: 'Text', value: text, inline: true },
          { name: 'Status', value: statusEmojis[status] || status, inline: true },
          { name: 'Set by', value: `${user}`, inline: true },
        )
        .setTimestamp();

      return replyFn({ embeds: [embed] });
    } catch (err) {
      console.error('[RPC]', err);
    }
  },
};
