const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const { slashError, slashSuccess } = require('../../utils/replyHelper');
const { success, error, withEmoji } = require('../../utils/emoji');

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
        return interactionOrMessage.reply(withEmoji('setup', 'Please use `/resetconfig` to reset configuration.'));
      }

      const interaction = interactionOrMessage;

      if (!interaction.guild) {
        return slashError(interaction, 'This command only works in a server.');
      }

      const remaining = cooldown.check('resetconfig', interaction.user.id, interaction.guild.id, 5000);
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        return slashError(interaction, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
      }

      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return slashError(interaction, error('You need **Administrator** permission.'));
      }

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

      await slashSuccess(interaction, {
        content: withEmoji('warning', `Are you sure? This will reset ${system === 'all' ? 'all configuration' : `${system} configuration`}.`),
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
