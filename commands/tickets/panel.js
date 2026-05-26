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
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send a ticket panel embed with an Open Ticket button')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  name: 'panel',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let channel, guild, replyError, replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        channel = interaction.channel;
        guild = interaction.guild;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (content) => slashSuccess(interaction, { content, ephemeral: true });

        const remaining = cooldown.check('panel', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return replyError(`${e.error} You need the **Manage Channels** permission to use this command.`);
        }
      } else {
        const message = interactionOrMessage;
        if (!message.guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        channel = message.channel;
        guild = message.guild;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return prefixError(message, `${e.error} You need the **Manage Channels** permission to use this command.`);
        }
        replyError = (content) => prefixError(message, content);
        replySuccess = (content) => prefixSuccess(message, { content });

        const remaining = cooldown.check('panel', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
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
          return replyError(`${e.warning} A ticket panel already exists in this channel.`);
        }
      } catch (err) {
        console.error('[Panel] Failed to check for existing panel:', err.message);
      }

      const embed = new EmbedBuilder()
        .setTitle(`${e.ticket} Support Tickets`)
        .setDescription('Need help? Click the button below to open a support ticket.\nOur staff team will assist you as soon as possible.')
        .setColor(0x5865f2)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: `${guild.name} • ${client ? client.user.username : 'Bot'}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel(`${e.ticketOpen} Open Ticket`)
          .setStyle(ButtonStyle.Primary),
      );

      await channel.send({ embeds: [embed], components: [row] });
      await replySuccess(`${e.success} Ticket panel sent!`);
    } catch (err) {
      console.error('[Panel]', err);
    }
  },
};
