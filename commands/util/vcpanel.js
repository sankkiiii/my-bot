const {
  SlashCommandBuilder,
  CommandInteraction,
  PermissionFlagsBits,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const buildVcPanel = require('../../utils/buildVcPanel');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcpanel')
    .setDescription('Send a permanent VC control panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  name: 'vcpanel',
  aliases: ['vcp', 'voicepanel', 'vccontrols'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check (3s)
    const remaining = cooldown.check('vcpanel', executor.id, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Permission check: Administrator only
    if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
      const msg = `${e.error} You need **Administrator** permission to send the VC panel.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const channel = interactionOrMessage.channel;
    const client = interactionOrMessage.client;

    try {
      // Duplicate guard: check if panel already exists in this channel
      const messages = await channel.messages.fetch({ limit: 20 });
      const existingPanel = messages.find(
        (m) =>
          m.author.id === client.user.id &&
          m.components?.[0]?.components?.some((c) => c.customId === 'vc_rename')
      );

      if (existingPanel) {
        const msg = `${e.warning} A VC control panel already exists in this channel.`;
        return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
      }

      const { embed, rows } = buildVcPanel();
      await channel.send({ embeds: [embed], components: rows });

      const msg = `${e.success} VC control panel sent!`;
      if (isSlash) {
        return slashSuccess(interaction, { content: msg, ephemeral: true });
      } else {
        return prefixSuccess(message, { content: msg });
      }
    } catch (err) {
      console.error('[VCPanel Command]', err);
      const msg = `${e.error} Failed to send the panel.`;
      if (isSlash) return slashError(interaction, msg);
      return prefixError(message, msg);
    }
  },
};
