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
const e = require('../../config/emojis');

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
      let channel;
      let guild;
      let replyFn;
      let client;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return interaction.reply({
            content: 'This command only works in a server.',
            ephemeral: true,
          });
        }
        channel = interaction.channel;
        guild = interaction.guild;
        client = argsOrClient;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({
            content: `${e.error} You need the **Manage Channels** permission to use this command.`,
            ephemeral: true,
          });
        }
      } else {
        const message = interactionOrMessage;
        if (!message.guild) {
          return message.reply('This command only works in a server.');
        }
        channel = message.channel;
        guild = message.guild;
        client = clientOrUndefined;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply(`${e.error} You need the **Manage Channels** permission to use this command.`);
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
          return replyFn(`${e.warning} A VC control panel already exists in this channel.`);
        }
      } catch (err) {
        console.error('[VCPanel] Failed to check for existing panel:', err.message);
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Voice Controls')
        .setDescription(
          `${e.rename} Rename  ${e.limit} Limit  ${e.lock} Lock  ${e.unlock} Unlock\n` +
          `${e.hide} Hide  ${e.unhide} Unhide  ${e.waiting} Wait  ${e.delete} Delete\n` +
          `${e.trust} Trust  ${e.reject} Reject  ${e.vcKick} Kick  ${e.vcBan} Ban`,
        )
        .setFooter({ text: 'Only the channel creator can use these' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vc_rename').setLabel('Rename').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_limit').setLabel('Limit').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_lock').setLabel('Lock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_unlock').setLabel('Unlock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_hide').setLabel('Hide').setStyle(ButtonStyle.Secondary),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vc_unhide').setLabel('Unhide').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_waiting').setLabel('Wait').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_trust').setLabel('Trust').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_reject').setLabel('Reject').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vc_delete').setLabel('Delete').setStyle(ButtonStyle.Danger),
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vc_kick').setLabel('Kick').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('vc_ban').setLabel('Ban').setStyle(ButtonStyle.Danger),
      );

      await channel.send({ embeds: [embed], components: [row1, row2, row3] });
      await replyFn(`${e.success} VC control panel sent! This panel works permanently — users can control their temp VCs from here.`);
    } catch (err) {
      console.error('[VCPanel]', err);
    }
  },
};
