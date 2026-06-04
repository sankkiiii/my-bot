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
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { success, error, withEmoji, getEmoji } = require('../../utils/emoji');

const PRESENCE_PATH = path.join(__dirname, '..', '..', 'data', 'presence.json');

const activityTypes = {
  PLAYING: ActivityType.Playing,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
};

const typeEmojis = {
  PLAYING: `${getEmoji('playing')} Playing`,
  WATCHING: `${getEmoji('watching')} Watching`,
  LISTENING: `${getEmoji('listening')} Listening`,
  COMPETING: `${getEmoji('competing')} Competing`,
};

const statusEmojis = {
  online: `${getEmoji('info')} Online`,
  idle: `${getEmoji('warning')} Idle`,
  dnd: `${getEmoji('error')} DND`,
  invisible: `${getEmoji('info')} Invisible`,
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
          { name: 'Playing', value: 'PLAYING' },
          { name: 'Watching', value: 'WATCHING' },
          { name: 'Listening', value: 'LISTENING' },
          { name: 'Competing', value: 'COMPETING' },
          { name: 'Clear (remove activity)', value: 'CLEAR' },
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
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  name: 'rpc',
  aliases: ['presence', 'activity', 'setstatus'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let type, text, status, replyError, replySuccess, user;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        user = interaction.user;

        const remaining = cooldown.check('rpc', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return slashError(interaction, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return slashError(interaction, error('You need **Administrator** permission to change my presence.'));
        }

        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, { ...opts, ephemeral: true });
        type = interaction.options.getString('type');
        text = interaction.options.getString('text');
        status = interaction.options.getString('status') || 'online';
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        user = message.author;

        const remaining = cooldown.check('rpc', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return prefixError(message, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return prefixError(message, error('You need **Administrator** permission to change my presence.'));
        }

        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        if (!args[0]) {
          return replyError(error('Usage: `!rpc <playing|watching|listening|competing|clear> [text]`'));
        }

        type = args[0].toUpperCase();
        if (!['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING', 'CLEAR'].includes(type)) {
          return replyError(error('Invalid type. Use: `playing`, `watching`, `listening`, `competing`, or `clear`.'));
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

        return replySuccess({ content: success('Bot presence cleared.') });
      }

      if (!text) {
        return replyError(error('Please provide a status text.'));
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
        .setColor('#57F287')
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(success('Presence updated') + `\n**Type:** ${type}\n**Text:** ${text}\n**Status:** ${status}`)
        .setFooter({ text: `Requested by ${user.tag}` });

      return replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[RPC]', err);
    }
  },
};
