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
    .setName('vcpanel')
    .setDescription('Send a permanent VC control panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  name: 'vcpanel',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let channel, guild, replyFn, client;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        guild = interaction.guild;
        client = argsOrClient;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '\u274C You need the **Manage Channels** permission to use this command.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        channel = message.channel;
        guild = message.guild;
        client = clientOrUndefined;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply('\u274C You need the **Manage Channels** permission to use this command.');
        }
        replyFn = (content) => message.reply(content);
      }

      // Check for existing VC panel in this channel
      try {
        const messages = await channel.messages.fetch({ limit: 20 });
        const existingPanel = messages.find(
          (m) =>
            m.author.id === client.user.id &&
            m.components?.[0]?.components?.some((c) => c.customId === 'vc_rename'),
        );
        if (existingPanel) {
          return replyFn('\u26A0\uFE0F A VC control panel already exists in this channel.');
        }
      } catch (err) {
        console.error('[VCPanel] Failed to check for existing panel:', err.message);
      }

      const embed = new EmbedBuilder()
        .setTitle('\uD83C\uDF99\uFE0F Voice Channel Controls')
        .setDescription(
          'Create a temp VC by joining **\u2795 Create VC** or **\u2795 Create Duo**, then use the buttons below to manage your channel.\nOnly the channel creator can use these controls.',
        )
        .setColor(0x5865f2)
        .addFields(
          { name: '\uD83C\uDFF7\uFE0F Rename', value: 'Change channel name', inline: true },
          { name: '\uD83D\uDC65 Limit', value: 'Set user limit', inline: true },
          { name: '\uD83D\uDD12 Lock', value: 'Block new joins', inline: true },
          { name: '\uD83D\uDD13 Unlock', value: 'Allow joins', inline: true },
          { name: '\uD83D\uDC41\uFE0F Hide', value: 'Hide from list', inline: true },
          { name: '\uD83D\uDC41\uFE0F Unhide', value: 'Show in list', inline: true },
          { name: '\u231B Waiting Room', value: 'See but can\'t join', inline: true },
          { name: '\uD83D\uDEAB Reject User', value: 'Block a user', inline: true },
          { name: '\u2795 Trust User', value: 'Allow a user', inline: true },
          { name: '\uD83D\uDDD1\uFE0F Delete VC', value: 'Delete channel', inline: true },
          { name: '\uD83D\uDC62 Kick VC', value: 'Remove a user from the VC', inline: true },
          { name: '\uD83D\uDD28 Ban VC', value: 'Ban a user from rejoining the VC', inline: true },
        )
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: `${guild.name} \u2022 Create a VC first, then use these buttons` });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vc_rename').setLabel('\uD83C\uDFF7\uFE0F Rename').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_limit').setLabel('\uD83D\uDC65 Set Limit').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_lock').setLabel('\uD83D\uDD12 Lock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_unlock').setLabel('\uD83D\uDD13 Unlock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_hide').setLabel('\uD83D\uDC41\uFE0F Hide').setStyle(ButtonStyle.Secondary),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vc_unhide').setLabel('\uD83D\uDC41\uFE0F Unhide').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_waiting').setLabel('\u231B Waiting').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_trust').setLabel('\u2795 Trust').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_reject').setLabel('\uD83D\uDEAB Reject').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_delete').setLabel('\uD83D\uDDD1\uFE0F Delete').setStyle(ButtonStyle.Danger),
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vc_kick').setLabel('\uD83D\uDC62 Kick from VC').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('vc_ban').setLabel('\uD83D\uDD28 Ban from VC').setStyle(ButtonStyle.Danger),
      );

      await channel.send({ embeds: [embed], components: [row1, row2, row3] });
      await replyFn('\u2705 VC control panel sent! This panel works permanently \u2014 users can control their temp VCs from here.');
    } catch (err) {
      console.error('[VCPanel]', err);
    }
  },
};
