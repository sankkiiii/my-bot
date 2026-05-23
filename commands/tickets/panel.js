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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send a ticket panel embed with an Open Ticket button')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  name: 'panel',
  aliases: ['ticket', 'tickets', 'ticketpanel'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let channel, guild, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        guild = interaction.guild;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '\u274C You need the **Manage Channels** permission to use this command.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        channel = message.channel;
        guild = message.guild;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply('\u274C You need the **Manage Channels** permission to use this command.');
        }
        replyFn = (content) => message.reply(content);
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
          return replyFn('\u26A0\uFE0F A ticket panel already exists in this channel.');
        }
      } catch (err) {
        console.error('[Panel] Failed to check for existing panel:', err.message);
      }

      const embed = new EmbedBuilder()
        .setTitle('\uD83D\uDCCB Support Tickets')
        .setDescription('Need help? Click the button below to open a support ticket.\nOur staff team will assist you as soon as possible.')
        .setColor(0x5865f2)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: `${guild.name} \u2022 ${client ? client.user.username : 'Bot'}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('\uD83D\uDCE9 Open Ticket')
          .setStyle(ButtonStyle.Primary),
      );

      await channel.send({ embeds: [embed], components: [row] });
      await replyFn('Ticket panel sent!');
    } catch (err) {
      console.error('[Panel]', err);
    }
  },
};
