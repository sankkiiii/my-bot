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
const e = require('../../config/emojis');

const PRESENCE_PATH = path.join(__dirname, '..', '..', 'data', 'presence.json');

const activityTypes = {
  PLAYING: ActivityType.Playing,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
};

const typeEmojis = {
  PLAYING: `${e.playing} Playing`,
  WATCHING: `${e.watching} Watching`,
  LISTENING: `${e.listening} Listening`,
  COMPETING: `${e.competing} Competing`,
};

const statusEmojis = {
  online: `${e.info} Online`,
  idle: `${e.warning} Idle`,
  dnd: `${e.error} DND`,
  invisible: `${e.info} Invisible`,
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
          { name: `${e.playing} Playing`, value: 'PLAYING' },
          { name: `${e.watching} Watching`, value: 'WATCHING' },
          { name: `${e.listening} Listening`, value: 'LISTENING' },
          { name: `${e.competing} Competing`, value: 'COMPETING' },
          { name: `${e.error} Clear (remove activity)`, value: 'CLEAR' },
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
          { name: `${e.info} Online`, value: 'online' },
          { name: `${e.warning} Idle`, value: 'idle' },
          { name: `${e.error} Do Not Disturb`, value: 'dnd' },
          { name: `${e.info} Invisible`, value: 'invisible' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  name: 'rpc',
  aliases: ['presence', 'activity'],

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
            content: `${e.error} You need **Administrator** permission to change my presence.`,
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
          return message.reply(`${e.error} You need **Administrator** permission to change my presence.`);
        }

        replyFn = (opts) => message.reply(opts);

        if (!args[0]) {
          return message.reply(`${e.error} Usage: \`!rpc <playing|watching|listening|competing|clear> [text]\``);
        }

        type = args[0].toUpperCase();
        if (!['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING', 'CLEAR'].includes(type)) {
          return message.reply(`${e.error} Invalid type. Use: \`playing\`, \`watching\`, \`listening\`, \`competing\`, or \`clear\`.`);
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

        return replyFn({ content: `${e.success} Bot presence cleared.` });
      }

      if (!text) {
        return replyFn({ content: `${e.error} Please provide a status text.` });
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
        .setTitle(`${e.success} Rich Presence Updated`)
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
