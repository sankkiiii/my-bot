const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const checkOwnerBypass = require('../../utils/isOwner');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const { success, error, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Type of content to purge (leave empty for all messages)')
        .setRequired(false)
        .addChoices(
          { name: '🖼️ Images', value: 'images' },
          { name: '🎞️ GIFs', value: 'gifs' },
          { name: '🎬 Videos', value: 'videos' },
          { name: '🔗 Links', value: 'links' },
          { name: '📎 Attachments', value: 'attachments' },
          { name: '🌐 All media', value: 'all' },
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  name: 'purge',
  aliases: ['clear', 'clean', 'delete', 'prune'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
    const ownerBypass = checkOwnerBypass(executorId);
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check
    if (!ownerBypass) {
      const remaining = cooldown.check('purge', executor.id, guild.id, 3000);
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
        return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
      }
    }

    // Permission check
    if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error(`You need the **Manage Messages** permission.`);
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msg = error(`I need **Manage Messages** permission.`);
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    if (isSlash) {
      const type = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount') || 100;
      if (type) {
        await interaction.deferReply({ ephemeral: true });
        await executePurgeMediaSlash(interaction, type, amount);
        return;
      }
    } else {
      const args = message.content.trim().split(/\s+/).slice(1);
      const sub = args[0]?.toLowerCase();

      const mediaSubcommands = {
        'img':         'images',
        'image':       'images',
        'images':      'images',
        'gif':         'gifs',
        'gifs':        'gifs',
        'video':       'videos',
        'videos':      'videos',
        'link':        'links',
        'links':       'links',
        'attach':      'attachments',
        'attachments': 'attachments',
        'media':       'all',
        'all':         'all',
      };

      if (sub && mediaSubcommands[sub]) {
        const mediaType = mediaSubcommands[sub];
        const amount = parseInt(args[1]) || 50;
        return executePurgeMedia(message, mediaType, amount);
      }
    }

    try {
      const channel = interactionOrMessage.channel;
      let amount;
      let messages;

      if (isSlash) {
        amount = interaction.options.getInteger('amount') || 100;
        await interaction.reply({
          content: withEmoji('loading', 'Purging...'),
          ephemeral: true,
        });
        messages = await channel.messages.fetch({
          limit: Math.min(amount, 100),
        });
      } else {
        const args = message.content.trim().split(/\s+/).slice(1);
        amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return prefixError(
            message,
            error(`Please provide a number between 1 and 100.`)
          );
        }
        
        // Do fetch and delete trigger in parallel
        const [_, fetchedMsgs] = await Promise.all([
          message.delete().catch(() => {}),
          channel.messages.fetch({ limit: Math.min(amount, 100) })
        ]);
        messages = fetchedMsgs;
      }

      // Use 12 days to avoid edge case errors with Discord API
      const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;
      const deletable = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      if (deletable.size === 0) {
        const msg = error(`No deletable messages found (must be under 12 days old).`);
        if (isSlash) {
          return interaction.editReply(msg);
        } else {
          const errReply = await channel.send(msg);
          setTimeout(() => errReply.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Single bulkDelete call
      const deleted = await channel.bulkDelete(deletable, true);
      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setAuthor({
          name: (isSlash ? interaction.user : message.author).username,
          iconURL: (isSlash ? interaction.user : message.author).displayAvatarURL({ dynamic: true }),
        })
        .setDescription(success(`Deleted **${deleted.size}** messages`))
        .setFooter({ text: `Requested by ${(isSlash ? interaction.user : message.author).tag}` });

      if (isSlash) {
        return interaction.editReply({ content: null, embeds: [embed] });
      } else {
        const msg = await channel.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }
    } catch (err) {
      console.error('[Purge]', err);
      const msg = error(`An error occurred while purging messages.`);
      if (isSlash) return interaction.editReply({ content: msg, embeds: [] });
      const errReply = await interactionOrMessage.channel.send(msg);
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
    }
  },
};

function hasMedia(msg, type) {
  switch (type) {
    case 'images':
      return (
        msg.attachments.some(a =>
          (a.contentType?.startsWith('image/') &&
           a.contentType !== 'image/gif')
          ||
          /\.(png|jpg|jpeg|webp|bmp)$/i.test(a.name || '')
        ) ||
        /https?:\/\/[^\s]+\.(png|jpg|jpeg|webp|bmp)/i
          .test(msg.content) ||
        msg.embeds.some(e =>
          e.image != null &&
          !e.url?.includes('tenor') &&
          !e.url?.includes('giphy')
        )
      );

    case 'gifs':
      return (
        msg.attachments.some(a =>
          a.contentType === 'image/gif' ||
          /\.gif$/i.test(a.name || '')
        ) ||
        /https?:\/\/[^\s]+\.gif/i.test(msg.content) ||
        /https?:\/\/(tenor\.com|giphy\.com|media\.tenor|c\.tenor)/i
          .test(msg.content) ||
        msg.embeds.some(e =>
          e.url?.includes('tenor') ||
          e.url?.includes('giphy') ||
          e.provider?.name?.toLowerCase() === 'tenor' ||
          e.provider?.name?.toLowerCase() === 'giphy'
        )
      );

    case 'videos':
      return (
        msg.attachments.some(a =>
          a.contentType?.startsWith('video/') ||
          /\.(mp4|mov|avi|mkv|webm|flv)$/i.test(a.name || '')
        ) ||
        msg.embeds.some(e => e.video != null)
      );

    case 'links':
      return (
        (
          /https?:\/\/[^\s]+/i.test(msg.content) &&
          !msg.attachments.size
        ) ||
        (
          msg.embeds.length > 0 &&
          !msg.embeds.some(e =>
            e.url?.includes('tenor') ||
            e.url?.includes('giphy')
          )
        )
      );

    case 'attachments':
      return msg.attachments.size > 0;

    case 'all':
    default:
      return (
        msg.attachments.size > 0 ||
        msg.embeds.length > 0 ||
        /https?:\/\/[^\s]+/i.test(msg.content)
      );
  }
}

async function executePurgeMedia(message, mediaType, amount) {
  try {
    await message.delete().catch(() => {});

    console.log('[Purge Media] type:', mediaType, 'amount:', amount);

    const channel = message.channel;
    const fetched = await channel.messages.fetch({ limit: 100 });
    const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;

    const mediaMsgs = fetched
      .filter(m =>
        m.createdTimestamp > twoWeeksAgo &&
        hasMedia(m, mediaType)
      )
      .first(Math.min(amount, 100));

    console.log('[Purge Media] fetched:', fetched.size,
                'filtered:', mediaMsgs.length);

    if (mediaMsgs.length === 0) {
      const noMsg = await channel.send(
        error(`No ${mediaType === 'all' ? 'media' : mediaType} messages found.`)
      );
      setTimeout(() => noMsg.delete().catch(() => {}), 5000);
      return;
    }

    const deleted = await channel.bulkDelete(mediaMsgs, true);

    const typeLabel = {
      images: '🖼️ image', videos: '🎬 video',
      gifs: '🎞️ GIF', links: '🔗 link',
      attachments: '📎 attachment', all: '🖼️ media'
    };

    const msg = await channel.send(
      success(`Deleted **${deleted.size}** ${typeLabel[mediaType]} messages.`)
    );
    setTimeout(() => msg.delete().catch(() => {}), 5000);

  } catch (err) {
    console.error('[Purge Media Prefix Error]', err);
  }
}

async function executePurgeMediaSlash(interaction, mediaType, amount) {
  try {
    const channel = interaction.channel;
    const fetched = await channel.messages.fetch({ limit: 100 });
    const twoWeeksAgo = Date.now() - 12 * 24 * 60 * 60 * 1000;

    const mediaMsgs = fetched
      .filter(m =>
        m.createdTimestamp > twoWeeksAgo &&
        hasMedia(m, mediaType)
      )
      .first(Math.min(amount, 100));

    if (mediaMsgs.length === 0) {
      return interaction.editReply(
        error(`No ${mediaType === 'all' ? 'media' : mediaType} messages found.`)
      );
    }

    const deleted = await channel.bulkDelete(mediaMsgs, true);

    const typeLabel = {
      images: '🖼️ image', videos: '🎬 video',
      gifs: '🎞️ GIF', links: '🔗 link',
      attachments: '📎 attachment', all: '🖼️ media'
    };

    await interaction.editReply(
      success(`Deleted **${deleted.size}** ${typeLabel[mediaType]} messages.`)
    );

  } catch (err) {
    console.error('[Purge Media Slash Error]', err);
    await interaction.editReply(
      error('Something went wrong.')
    ).catch(() => {});
  }
}
