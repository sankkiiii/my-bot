const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const isOwner = require('../../utils/isOwner');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const { success, error, getEmoji } = require('../../utils/emoji');

function hasMedia(message, type = 'all') {
  // Check attachments
  const hasAttachment = message.attachments.size > 0;

  // Check image attachments
  const hasImage = message.attachments.some(a =>
    a.contentType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|webp|bmp|svg)$/i.test(a.name || '')
  );

  // Check video attachments
  const hasVideo = message.attachments.some(a =>
    a.contentType?.startsWith('video/') ||
    /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(a.name || '')
  );

  // Check GIF attachments
  const hasGif = message.attachments.some(a =>
    a.contentType === 'image/gif' ||
    /\.gif$/i.test(a.name || '')
  );

  // Check embeds (link previews, image embeds)
  const hasEmbed = message.embeds.length > 0;

  // Check links in content
  const hasLink = /https?:\/\/[^\s]+/i.test(message.content);

  // Check image links (direct image URLs)
  const hasImageLink = /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)/i
    .test(message.content);

  // Check tenor/giphy GIFs
  const hasTenorGif = /https?:\/\/(tenor\.com|giphy\.com|media\.tenor)/i
    .test(message.content);

  switch (type) {
    case 'images':
      return hasImage || hasImageLink ||
             message.embeds.some(e => e.image || e.thumbnail);
    case 'videos':
      return hasVideo ||
             message.embeds.some(e => e.video);
    case 'gifs':
      return hasGif || hasTenorGif ||
             message.embeds.some(e =>
               e.url?.includes('tenor') || e.url?.includes('giphy')
             );
    case 'links':
      return hasLink || hasEmbed;
    case 'attachments':
      return hasAttachment;
    case 'all':
    default:
      return hasAttachment || hasEmbed || hasLink ||
             hasImageLink || hasTenorGif;
  }
}

const typeLabel = {
  images: '🖼️ image',
  videos: '🎬 video',
  gifs: '🎞️ GIF',
  links: '🔗 link',
  attachments: '📎 attachment',
  all: '🖼️ media'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purgemedia')
    .setDescription('Delete messages containing media')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of media messages to delete (default: 50, max: 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Type of media to purge (default: all)')
        .setRequired(false)
        .addChoices(
          { name: '🖼️ Images only', value: 'images' },
          { name: '🎬 Videos only', value: 'videos' },
          { name: '🎞️ GIFs only', value: 'gifs' },
          { name: '🔗 Links only', value: 'links' },
          { name: '📎 Attachments only', value: 'attachments' },
          { name: '🌐 All media', value: 'all' },
        )
    ),

  name: 'purgemedia',
  aliases: ['purgeimg', 'purgeimages', 'purgegif', 'purgevideo'],

  async execute(interactionOrMessage, argsOrClient) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const guild = interactionOrMessage.guild;
    if (!guild) return;

    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
    const executor = interactionOrMessage.member;
    const channel = interactionOrMessage.channel;
    const botMember = guild.members.me;

    const checkOwnerBypass = require('../../utils/isOwner');
    const ownerBypass = checkOwnerBypass(executorId);

    if (!ownerBypass) {
      // Cooldown check (3s)
      const remaining = cooldown.check('purgemedia', executorId, guild.id, 3000);
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
        return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
      }

      // Permission check
      if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const msg = error('You need **Manage Messages** permission.');
        return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
      }
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error('I need **Manage Messages** permission.');
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    let amount;
    let mediaType;

    if (isSlash) {
      amount = interactionOrMessage.options.getInteger('amount') || 50;
      mediaType = interactionOrMessage.options.getString('type') || 'all';
      await interactionOrMessage.reply({
        content: `${getEmoji('loading') || '⏳'} Purging media...`,
        ephemeral: true
      });
    } else {
      const args = argsOrClient;
      amount = parseInt(args[0]) || 50;
      const typeInput = args[1]?.toLowerCase() || 'all';
      const validTypes = ['images', 'videos', 'gifs', 'links', 'attachments', 'all'];
      mediaType = validTypes.includes(typeInput) ? typeInput : 'all';

      // Delete trigger message instantly
      await interactionOrMessage.delete().catch(() => {});
    }

    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;

      const mediaMsgs = fetched
        .filter(m =>
          m.createdTimestamp > twoWeeksAgo &&
          hasMedia(m, mediaType)
        )
        .first(Math.min(amount, 100));

      if (mediaMsgs.length === 0) {
        const msg = error(`No ${mediaType === 'all' ? 'media' : mediaType} messages found to delete.`);
        if (isSlash) {
          return await interactionOrMessage.editReply(msg);
        } else {
          const sent = await channel.send(msg);
          setTimeout(() => sent.delete().catch(() => {}), 5000);
          return;
        }
      }

      const deleted = await channel.bulkDelete(mediaMsgs, true);
      const successMsg = success(`Deleted **${deleted.size}** ${typeLabel[mediaType]} messages.`);

      if (isSlash) {
        await interactionOrMessage.editReply(successMsg);
      } else {
        const sent = await channel.send(successMsg);
        setTimeout(() => sent.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[PurgeMedia]', err);
      const errMsg = error('Failed to purge messages. They might be older than 14 days.');
      if (isSlash) {
        await interactionOrMessage.editReply(errMsg).catch(() => {});
      } else {
        const sent = await channel.send(errMsg).catch(() => {});
        if (sent) setTimeout(() => sent.delete().catch(() => {}), 5000);
      }
    }
  },
};
