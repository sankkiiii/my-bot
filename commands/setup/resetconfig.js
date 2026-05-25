const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetconfig')
    .setDescription('Reset configuration for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName('system')
        .setDescription('Which system to reset')
        .addChoices(
          { name: 'all', value: 'all' },
          { name: 'tickets', value: 'tickets' },
          { name: 'tempvc', value: 'tempvc' },
        ),
    ),

  name: 'resetconfig',

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      if (!isSlash) {
        return interactionOrMessage.reply('⚙️ Please use `/resetconfig` to reset configuration.');
      }

      const interaction = interactionOrMessage;
      const system = interaction.options.getString('system') || 'all';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resetconfig_confirm_${system}_${interaction.guild.id}`)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('resetconfig_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({
        content: '⚠️ Are you sure?',
        components: [row],
        ephemeral: true,
      });

      setTimeout(async () => {
        try {
          const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
            ButtonBuilder.from(row.components[1]).setDisabled(true),
          );
          await interaction.editReply({ components: [disabledRow] });
        } catch {}
      }, 30000);
    } catch (err) {
      console.error('[ResetConfig]', err);
    }
  },
};
