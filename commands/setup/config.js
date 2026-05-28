const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const getConfig = require('../../utils/getConfig');
const guildConfig = require('../../database/guildConfig');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

function formatChannel(guild, id) {
  if (!id) return '❌';
  const ch = guild.channels.cache.get(id);
  return ch ? ch.toString() : '❌ (Deleted)';
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
      let guild;
      let replyError;
      let replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
        replyError = (content) => slashError(interaction, content);
        replySuccess = (opts) => slashSuccess(interaction, opts);

        const remaining = cooldown.check('config', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return replyError(`${e.error} You need **Administrator** permission to view config.`);
        }
      } else {
        const message = interactionOrMessage;
        guild = message.guild;
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }
        replyError = (content) => prefixError(message, content);
        replySuccess = (opts) => prefixSuccess(message, opts);

        const remaining = cooldown.check('config', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return replyError(`${e.error} You need **Administrator** permission to view config.`);
        }
      }

      const cfg = getConfig(guild.id) || {};

      const description = `🎫 **Tickets**
Category: ${formatChannel(guild, cfg.ticket_category)}
Log: ${formatChannel(guild, cfg.ticket_log_channel)}
Transcript: ${formatChannel(guild, cfg.transcript_channel)}

🔊 **Temp VC**
Category: ${formatChannel(guild, cfg.temp_vc_category)}
Hub: ${formatChannel(guild, cfg.create_vc_channel)}
Duo: ${formatChannel(guild, cfg.create_duo_channel)}`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ dynamic: true }),
        })
        .setDescription(description);

      if (isSlash) {
        return replySuccess({ embeds: [embed], ephemeral: true });
      }
      return replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[Config]', err);
    }
  },
};
