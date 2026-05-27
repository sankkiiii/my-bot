const {
  SlashCommandBuilder,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  prefixError,
} = require('../../utils/replyHelper');
const buildVcPanel = require('../../utils/buildVcPanel');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcpanel')
    .setDescription('Resend the VC control panel in your current voice channel'),

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

    const voiceChannelId = executor.voice?.channelId;
    if (!voiceChannelId) {
      const msg = `${e.error} You must be in a voice channel to use this.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const tempVCs = interactionOrMessage.client.tempVCs;
    const vcData = tempVCs.get(voiceChannelId);

    if (!vcData) {
      const msg = `${e.error} You are not in a temporary voice channel.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    if (vcData.creatorId !== executor.id) {
      const msg = `${e.error} Only the voice channel creator can resend the panel.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel) {
      const msg = `${e.error} Voice channel not found.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    try {
      const { embed, rows } = buildVcPanel();
      await voiceChannel.send({ embeds: [embed], components: rows });

      if (isSlash) {
        await interaction.reply({
          content: `${e.success} Panel resent in your voice channel!`,
          ephemeral: true,
        });
      } else {
        const successMsg = await message.reply(`${e.success} Panel resent in your voice channel!`);
        setTimeout(() => successMsg.delete().catch(() => {}), 5000);
        setTimeout(() => message.delete().catch(() => {}), 0);
      }
    } catch (err) {
      console.error('[VCPanel Command]', err);
      const msg = `${e.error} Failed to resend the panel.`;
      if (isSlash) return slashError(interaction, msg);
      return prefixError(message, msg);
    }
  },
};
