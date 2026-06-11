const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const checkOwnerBypass = require('../../utils/isOwner');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { success, error } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send a ticket panel embed with an Open Ticket button')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  name: 'panel',
  aliases: ['ticketpanel', 'sendpanel'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const bypassExecutorId = (typeof isSlash !== 'undefined' && isSlash) ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage && interactionOrMessage.author ? interactionOrMessage.author.id : (interactionOrMessage && interactionOrMessage.user ? interactionOrMessage.user.id : (typeof executorId !== 'undefined' ? executorId : (typeof executor !== 'undefined' ? executor.id : ''))));
    const ownerBypass = checkOwnerBypass(bypassExecutorId);
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let channel, guild, replyError, replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return interaction.reply({
            content: error('This command only works in a server.'),
            ephemeral: true,
          });
        }
        channel = interaction.channel;
        guild = interaction.guild;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (content) => slashSuccess(interaction, { content, ephemeral: true });

        if (!ownerBypass) {
    const remaining = cooldown.check('panel', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }
    }

        if (!ownerBypass) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return replyError(error('You need the **Manage Channels** permission to use this command.'));
        }
    }
      } else {
        const message = interactionOrMessage;
        if (!message.guild) {
          return prefixError(message, error('This command only works in a server.'));
        }
        channel = message.channel;
        guild = message.guild;

        if (!ownerBypass) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return prefixError(message, error('You need the **Manage Channels** permission to use this command.'));
        }
    }
        replyError = (content) => prefixError(message, content);
        replySuccess = (content) => prefixSuccess(message, { content });

        if (!ownerBypass) {
    const remaining = cooldown.check('panel', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(error(`You are on cooldown. Try again in **${secs}s**.`));
        }
    }
      }

      const client = isSlash ? argsOrClient : clientOrUndefined;

      // Check for existing panel in this channel
      try {
        const messages = await channel.messages.fetch({ limit: 20 });
        const existingPanel = messages.find(
          (m) =>
            m.author.id === client.user.id &&
            m.components?.[0]?.components?.some((c) => c.customId === 'open_ticket'),
        );
        if (existingPanel) {
          return replyError(error('A ticket panel already exists in this channel.'));
        }
      } catch (err) {
        console.error('[Panel] Failed to check for existing panel:', err.message);
      }

      const embed = new EmbedBuilder()
        .setTitle('Support Tickets')
        .setDescription('Need help? Click the button below to open a support ticket.\nOur staff team will assist you as soon as possible.')
        .setColor('#5865F2')
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: `Requested by ${isSlash ? interactionOrMessage.user.tag : interactionOrMessage.author.tag}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('Open Ticket')
          .setStyle(ButtonStyle.Secondary),
      );

      await channel.send({ embeds: [embed], components: [row] });
      await replySuccess(success('Ticket panel sent!'));
    } catch (err) {
      console.error('[Panel]', err);
    }
  },
};
