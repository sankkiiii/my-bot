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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

const VC_BUTTON_IDS = [
  'vc_rename', 'vc_limit', 'vc_lock', 'vc_unlock', 'vc_hide',
  'vc_unhide', 'vc_waiting', 'vc_trust', 'vc_reject', 'vc_delete',
];

const VC_MODAL_IDS = ['vc_rename_modal', 'vc_limit_modal', 'vc_trust_modal', 'vc_reject_modal'];

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
        try {
          if (interaction.customId === 'open_ticket') {
            await handleTicketOpen(interaction, client);
            return;
          }
          if (interaction.customId === 'close_ticket') {
            await handleTicketClose(interaction, client);
            return;
          }
          if (VC_BUTTON_IDS.includes(interaction.customId)) {
            await handleVcButton(interaction);
            return;
          }
        } catch (err) {
          console.error('[Button Error]', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '\u274C An error occurred.', ephemeral: true }).catch(() => {});
          }
        }
      }

      // --- Modal handling ---
      if (interaction.isModalSubmit()) {
        if (VC_MODAL_IDS.includes(interaction.customId)) {
          await handleVcModal(interaction);
          return;
        }
      }
    } catch (err) {
      console.error('[InteractionCreate]', err);
    }
  },
};

// ═══════════════════════════════════════
// TICKET HANDLERS
// ═══════════════════════════════════════

async function handleTicketOpen(interaction, client) {
  const guild = interaction.guild;
  const user = interaction.user;

  const sanitizedName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

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

  const isOwner = config.ownerId && closer.user.id === config.ownerId;

  if (
    !isOwner &&
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

  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

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

  setTimeout(async () => {
    try {
      await ticketChannel.delete();
    } catch (err) {
      console.error('[TicketClose] Failed to delete channel:', err.message);
    }
  }, 5000);
}

// ═══════════════════════════════════════
// VC CONTROL PANEL HANDLERS
// ═══════════════════════════════════════

async function handleVcButton(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;
  const modalButtons = ['vc_rename', 'vc_limit', 'vc_trust', 'vc_reject'];

  console.log('=== VC BUTTON CLICKED ===');
  console.log('customId:', id);
  console.log('channelId:', interaction.channelId);
  console.log('userId:', interaction.user.id);
  console.log('voiceState channelId:', interaction.member.voice?.channelId);
  console.log('tempVCs Map size:', tempVCs?.size);
  console.log('lookup result:', tempVCs?.get(interaction.channelId));
  console.log('========================');

  // Defer immediately for non-modal buttons (must respond within 3s)
  // Modal buttons use showModal() as the response instead
  if (!modalButtons.includes(id)) {
    await interaction.deferReply({ ephemeral: true });
  }

  // Helper to reply based on deferred state
  const errorReply = (msg) => {
    if (interaction.deferred) {
      return interaction.editReply({ content: msg });
    }
    return interaction.reply({ content: msg, ephemeral: true });
  };

  // --- Validation checks ---
  const vcData = tempVCs?.get(interaction.channelId);

  if (!vcData) {
    return errorReply('\u274C VC session expired. Leave and rejoin \u2795 Create VC.');
  }

  if (interaction.user.id !== vcData.creatorId) {
    return errorReply('\u274C Only the voice channel creator can use these controls.');
  }

  const creatorInVC = interaction.member.voice?.channelId === interaction.channelId;
  if (!creatorInVC && id !== 'vc_delete') {
    return errorReply('\u274C You must be connected to your voice channel to use controls.');
  }

  // --- Handle each button ---
  try {
    if (id === 'vc_rename') {
      const modal = new ModalBuilder()
        .setCustomId('vc_rename_modal')
        .setTitle('Rename Voice Channel')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('new_name')
              .setLabel('New Channel Name')
              .setPlaceholder('Enter a new name...')
              .setMinLength(1)
              .setMaxLength(100)
              .setRequired(true)
              .setStyle(TextInputStyle.Short),
          ),
        );
      return interaction.showModal(modal);
    }

    if (id === 'vc_limit') {
      if (vcData.type === 'duo') {
        return errorReply('\u274C Duo VCs are locked to 2 users.');
      }
      const modal = new ModalBuilder()
        .setCustomId('vc_limit_modal')
        .setTitle('Set User Limit')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('user_limit')
              .setLabel('User Limit (0 = unlimited)')
              .setPlaceholder('Enter a number between 0 and 99')
              .setMinLength(1)
              .setMaxLength(2)
              .setRequired(true)
              .setStyle(TextInputStyle.Short),
          ),
        );
      return interaction.showModal(modal);
    }

    if (id === 'vc_trust') {
      const modal = new ModalBuilder()
        .setCustomId('vc_trust_modal')
        .setTitle('Trust a User')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('User ID')
              .setPlaceholder("Paste the user's Discord ID")
              .setMinLength(17)
              .setMaxLength(20)
              .setRequired(true)
              .setStyle(TextInputStyle.Short),
          ),
        );
      return interaction.showModal(modal);
    }

    if (id === 'vc_reject') {
      const modal = new ModalBuilder()
        .setCustomId('vc_reject_modal')
        .setTitle('Reject a User')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('User ID')
              .setPlaceholder("Paste the user's Discord ID")
              .setMinLength(17)
              .setMaxLength(20)
              .setRequired(true)
              .setStyle(TextInputStyle.Short),
          ),
        );
      return interaction.showModal(modal);
    }

    const vc = interaction.guild.channels.cache.get(interaction.channelId);

    if (id === 'vc_lock') {
      await vc.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
      return interaction.editReply({ content: '\uD83D\uDD12 Voice channel locked.' });
    }

    if (id === 'vc_unlock') {
      await vc.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
      return interaction.editReply({ content: '\uD83D\uDD13 Voice channel unlocked.' });
    }

    if (id === 'vc_hide') {
      await vc.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
      return interaction.editReply({ content: '\uD83D\uDC41\uFE0F Voice channel hidden.' });
    }

    if (id === 'vc_unhide') {
      await vc.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
      return interaction.editReply({ content: '\uD83D\uDC41\uFE0F Voice channel is now visible.' });
    }

    if (id === 'vc_waiting') {
      await vc.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: true, Connect: false });
      return interaction.editReply({ content: '\u231B Waiting room enabled.' });
    }

    if (id === 'vc_delete') {
      tempVCs.delete(interaction.channelId);
      await interaction.editReply({ content: '\uD83D\uDDD1\uFE0F Deleting your voice channel...' });
      await vc?.delete().catch(() => {});
      return;
    }
  } catch (err) {
    console.error('[VC Control Error]', err);
    const msg = '\u274C Something went wrong. Please try again.';
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg }).catch(() => {});
    }
    return interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
}

async function handleVcModal(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;
  const channelId = interaction.channelId;

  console.log('[VC Modal] customId:', id, 'channelId:', channelId);
  console.log('[VC Modal] Map size:', tempVCs?.size, 'has channel:', tempVCs?.has(channelId));

  const vcData = tempVCs?.get(channelId);

  if (!vcData) {
    return interaction.reply({
      content: '\u274C This voice channel session has expired. Please leave and rejoin \u2795 Create VC to get a new one.',
      ephemeral: true,
    });
  }

  if (interaction.user.id !== vcData.creatorId) {
    return interaction.reply({
      content: '\u274C Only the voice channel creator can use these controls.',
      ephemeral: true,
    });
  }

  const voiceChannel = interaction.guild.channels.cache.get(channelId);
  if (!voiceChannel) {
    return interaction.reply({ content: '\u274C Voice channel not found.', ephemeral: true });
  }

  const creatorInVC = interaction.member.voice?.channelId === channelId;
  if (!creatorInVC) {
    return interaction.reply({
      content: '\u274C You must be connected to your voice channel to use controls.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    if (id === 'vc_rename_modal') {
      const newName = interaction.fields.getTextInputValue('new_name');
      await voiceChannel.setName(newName);
      await interaction.editReply(`\u2705 Channel renamed to **${newName}**`);
      return;
    }

    if (id === 'vc_limit_modal') {
      const input = interaction.fields.getTextInputValue('user_limit');
      const limit = parseInt(input, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.editReply('\u274C Please enter a valid number between 0 and 99.');
      }
      await voiceChannel.setUserLimit(limit);
      if (limit === 0) {
        await interaction.editReply('\u2705 User limit removed (unlimited).');
      } else {
        await interaction.editReply(`\u2705 User limit set to **${limit}**.`);
      }
      return;
    }

    if (id === 'vc_trust_modal') {
      const userId = interaction.fields.getTextInputValue('user_id').trim();
      let member;
      try {
        member = await interaction.guild.members.fetch(userId);
      } catch {
        return interaction.editReply('\u274C User not found.');
      }
      await voiceChannel.permissionOverwrites.edit(member, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      });
      await interaction.editReply(`\u2705 ${member.user} can now join your channel even if it's locked/hidden.`);
      return;
    }

    if (id === 'vc_reject_modal') {
      const userId = interaction.fields.getTextInputValue('user_id').trim();
      let member;
      try {
        member = await interaction.guild.members.fetch(userId);
      } catch {
        return interaction.editReply('\u274C User not found.');
      }
      if (member.voice.channelId === voiceChannel.id) {
        await member.voice.disconnect('Rejected by VC owner').catch(() => {});
      }
      await voiceChannel.permissionOverwrites.edit(member, {
        ViewChannel: false,
        Connect: false,
      });
      await interaction.editReply(`\uD83D\uDEAB ${member.user} has been rejected from your channel.`);
      return;
    }
  } catch (err) {
    console.error(`[VC Modal] Error handling ${id}:`, err.message);
    await interaction.editReply('\u274C An error occurred while processing your request.').catch(() => {});
  }
}
