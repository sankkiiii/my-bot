const fs = require('fs');
const path = require('path');
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

const TICKET_COUNT_PATH = path.join(__dirname, '..', 'data', 'ticketCount.json');

function getTicketCount() {
  try {
    const data = JSON.parse(fs.readFileSync(TICKET_COUNT_PATH, 'utf-8'));
    return data.count || 0;
  } catch {
    return 0;
  }
}

function setTicketCount(count) {
  fs.writeFileSync(TICKET_COUNT_PATH, JSON.stringify({ count }, null, 2));
}

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
        if (interaction.customId === 'open_ticket') {
          await handleTicketOpen(interaction, client);
        } else if (interaction.customId === 'close_ticket') {
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

  const sanitizedName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check for existing open ticket
  const existingChannel = guild.channels.cache.find(
    (ch) =>
      ch.name === `ticket-${sanitizedName}` &&
      ch.parentId === config.ticketCategory,
  );
  if (existingChannel) {
    return interaction.reply({
      content: `\u274C You already have an open ticket: ${existingChannel}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  // Increment ticket counter
  const ticketNumber = getTicketCount() + 1;
  setTicketCount(ticketNumber);

  const ticketChannel = await guild.channels.create({
    name: `ticket-${sanitizedName}`,
    type: ChannelType.GuildText,
    topic: `Opened by: ${user.id}`,
    parent: config.ticketCategory || undefined,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      },
      ...guild.roles.cache
        .filter(
          (role) =>
            role.id !== guild.id &&
            (role.permissions.has(PermissionFlagsBits.ManageMessages) ||
              role.permissions.has(PermissionFlagsBits.KickMembers) ||
              role.permissions.has(PermissionFlagsBits.BanMembers)),
        )
        .map((role) => ({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
          ],
        })),
    ],
  });

  const welcomeEmbed = new EmbedBuilder()
    .setTitle('\uD83C\uDFAB Ticket Opened')
    .setDescription(
      `Hey ${user}, thanks for opening a ticket!\nPlease describe your issue in detail and a staff member will assist you shortly.`,
    )
    .setColor(0x57f287)
    .addFields(
      { name: 'Opened By', value: `${user.tag}`, inline: true },
      { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
      { name: 'Status', value: '\uD83D\uDFE2 Open', inline: true },
    )
    .setFooter({ text: 'Only staff can close this ticket' })
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
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
      { name: 'Channel', value: `<#${ticketChannel.id}> (${ticketChannel.name})` },
      { name: 'Ticket #', value: `${ticketNumber}` },
    )
    .setTimestamp();
  await sendLog(client, config.ticketLogChannel, logEmbed);

  await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
}

async function handleTicketClose(interaction, client) {
  const guild = interaction.guild;
  const closer = interaction.member;

  // Only members with mod permissions can close
  if (
    !closer.permissions.has(PermissionFlagsBits.ManageMessages) &&
    !closer.permissions.has(PermissionFlagsBits.KickMembers) &&
    !closer.permissions.has(PermissionFlagsBits.BanMembers)
  ) {
    return interaction.reply({
      content: '\u274C You need **Manage Messages**, **Kick Members**, or **Ban Members** permission to close tickets.',
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: '\uD83D\uDD12 Closing ticket and generating transcript...',
    ephemeral: true,
  });

  const ticketChannel = interaction.channel;

  // Fetch ALL messages (paginate)
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

  // Determine who opened the ticket from channel topic
  let openedByTag = 'Unknown';
  let openedById = null;
  if (ticketChannel.topic) {
    const match = ticketChannel.topic.match(/Opened by:\s*(\d+)/);
    if (match) {
      openedById = match[1];
      try {
        const opener = await client.users.fetch(openedById);
        openedByTag = opener.tag;
      } catch {
        openedByTag = `User ${openedById}`;
      }
    }
  }

  const ticketInfo = {
    ticketName: ticketChannel.name,
    openedBy: openedByTag,
    closedBy: closer.user.tag,
    guildName: guild.name,
    guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }) || '',
    botTag: client.user.tag,
  };

  const transcriptBuffer = generateTranscript(allMessages, ticketInfo);

  // Send transcript to transcript channel
  if (config.transcriptChannel) {
    const transcriptEmbed = new EmbedBuilder()
      .setTitle('\uD83D\uDCC4 Ticket Transcript')
      .setColor(0xfee75c)
      .addFields(
        { name: 'Ticket', value: ticketChannel.name, inline: true },
        { name: 'Opened By', value: openedByTag, inline: true },
        { name: 'Closed By', value: closer.user.tag, inline: true },
        { name: 'Total Messages', value: `${allMessages.length}`, inline: true },
        { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      )
      .setTimestamp();

    const attachment = new AttachmentBuilder(transcriptBuffer, {
      name: `transcript-${ticketChannel.name}.html`,
    });
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
      { name: 'Opened By', value: openedByTag },
      { name: 'Total Messages', value: `${allMessages.length}` },
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
