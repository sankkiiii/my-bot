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
const { generateTranscript } = require('../utils/transcript');
const { success, error, withEmoji, errorEmoji } = require('../utils/emoji');

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
  'vc_kick', 'vc_ban', 'vc_transfer', 'vc_unban',
];

const VC_MODAL_IDS = ['vc_rename_modal', 'vc_limit_modal'];
const TICKET_MODAL_ID = 'ticket_reason_modal';

const VC_SELECT_IDS = ['vc_trust_select', 'vc_reject_select', 'vc_kick_select', 'vc_ban_select', 'vc_transfer_select', 'vc_unban_select'];

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
            await interaction.reply({ content: error('An error occurred.'), ephemeral: true }).catch(() => {});
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
      content: error('Ticket system not configured. Ask admin to run `/setup tickets`.'),
      ephemeral: true,
    });
  }

  const ticketCategory = guild.channels.cache.get(cfg.ticket_category);
  if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content: error('Ticket category is missing or invalid. Admin: re-run `/setup tickets`'),
      ephemeral: true,
    });
  }

  const botMember = guild.members.me;
  if (!botMember) {
    return interaction.reply({
      content: error('Could not verify bot permissions. Try again in a moment.'),
      ephemeral: true,
    });
  }

  const botPerms = ticketCategory.permissionsFor(botMember);
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)
    || !botPerms?.has(PermissionFlagsBits.ManageChannels)
    || !botPerms?.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.reply({
      content: error('I need **Manage Channels** and **View Channel** in the ticket category.'),
      ephemeral: true,
    });
  }

  // Check for existing ticket BEFORE showing modal
  const existingChannel = guild.channels.cache.find((ch) =>
    ch.parentId === cfg.ticket_category
    && ch.topic?.includes(`Opened by: ${user.id}`),
  );
  if (existingChannel) {
    return interaction.reply({
      content: error(`You already have an open ticket: ${existingChannel}`),
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

  try {
    const cfg = getConfig(interaction.guild.id);

    if (!cfg?.ticket_category) {
      return interaction.editReply({
        content: error('Ticket system not configured.\nAsk an admin to run `/setup tickets` first.'),
      });
    }
    if (!cfg?.ticket_log_channel) {
      return interaction.editReply({
        content: error('Ticket log channel not configured.\nAsk an admin to run `/setup tickets` first.'),
      });
    }
    if (!cfg?.transcript_channel) {
      return interaction.editReply({
        content: error('Transcript channel not configured.\nAsk an admin to run `/setup tickets` first.'),
      });
    }

    const reason = interaction.fields.getTextInputValue('ticket_reason_input');

    const existingChannel = interaction.guild.channels.cache.find((c) =>
      c.parentId === cfg.ticket_category
      && c.topic?.includes(`Opened by: ${interaction.user.id}`),
    );
    if (existingChannel) {
      return interaction.editReply({
        content: error(`You already have an open ticket: ${existingChannel}`),
      });
    }

    const ticketNumber = guildConfig.incrementTicketCount(interaction.guild.id);

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      type: ChannelType.GuildText,
      parent: cfg.ticket_category,
      topic: `Opened by: ${interaction.user.id} | Reason: ${reason}`,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
        ...interaction.guild.roles.cache
          .filter((r) =>
            r.permissions.has(PermissionFlagsBits.ManageMessages)
            || r.permissions.has(PermissionFlagsBits.KickMembers)
            || r.permissions.has(PermissionFlagsBits.BanMembers),
          )
          .map((r) => ({
            id: r.id,
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
      .setColor('#57F287')
      .setTitle(`Ticket #${ticketNumber}`)
      .setDescription(
        success(`Ticket #${ticketNumber} opened`) +
        `\n**Opened by:** ${interaction.user}` +
        `\n**Reason:** ${reason}` +
        `\n**Status:** 🟢 Open`
      )
      .setFooter({ text: 'Only staff can close this ticket' })
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ embeds: [welcomeEmbed], components: [closeRow] });

    const logEmbed = new EmbedBuilder()
      .setTitle('Ticket Opened')
      .setColor('#57F287')
      .addFields(
        { name: 'Opened By', value: `${interaction.user.username} (${interaction.user.id})` },
        { name: 'Channel', value: `<#${ticketChannel.id}> (${ticketChannel.name})` },
        { name: 'Ticket #', value: `${ticketNumber}` },
        { name: 'Reason', value: reason },
      )
      .setTimestamp();
    const logChannel = interaction.guild.channels.cache.get(cfg.ticket_log_channel);
    if (logChannel) {
      await logChannel.send({ embeds: [logEmbed] });
    }

    await interaction.editReply({ content: success(`Your ticket has been created: ${ticketChannel}`) });
  } catch (err) {
    console.error('[Ticket Create Error]', err);
    return interaction.editReply({
      content: error(`Error: ${err.message}`),
    });
  }
}

async function handleTicketClose(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const closer = interaction.member;
  const cfg = getConfig(guild.id);

  const isOwner = guildConfig.isOwner(closer.user.id);

  if (
    !isOwner &&
    !closer.permissions.has(PermissionFlagsBits.ManageMessages) &&
    !closer.permissions.has(PermissionFlagsBits.KickMembers) &&
    !closer.permissions.has(PermissionFlagsBits.BanMembers)
  ) {
    return interaction.editReply({
      content: error('You need **Manage Messages**, **Kick Members**, or **Ban Members** permission to close tickets.'),
    });
  }

  await interaction.editReply({
    content: withEmoji('loading', 'Closing ticket and generating transcript...'),
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
      } catch (err) {
        console.error('[TicketClose] Failed to fetch opener:', err);
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
      .setColor('#FEE75C')
      .setTitle('Ticket Transcript')
      .addFields(
        { name: 'Ticket', value: ticketChannel.name, inline: true },
        { name: 'Closed by', value: closer.user.username, inline: true },
        { name: 'Messages', value: `${allMessages.length}`, inline: true },
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
    .setColor('#ED4245')
    .setTitle('Ticket Closed')
    .addFields(
      { name: 'Ticket', value: ticketChannel.name, inline: true },
      { name: 'Closed by', value: `${closer.user.username} (${closer.user.id})`, inline: true },
      { name: 'Opened by', value: openedByTag, inline: true },
      { name: 'Messages', value: `${allMessages.length}`, inline: true },
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
    return interaction.editReply(error('This reset prompt is not for this server.'));
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply(error('You need **Administrator** permission to reset config.'));
  }

  if (system === 'all') {
    guildConfig.deleteConfig(guildId);
    configCache.invalidate(guildId);
    await interaction.editReply(success('Configuration reset.'));
  } else if (system === 'tickets') {
    guildConfig.setMany(guildId, {
      ticket_category: null,
      ticket_log_channel: null,
      transcript_channel: null,
    });
    configCache.invalidate(guildId);
    await interaction.editReply(success('Configuration reset.'));
  } else if (system === 'tempvc') {
    guildConfig.setMany(guildId, {
      temp_vc_category: null,
      create_vc_channel: null,
      create_duo_channel: null,
    });
    configCache.invalidate(guildId);
    await interaction.editReply(success('Configuration reset.'));
  } else {
    await interaction.editReply(error('Unknown reset target.'));
  }

  const disabledRows = buildDisabledRows(interaction.message);
  if (disabledRows.length) {
    await interaction.message.edit({ components: disabledRows }).catch(() => {});
  }
}

async function handleResetConfigCancel(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply(error('You need **Administrator** permission to cancel resets.'));
  }

  await interaction.editReply(success('Reset cancelled.'));

  const disabledRows = buildDisabledRows(interaction.message);
  if (disabledRows.length) {
    await interaction.message.edit({ components: disabledRows }).catch(() => {});
  }
}

// ═══════════════════════════════════════
// VC CONTROL PANEL HANDLERS
// ═══════════════════════════════════════

async function handleVcButton(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;
  const modalButtons = ['vc_rename', 'vc_limit'];
  const selectButtons = ['vc_trust', 'vc_reject', 'vc_kick', 'vc_ban'];

  // Defer immediately for non-modal/non-select buttons (must respond within 3s)
  if (!modalButtons.includes(id) && !selectButtons.includes(id)) {
    await interaction.deferReply({ ephemeral: true });
  }

  // Helper to reply based on deferred state
  const errorReply = (msg) => {
    if (interaction.deferred) {
      return interaction.editReply({ content: error(msg) });
    }
    return interaction.reply({ content: error(msg), ephemeral: true });
  };

  const userVoiceChannelId = interaction.member.voice?.channelId;

  if (!userVoiceChannelId) {
    return errorReply('You must be in a voice channel to use these controls.');
  }

  const vcData = tempVCs.get(userVoiceChannelId);

  if (!vcData) {
    return errorReply('You are not in a temporary voice channel.');
  }

  if (interaction.user.id !== vcData.creatorId) {
    return errorReply('Only the voice channel creator can use these controls.');
  }

  const voiceChannel = interaction.guild.channels.cache.get(userVoiceChannelId);

  if (!voiceChannel) {
    return errorReply('Your voice channel no longer exists.');
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
        return errorReply('Duo VCs are locked to 2 users.');
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
        content: withEmoji('vcTrustBtn', 'Select a user to give access to your VC:'),
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
        content: withEmoji('vcRejectBtn', 'Select a user to reject from your VC:'),
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
        content: withEmoji('vcKickBtn', 'Select a user to kick from your VC:'),
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
        content: withEmoji('vcBanBtn', 'Select a user to ban from your VC:'),
        components: [row],
        ephemeral: true,
      });
    }

    if (id === 'vc_transfer') {
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('vc_transfer_select')
        .setPlaceholder('Select a user to transfer ownership to...')
        .setMinValues(1)
        .setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: '🔄 Select a user to transfer your VC ownership to:',
        components: [row],
        ephemeral: true,
      });
    }

    if (id === 'vc_unban') {
      const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('vc_unban_select')
        .setPlaceholder('Select a user to unban from your VC...')
        .setMinValues(1)
        .setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: '🔓 Select a user to unban from your VC:',
        components: [row],
        ephemeral: true,
      });
    }

    if (id === 'vc_lock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
      return interaction.editReply({ content: success('Channel locked.') });
    }

    if (id === 'vc_unlock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
      return interaction.editReply({ content: success('Channel unlocked.') });
    }

    if (id === 'vc_hide') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
      return interaction.editReply({ content: success('Channel hidden.') });
    }

    if (id === 'vc_unhide') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
      return interaction.editReply({ content: success('Channel visible.') });
    }

    if (id === 'vc_waiting') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: true, Connect: false });
      return interaction.editReply({ content: success('Waiting room enabled.') });
    }

    if (id === 'vc_delete') {
      tempVCs.delete(userVoiceChannelId);
      await interaction.editReply({ content: success('Deleting your voice channel...') });
      await voiceChannel.delete().catch(() => {});
      return;
    }
  } catch (err) {
    console.error('[VC Control Error]', err);
    const msg = 'Something went wrong. Please try again.';
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: error(msg) }).catch(() => {});
    }
    return interaction.reply({ content: error(msg), ephemeral: true }).catch(() => {});
  }
}

async function handleVcModal(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;

  const userVoiceChannelId = interaction.member.voice?.channelId;

  if (!userVoiceChannelId) {
    return interaction.reply({
      content: error('You must be in a voice channel to use these controls.'),
      ephemeral: true,
    });
  }

  const vcData = tempVCs.get(userVoiceChannelId);

  if (!vcData) {
    return interaction.reply({
      content: error('You are not in a temporary voice channel.'),
      ephemeral: true,
    });
  }

  if (interaction.user.id !== vcData.creatorId) {
    return interaction.reply({
      content: error('Only the voice channel creator can use these controls.'),
      ephemeral: true,
    });
  }

  const voiceChannel = interaction.guild.channels.cache.get(userVoiceChannelId);

  if (!voiceChannel) {
    return interaction.reply({
      content: error('Your voice channel no longer exists.'),
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    if (id === 'vc_rename_modal') {
      const newName = interaction.fields.getTextInputValue('new_name');
      await voiceChannel.setName(newName);
      await interaction.editReply(success(`Channel renamed to **${newName}**`));
      return;
    }

    if (id === 'vc_limit_modal') {
      const input = interaction.fields.getTextInputValue('user_limit');
      const limit = parseInt(input, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.editReply(error('Please enter a valid number between 0 and 99.'));
      }
      if (vcData.type === 'duo') {
        return interaction.editReply(error('Duo VCs are locked to 2 users.'));
      }
      await voiceChannel.setUserLimit(limit);
      if (limit === 0) {
        await interaction.editReply(success('User limit removed (unlimited).'));
      } else {
        await interaction.editReply(success(`User limit set to **${limit}**`));
      }
      return;
    }

  } catch (err) {
    console.error(`[VC Modal] Error handling ${id}:`, err.message);
    await interaction.editReply(error('An error occurred while processing your request.')).catch(() => {});
  }
}

// ═══════════════════════════════════════
// VC USER SELECT MENU HANDLER
// ═══════════════════════════════════════

async function handleVcSelectMenu(interaction) {
  const id = interaction.customId;
  const tempVCs = interaction.client.tempVCs;

  const userVoiceChannelId = interaction.member.voice?.channelId;

  if (!userVoiceChannelId) {
    return interaction.update({
      content: error('You must be in a voice channel to use these controls.'),
      components: [],
    });
  }

  const vcData = tempVCs.get(userVoiceChannelId);

  if (!vcData) {
    return interaction.update({
      content: error('You are not in a temporary voice channel.'),
      components: [],
    });
  }

  if (interaction.user.id !== vcData.creatorId) {
    return interaction.update({
      content: error('Only the voice channel creator can use these controls.'),
      components: [],
    });
  }

  const voiceChannel = interaction.guild.channels.cache.get(userVoiceChannelId);

  if (!voiceChannel) {
    return interaction.update({
      content: error('Your voice channel no longer exists.'),
      components: [],
    });
  }

  const selectedUser = interaction.users.first();
  if (!selectedUser) {
    return interaction.update({ content: error('No user selected.'), components: [] });
  }

  const member = interaction.guild.members.cache.get(selectedUser.id)
    || await interaction.guild.members.fetch(selectedUser.id).catch(() => null);

  if (!member) {
    return interaction.update({ content: error('User not found.'), components: [] });
  }

  try {
    if (id === 'vc_trust_select') {
      await voiceChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      });
      return interaction.update({
        content: success(`${member.displayName} can now join your channel.`),
        components: [],
      });
    }

    if (id === 'vc_reject_select') {
      if (member.voice?.channelId === userVoiceChannelId) {
        await member.voice.disconnect('Rejected by VC owner').catch(() => {});
      }
      await voiceChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: false,
        Connect: false,
      });
      return interaction.update({
        content: success(`${member.displayName} has been rejected.`),
        components: [],
      });
    }

    if (id === 'vc_kick_select') {
      if (member.id === interaction.user.id) {
        return interaction.update({ content: error('You cannot kick yourself.'), components: [] });
      }
      if (member.voice?.channelId !== userVoiceChannelId) {
        return interaction.update({
          content: error('That user is not in your voice channel.'),
          components: [],
        });
      }
      await member.voice.disconnect('Kicked from VC by owner');
      await voiceChannel.permissionOverwrites.edit(member.id, {
        Connect: false,
        ViewChannel: false,
      });
      return interaction.update({
        content: success(`${member.displayName} has been kicked from the VC.`),
        components: [],
      });
    }

    if (id === 'vc_ban_select') {
      if (member.id === interaction.user.id) {
        return interaction.update({ content: error('You cannot ban yourself.'), components: [] });
      }
      if (member.voice?.channelId === userVoiceChannelId) {
        await member.voice.disconnect('Banned from VC by owner').catch(() => {});
      }
      await voiceChannel.permissionOverwrites.edit(member.id, {
        Connect: false,
        ViewChannel: false,
        Speak: false,
      });
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('Banned from Voice Channel')
              .setDescription(`You have been banned from **${voiceChannel.name}** in **${interaction.guild.name}**`)
              .setColor(0xED4245)
              .addFields(
                { name: 'Banned By', value: interaction.user.username },
              ),
          ],
        });
      } catch (err) {
        console.error('[VC Ban DM Error]', err);
      }
      return interaction.update({
        content: success(`${member.displayName} has been banned from the VC.`),
        components: [],
      });
    }

    if (id === 'vc_transfer_select') {
      // Cannot transfer to yourself
      if (member.id === interaction.user.id) {
        return interaction.update({
          content: error('You cannot transfer ownership to yourself.'),
          components: []
        });
      }

      // Cannot transfer to a bot
      if (member.user.bot) {
        return interaction.update({
          content: error('You cannot transfer ownership to a bot.'),
          components: []
        });
      }

      // New owner must be in the VC
      if (member.voice?.channelId !== userVoiceChannelId) {
        return interaction.update({
          content: error(`**${member.displayName}** must be in your voice channel to receive ownership.`),
          components: []
        });
      }

      const oldCreatorId = vcData.creatorId;

      // Transfer ownership in Map
      tempVCs.set(userVoiceChannelId, {
        ...vcData,
        creatorId: member.id
      });

      // Give new owner ManageChannels + MoveMembers on VC
      try {
        await voiceChannel.permissionOverwrites.edit(member.id, {
          ManageChannels: true,
          MoveMembers: true,
          ViewChannel: true,
          Connect: true,
          Speak: true
        });
      } catch (err) {
        console.error('[VC Transfer] Failed to update perms:', err.message);
      }

      // Remove old owner's ManageChannels permission
      try {
        await voiceChannel.permissionOverwrites.edit(oldCreatorId, {
          ManageChannels: null,
          MoveMembers: null
        });
      } catch (err) {
        console.error('[VC Transfer] Failed to remove old owner perms:', err.message);
      }

      // Notify in VC text chat
      try {
        await voiceChannel.send(
          `🔄 **${member.displayName}** is now the owner of this voice channel.\n` +
          `*(Transferred from <@${oldCreatorId}>)*`
        );
      } catch {}

      // Confirm to old owner
      return interaction.update({
        content: success(`Ownership transferred to **${member.displayName}** successfully.`),
        components: []
      });
    }

    if (id === 'vc_unban_select') {
      // Cannot unban yourself
      if (member.id === interaction.user.id) {
        return interaction.update({
          content: error('You cannot unban yourself.'),
          components: []
        });
      }

      // Check if user actually has a permission overwrite
      const existingOverwrite = voiceChannel.permissionOverwrites.cache.get(member.id);

      if (!existingOverwrite) {
        return interaction.update({
          content: error(`**${member.displayName}** is not banned from your VC.`),
          components: []
        });
      }

      // Check if they actually have denied permissions
      const isDenied = existingOverwrite.deny.has(PermissionFlagsBits.ViewChannel) ||
                       existingOverwrite.deny.has(PermissionFlagsBits.Connect);

      if (!isDenied) {
        return interaction.update({
          content: error(`**${member.displayName}** is not banned from your VC.`),
          components: []
        });
      }

      // Remove all permission overwrites for this user
      try {
        await voiceChannel.permissionOverwrites.delete(member.id);
      } catch (err) {
        console.error('[VC Unban] Failed to remove overwrites:', err.message);
        return interaction.update({
          content: error('Failed to unban user. Check bot permissions.'),
          components: []
        });
      }

      // Confirm
      return interaction.update({
        content: success(`**${member.displayName}** has been unbanned from your VC.`),
        components: []
      });
    }
  } catch (err) {
    console.error('[VC Select Error]', err);
    return interaction.update({
      content: error('Something went wrong. Please try again.'),
      components: [],
    }).catch(() => {});
  }
}
