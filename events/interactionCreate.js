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
  UserSelectMenuBuilder,
} = require('discord.js');
const config = require('../config');
const getConfig = require('../utils/getConfig');
const guildConfig = require('../database/guildConfig');
const configCache = require('../utils/configCache');
const { incrementTicketCount } = require('../database/guildConfig');
const { generateTranscript } = require('../utils/transcript');

async function sendLog(client, channelId, embed) {
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Log] Failed to send log:', err.message);
  }
}

const VC_BUTTON_IDS = [
  'vc_rename', 'vc_limit', 'vc_lock', 'vc_unlock', 'vc_hide',
  'vc_unhide', 'vc_waiting', 'vc_trust', 'vc_reject', 'vc_delete',
  'vc_kick', 'vc_ban',
];

const VC_MODAL_IDS = ['vc_rename_modal', 'vc_limit_modal'];
const TICKET_MODAL_ID = 'ticket_reason_modal';

const VC_SELECT_IDS = ['vc_trust_select', 'vc_reject_select', 'vc_kick_select', 'vc_ban_select'];

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
            await handleTicketOpenButton(interaction, client);
            return;
          }
          if (interaction.customId === 'close_ticket') {
            await handleTicketClose(interaction, client);
            return;
          }
          if (interaction.customId.startsWith('resetconfig_confirm_')) {
            await handleResetConfigConfirm(interaction);
            return;
          }
          if (interaction.customId === 'resetconfig_cancel') {
            await handleResetConfigCancel(interaction);
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

      // --- User select menu handling ---
      if (interaction.isUserSelectMenu()) {
        if (VC_SELECT_IDS.includes(interaction.customId)) {
          await handleVcSelectMenu(interaction);
          return;
        }
      }

      // --- Modal handling ---
      if (interaction.isModalSubmit()) {
        if (interaction.customId === TICKET_MODAL_ID) {
          await handleTicketModalSubmit(interaction, client);
          return;
        }
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

async function handleTicketOpenButton(interaction, client) {
  const guild = interaction.guild;
  const user = interaction.user;
  const cfg = getConfig(guild.id);

  if (!cfg?.ticket_category) {
    return interaction.reply({
      content: '❌ Tickets are not configured. Admin: use `/setup tickets`',
      ephemeral: true,
    });
  }

  const sanitizedName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check for existing ticket BEFORE showing modal
  const existingChannel = guild.channels.cache.find(
    (ch) =>
      ch.name === `ticket-${sanitizedName}` &&
      ch.parentId === cfg.ticket_category,
  );
  if (existingChannel) {
    return interaction.reply({
      content: `\u274C You already have an open ticket: ${existingChannel}`,
      ephemeral: true,
    });
  }

  // Show reason modal
  const modal = new ModalBuilder()
    .setCustomId('ticket_reason_modal')
    .setTitle('Open a Support Ticket');

  const reasonInput = new TextInputBuilder()
    .setCustomId('ticket_reason_input')
    .setLabel('Reason for opening this ticket')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Please describe your issue in detail...')
    .setMinLength(10)
    .setMaxLength(500)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return interaction.showModal(modal);
}

async function handleTicketModalSubmit(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const user = interaction.user;
  const reason = interaction.fields.getTextInputValue('ticket_reason_input');
  const cfg = getConfig(guild.id);

  if (!cfg?.ticket_category) {
    return interaction.editReply({
      content: '❌ Tickets are not configured. Admin: use `/setup tickets`',
    });
  }

  const sanitizedName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Double-check for existing ticket (race condition guard)
  const existingChannel = guild.channels.cache.find(
    (ch) =>
      ch.name === `ticket-${sanitizedName}` &&
      ch.parentId === cfg.ticket_category,
  );
  if (existingChannel) {
    return interaction.editReply({
      content: `\u274C You already have an open ticket: ${existingChannel}`,
    });
  }

  const ticketNumber = incrementTicketCount(guild.id);

  const ticketChannel = await guild.channels.create({
    name: `ticket-${sanitizedName}`,
    type: ChannelType.GuildText,
    topic: `Opened by: ${user.id} | Reason: ${reason}`,
    parent: cfg.ticket_category || undefined,
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
    .setColor(0x57f287)
    .addFields(
      { name: '\uD83D\uDC64 Opened by', value: `${user}`, inline: true },
      { name: '\uD83C\uDFAB Ticket', value: `#${ticketNumber}`, inline: true },
      { name: '\uD83D\uDCCB Reason', value: reason, inline: false },
      { name: '\uD83D\uDFE2 Status', value: 'Open', inline: true },
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
      { name: 'Opened By', value: `${user.username} (${user.id})` },
      { name: 'Channel', value: `<#${ticketChannel.id}> (${ticketChannel.name})` },
      { name: 'Ticket #', value: `${ticketNumber}` },
      { name: 'Reason', value: reason },
    )
    .setTimestamp();
  await sendLog(client, cfg.ticket_log_channel, logEmbed);

  await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
}

async function handleTicketClose(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const closer = interaction.member;
  const cfg = getConfig(guild.id);

  const isOwner = config.ownerId && closer.user.id === config.ownerId;

  if (
    !isOwner &&
    !closer.permissions.has(PermissionFlagsBits.ManageMessages) &&
    !closer.permissions.has(PermissionFlagsBits.KickMembers) &&
    !closer.permissions.has(PermissionFlagsBits.BanMembers)
  ) {
    return interaction.editReply({
      content: '\u274C You need **Manage Messages**, **Kick Members**, or **Ban Members** permission to close tickets.',
    });
  }

  await interaction.editReply({
    content: '\uD83D\uDD12 Closing ticket and generating transcript...',
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
        openedByTag = opener.username;
      } catch {
        openedByTag = `User ${openedById}`;
      }
    }
  }

  // Extract reason from topic: "Opened by: {id} | Reason: {text}"
  let ticketReason = 'Not provided';
  if (ticketChannel.topic) {
    const reasonPart = ticketChannel.topic.split(' | ').find((p) => p.startsWith('Reason:'));
    if (reasonPart) {
      ticketReason = reasonPart.replace('Reason: ', '');
    }
  }

  const ticketInfo = {
    ticketName: ticketChannel.name,
    openedBy: openedByTag,
    closedBy: closer.user.username,
    reason: ticketReason,
    guildName: guild.name,
    guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }) || '',
    botTag: client.user.username,
  };

  const transcriptBuffer = generateTranscript(allMessages, ticketInfo);

  if (cfg?.transcript_channel) {
    const transcriptEmbed = new EmbedBuilder()
      .setTitle('\uD83D\uDCC4 Ticket Transcript')
      .setColor(0xfee75c)
      .addFields(
        { name: 'Ticket', value: ticketChannel.name, inline: true },
        { name: 'Opened By', value: openedByTag, inline: true },
        { name: 'Closed By', value: closer.user.username, inline: true },
        { name: 'Total Messages', value: `${allMessages.length}`, inline: true },
        { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      )
      .setTimestamp();

    const attachment = new AttachmentBuilder(transcriptBuffer, {
      name: `transcript-${ticketChannel.name}.html`,
    });
    const transcriptCh = await client.channels.fetch(cfg.transcript_channel).catch(() => null);
    if (transcriptCh) {
      await transcriptCh.send({ embeds: [transcriptEmbed], files: [attachment] });
    }
  }

  const logEmbed = new EmbedBuilder()
    .setTitle('Ticket Closed')
    .setColor(0xed4245)
    .addFields(
      { name: 'Closed By', value: `${closer.user.username} (${closer.user.id})` },
      { name: 'Channel', value: ticketChannel.name },
      { name: 'Opened By', value: openedByTag },
      { name: 'Total Messages', value: `${allMessages.length}` },
    )
    .setTimestamp();
  await sendLog(client, cfg?.ticket_log_channel, logEmbed);

  setTimeout(async () => {
    try {
      await ticketChannel.delete();
    } catch (err) {
      console.error('[TicketClose] Failed to delete channel:', err.message);
    }
  }, 5000);
}

// ═══════════════════════════════════════
// RESET CONFIG HANDLERS
// ═══════════════════════════════════════

function buildDisabledRows(message) {
  if (!message?.components?.length) return [];
  return message.components.map((row) => {
    const newRow = ActionRowBuilder.from(row);
    newRow.components = row.components.map((c) => ButtonBuilder.from(c).setDisabled(true));
    return newRow;
  });
}

async function handleResetConfigConfirm(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.split('_');
  const system = parts[2];
  const guildId = parts[3];

  if (guildId !== interaction.guild.id) {
    return interaction.editReply('❌ This reset prompt is not for this server.');
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply('❌ You need **Administrator** permission to reset config.');
  }

  if (system === 'all') {
    guildConfig.deleteConfig(guildId);
    configCache.invalidate(guildId);
    await interaction.editReply('♻️ All configuration has been reset.');
  } else if (system === 'tickets') {
    guildConfig.setMany(guildId, {
      ticket_category: null,
      ticket_log_channel: null,
      transcript_channel: null,
    });
    configCache.invalidate(guildId);
    await interaction.editReply('♻️ Ticket configuration reset.');
  } else if (system === 'tempvc') {
    guildConfig.setMany(guildId, {
      temp_vc_category: null,
      create_vc_channel: null,
      create_duo_channel: null,
    });
    configCache.invalidate(guildId);
    await interaction.editReply('♻️ Temp VC configuration reset.');
  } else {
    await interaction.editReply('❌ Unknown reset target.');
  }

  const disabledRows = buildDisabledRows(interaction.message);
  if (disabledRows.length) {
    await interaction.message.edit({ components: disabledRows }).catch(() => {});
  }
}

async function handleResetConfigCancel(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply('❌ You need **Administrator** permission to cancel resets.');
  }

  await interaction.editReply('✅ Reset cancelled.');

  const disabledRows = buildDisabledRows(interaction.message);
  if (disabledRows.length) {
    await interaction.message.edit({ components: disabledRows }).catch(() => {});
  }
}

// ═══════════════════════════════════════
// VC CONTROL PANEL HANDLERS
// ═══════════════════════════════════════

// Find a user's active temp VC from the Map.
// Works whether clicked from the VC text chat OR a permanent control panel.
function findUserVc(tempVCs, userId, interactionChannelId, userVoiceChannelId) {
  // 1. Direct match: button clicked inside the VC's built-in text chat
  if (tempVCs.has(interactionChannelId)) {
    const data = tempVCs.get(interactionChannelId);
    if (data.creatorId === userId) {
      return { vcChannelId: interactionChannelId, vcData: data };
    }
  }

  // 2. User is in a VC they own
  if (userVoiceChannelId && tempVCs.has(userVoiceChannelId)) {
    const data = tempVCs.get(userVoiceChannelId);
    if (data.creatorId === userId) {
      return { vcChannelId: userVoiceChannelId, vcData: data };
    }
  }

  // 3. Search the entire Map for any VC owned by this user
  for (const [channelId, data] of tempVCs.entries()) {
    if (data.creatorId === userId) {
      return { vcChannelId: channelId, vcData: data };
    }
  }

  return null;
}

async function handleVcButton(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;
  const modalButtons = ['vc_rename', 'vc_limit'];
  const selectButtons = ['vc_trust', 'vc_reject', 'vc_kick', 'vc_ban'];

  // Defer immediately for non-modal/non-select buttons (must respond within 3s)
  // Modal buttons use showModal(), select buttons use reply() with select menu
  if (!modalButtons.includes(id) && !selectButtons.includes(id)) {
    await interaction.deferReply({ ephemeral: true });
  }

  // Helper to reply based on deferred state
  const errorReply = (msg) => {
    if (interaction.deferred) {
      return interaction.editReply({ content: msg });
    }
    return interaction.reply({ content: msg, ephemeral: true });
  };

  // --- Find the user's temp VC ---
  const result = findUserVc(
    tempVCs,
    interaction.user.id,
    interaction.channelId,
    interaction.member.voice?.channelId,
  );

  if (!result) {
    return errorReply('\u274C You don\'t have an active voice channel. Join \u2795 Create VC first.');
  }

  const { vcChannelId, vcData } = result;

  // Check if creator is in the VC (except for delete)
  const creatorInVC = interaction.member.voice?.channelId === vcChannelId;
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
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('vc_trust_select')
        .setPlaceholder('Select a user to trust...')
        .setMinValues(1)
        .setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: '\u2795 Select a user to give access to your VC:',
        components: [row],
        ephemeral: true,
      });
    }

    if (id === 'vc_reject') {
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('vc_reject_select')
        .setPlaceholder('Select a user to reject...')
        .setMinValues(1)
        .setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: '\uD83D\uDEAB Select a user to reject from your VC:',
        components: [row],
        ephemeral: true,
      });
    }

    if (id === 'vc_kick') {
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('vc_kick_select')
        .setPlaceholder('Select a user to kick...')
        .setMinValues(1)
        .setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: '\uD83D\uDC62 Select a user to kick from your VC:',
        components: [row],
        ephemeral: true,
      });
    }

    if (id === 'vc_ban') {
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('vc_ban_select')
        .setPlaceholder('Select a user to ban...')
        .setMinValues(1)
        .setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: '\uD83D\uDD28 Select a user to ban from your VC:',
        components: [row],
        ephemeral: true,
      });
    }

    const vc = interaction.guild.channels.cache.get(vcChannelId);

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
      tempVCs.delete(vcChannelId);
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

  console.log('[VC Modal] customId:', id, 'channelId:', interaction.channelId);
  console.log('[VC Modal] Map size:', tempVCs?.size);

  // Find the user's temp VC (works from VC text chat or permanent panel)
  const result = findUserVc(
    tempVCs,
    interaction.user.id,
    interaction.channelId,
    interaction.member.voice?.channelId,
  );

  if (!result) {
    return interaction.reply({
      content: '\u274C You don\'t have an active voice channel. Join \u2795 Create VC first.',
      ephemeral: true,
    });
  }

  const { vcChannelId, vcData } = result;

  const voiceChannel = interaction.guild.channels.cache.get(vcChannelId);
  if (!voiceChannel) {
    return interaction.reply({ content: '\u274C Voice channel not found.', ephemeral: true });
  }

  const creatorInVC = interaction.member.voice?.channelId === vcChannelId;
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
      if (vcData.type === 'duo') {
        return interaction.editReply('\u274C Duo VCs are locked to 2 users.');
      }
      await voiceChannel.setUserLimit(limit);
      if (limit === 0) {
        await interaction.editReply('\u2705 User limit removed (unlimited).');
      } else {
        await interaction.editReply(`\u2705 User limit set to **${limit}**.`);
      }
      return;
    }

  } catch (err) {
    console.error(`[VC Modal] Error handling ${id}:`, err.message);
    await interaction.editReply('\u274C An error occurred while processing your request.').catch(() => {});
  }
}

// ═══════════════════════════════════════
// VC USER SELECT MENU HANDLER
// ═══════════════════════════════════════

async function handleVcSelectMenu(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;

  // Find the user's temp VC
  const result = findUserVc(
    tempVCs,
    interaction.user.id,
    interaction.channelId,
    interaction.member.voice?.channelId,
  );

  if (!result) {
    return interaction.update({
      content: '\u274C VC session expired. Leave and rejoin \u2795 Create VC.',
      components: [],
    });
  }

  const { vcChannelId } = result;

  if (interaction.user.id !== result.vcData.creatorId) {
    return interaction.update({
      content: '\u274C Only the VC creator can use these controls.',
      components: [],
    });
  }

  const selectedUser = interaction.users.first();
  if (!selectedUser) {
    return interaction.update({ content: '\u274C No user selected.', components: [] });
  }

  const member = interaction.guild.members.cache.get(selectedUser.id)
    || await interaction.guild.members.fetch(selectedUser.id).catch(() => null);

  if (!member) {
    return interaction.update({ content: '\u274C User not found.', components: [] });
  }

  const vc = interaction.guild.channels.cache.get(vcChannelId);
  if (!vc) {
    return interaction.update({ content: '\u274C Voice channel not found.', components: [] });
  }

  try {
    if (id === 'vc_trust_select') {
      await vc.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      });
      return interaction.update({
        content: `\u2705 ${member.displayName} can now join your VC even if locked/hidden.`,
        components: [],
      });
    }

    if (id === 'vc_reject_select') {
      if (member.voice?.channelId === vcChannelId) {
        await member.voice.disconnect('Rejected by VC owner').catch(() => {});
      }
      await vc.permissionOverwrites.edit(member.id, {
        ViewChannel: false,
        Connect: false,
      });
      return interaction.update({
        content: `\uD83D\uDEAB ${member.displayName} has been rejected from your VC.`,
        components: [],
      });
    }

    if (id === 'vc_kick_select') {
      if (member.id === interaction.user.id) {
        return interaction.update({ content: '\u274C You cannot kick yourself.', components: [] });
      }
      if (member.voice?.channelId !== vcChannelId) {
        return interaction.update({
          content: '\u274C That user is not in your voice channel.',
          components: [],
        });
      }
      await member.voice.disconnect('Kicked from VC by owner');
      await vc.permissionOverwrites.edit(member.id, {
        Connect: false,
        ViewChannel: false,
      });
      return interaction.update({
        content: `\uD83D\uDC62 ${member.displayName} has been kicked from your VC.`,
        components: [],
      });
    }

    if (id === 'vc_ban_select') {
      if (member.id === interaction.user.id) {
        return interaction.update({ content: '\u274C You cannot ban yourself.', components: [] });
      }
      if (member.voice?.channelId === vcChannelId) {
        await member.voice.disconnect('Banned from VC by owner').catch(() => {});
      }
      await vc.permissionOverwrites.edit(member.id, {
        Connect: false,
        ViewChannel: false,
        Speak: false,
      });
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('\uD83D\uDD28 Banned from Voice Channel')
              .setDescription(`You have been banned from **${vc.name}** in **${interaction.guild.name}**`)
              .setColor(0xED4245)
              .addFields(
                { name: 'Banned By', value: interaction.user.username },
              ),
          ],
        });
      } catch {}
      return interaction.update({
        content: `\uD83D\uDD28 ${member.displayName} has been banned from your VC.`,
        components: [],
      });
    }
  } catch (err) {
    console.error('[VC Select Error]', err);
    return interaction.update({
      content: '\u274C Something went wrong. Please try again.',
      components: [],
    }).catch(() => {});
  }
}
