const { SlashCommandBuilder } = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for going AFK')
        .setRequired(false)
        .setMaxLength(100),
    ),
  aliases: ['away', 'brb'],
  async execute(interaction, client, args) {
    try {
      const member = interaction.member;
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      const reason = interaction.options?.getString('reason')
        || args?.join(' ')
        || 'AFK';

      const existing = guildConfig.getAFK(guildId, userId);
      if (existing) {
        return interaction.reply({
          content: `${e.warning} You are already AFK with reason: **${existing.reason}**`,
          ephemeral: true,
        });
      }

      guildConfig.setAFK(guildId, userId, reason);

      await interaction.reply({
        content: `${e.afk} **${member.displayName}** is now AFK\n${e.reason} **Reason:** ${reason}`,
      });

      try {
        if (!member.displayName.startsWith('[AFK]')) {
          await member.setNickname(`[AFK] ${member.displayName}`.slice(0, 32));
        }
      } catch {}
    } catch (err) {
      console.error('[AFK Command Error]', err);
      try {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: `${e.error} Error: ${err.message}`,
            ephemeral: true,
          });
        }
        return interaction.reply({
          content: `${e.error} Error: ${err.message}`,
          ephemeral: true,
        });
      } catch {}
    }
  },
};
