const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const getConfig = require('../../utils/getConfig');
const guildConfig = require('../../database/guildConfig');

function formatChannel(guild, id) {
  if (!id) return '❌ Not set';
  const ch = guild.channels.cache.get(id);
  return ch ? ch.toString() : '⚠️ Channel deleted — reconfigure';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View current bot configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  name: 'config',

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      const guild = isSlash ? interactionOrMessage.guild : interactionOrMessage.guild;
      if (!guild) return;

      if (!isSlash) {
        if (!interactionOrMessage.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interactionOrMessage.reply('❌ You need **Administrator** permission to view config.');
        }
      }

      const cfg = getConfig(guild.id) || {};
      const ticketCount = guildConfig.getTicketCount(guild.id);
      const noprefixCount = guildConfig.getNoPrefixUsers(guild.id).length;

      const ticketsConfigured = !!(cfg.ticket_category && cfg.ticket_log_channel && cfg.transcript_channel);
      const tempVcConfigured = !!(cfg.temp_vc_category && cfg.create_vc_channel);

      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Bot Configuration — ${guild.name}`)
        .setColor(0x5865F2)
        .addFields(
          {
            name: '🎫 Ticket System',
            value: [
              `Category: ${formatChannel(guild, cfg.ticket_category)}`,
              `Log Channel: ${formatChannel(guild, cfg.ticket_log_channel)}`,
              `Transcript Channel: ${formatChannel(guild, cfg.transcript_channel)}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🔊 Temp VC System',
            value: [
              `Category: ${formatChannel(guild, cfg.temp_vc_category)}`,
              `Hub Trigger: ${formatChannel(guild, cfg.create_vc_channel)}`,
              `Duo Trigger: ${formatChannel(guild, cfg.create_duo_channel)}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '📊 Stats',
            value: [
              `Total Tickets Created: ${ticketCount}`,
              `No-Prefix Users: ${noprefixCount}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: 'ℹ️ Setup Status',
            value: [
              `Tickets: ${ticketsConfigured ? '✅ Configured' : '❌ Not configured'}`,
              `Temp VC: ${tempVcConfigured ? '✅ Configured' : '❌ Not configured'}`,
            ].join('\n'),
            inline: false,
          },
        )
        .setFooter({
          text: `Use /setup to configure • Last updated: ${cfg.updated_at || 'Unknown'}`,
        });

      if (isSlash) {
        return interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
      }
      return interactionOrMessage.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[Config]', err);
    }
  },
};
