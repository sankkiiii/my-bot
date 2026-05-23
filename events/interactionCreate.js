const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');
const config = require('../config');
const { sendLog } = require('../utils/logger');
const { generateTranscript } = require('../utils/transcript');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    try {
      // --- Slash command handling ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, client);
        return;
      }

      // --- Button handling ---
      if (interaction.isButton()) {
        if (interaction.customId === 'ticket_open') {
          await handleTicketOpen(interaction, client);
        } else if (interaction.customId === 'ticket_close') {
          await handleTicketClose(interaction, client);
        }
      }
    } catch (err) {
      console.error('[InteractionCreate]', err);
    }
  },
};

async function handleTicketOpen(interaction, client) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Prevent duplicate tickets
  const existingChannel = guild.channels.cache.find(
    (ch) => ch.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` && ch.parentId === config.ticketCategory,
  );
  if (existingChannel) {
    return interaction.reply({ content: `You already have an open ticket: ${existingChannel}`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketChannel = await guild.channels.create({
    name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategory || undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(config.staffRole
        ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }]
        : []),
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
    ],
  });

  const welcomeEmbed = new EmbedBuilder()
    .setTitle('\uD83C\uDFAB Ticket Opened')
    .setDescription(`Hey ${user}, welcome to your ticket!\nPlease describe your issue and a staff member will be with you shortly.`)
    .setColor(0x57f287)
    .addFields(
      { name: 'Opened By', value: `${user.tag}`, inline: true },
      { name: 'Ticket', value: ticketChannel.name, inline: true },
    )
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('\uD83D\uDD12 Close Ticket')
      .setStyle(ButtonStyle.Danger),
  );

  await ticketChannel.send({ embeds: [welcomeEmbed], components: [closeRow] });

  // Log ticket opened
  const logEmbed = new EmbedBuilder()
    .setTitle('Ticket Opened')
    .setColor(0x57f287)
    .addFields(
      { name: 'Opened By', value: `${user.tag} (${user.id})` },
      { name: 'Channel', value: ticketChannel.name },
    )
    .setTimestamp();
  await sendLog(client, config.ticketLogChannel, logEmbed);

  await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
}

async function handleTicketClose(interaction, client) {
  const guild = interaction.guild;
  const closer = interaction.member;

  // Only staff can close
  if (config.staffRole && !closer.roles.cache.has(config.staffRole)) {
    return interaction.reply({ content: 'Only staff members can close tickets.', ephemeral: true });
  }

  await interaction.reply({ content: 'Closing ticket...' });

  const ticketChannel = interaction.channel;

  // Fetch all messages (paginate)
  const allMessages = [];
  let lastId;
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await ticketChannel.messages.fetch(options);
    if (batch.size === 0) break;
    allMessages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }

  // Sort oldest first
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // Determine who opened the ticket (from channel name)
  const openedByName = ticketChannel.name.replace('ticket-', '') || 'Unknown';

  const ticketInfo = {
    ticketName: ticketChannel.name,
    openedBy: openedByName,
    closedBy: closer.user.tag,
    guildName: guild.name,
  };

  const transcriptBuffer = generateTranscript(allMessages, ticketInfo);

  // Send transcript to transcript channel
  if (config.transcriptChannel) {
    const transcriptEmbed = new EmbedBuilder()
      .setTitle('Ticket Transcript')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Ticket', value: ticketChannel.name, inline: true },
        { name: 'Opened By', value: openedByName, inline: true },
        { name: 'Closed By', value: closer.user.tag, inline: true },
        { name: 'Total Messages', value: `${allMessages.length}` },
      )
      .setTimestamp();

    const attachment = new AttachmentBuilder(transcriptBuffer, { name: `${ticketChannel.name}.html` });
    const transcriptCh = await client.channels.fetch(config.transcriptChannel).catch(() => null);
    if (transcriptCh) {
      await transcriptCh.send({ embeds: [transcriptEmbed], files: [attachment] });
    }
  }

  // Log ticket closed
  const logEmbed = new EmbedBuilder()
    .setTitle('Ticket Closed')
    .setColor(0xed4245)
    .addFields(
      { name: 'Closed By', value: `${closer.user.tag} (${closer.user.id})` },
      { name: 'Channel', value: ticketChannel.name },
    )
    .setTimestamp();
  await sendLog(client, config.ticketLogChannel, logEmbed);

  // Delete channel after 5 seconds
  setTimeout(async () => {
    try {
      await ticketChannel.delete();
    } catch (err) {
      console.error('[TicketClose] Failed to delete channel:', err.message);
    }
  }, 5000);
}
