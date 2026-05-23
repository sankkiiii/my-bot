const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send a ticket panel embed with an Open Ticket button')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  name: 'panel',

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let channel, guild, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        channel = interaction.channel;
        guild = interaction.guild;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '\u274C You need the **Manage Channels** permission to use this command.', ephemeral: true });
        }
      } else {
        const message = interactionOrMessage;
        channel = message.channel;
        guild = message.guild;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply('\u274C You need the **Manage Channels** permission to use this command.');
        }
        replyFn = (content) => message.reply(content);
      }

      const embed = new EmbedBuilder()
        .setTitle('\uD83D\uDCCB Support Tickets')
        .setDescription('Click the button below to open a support ticket.\nOur staff will assist you shortly.')
        .setColor(0x5865f2)
        .setFooter({ text: guild.name });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('\uD83D\uDCE9 Open Ticket')
          .setStyle(ButtonStyle.Primary),
      );

      await channel.send({ embeds: [embed], components: [row] });
      await replyFn('Ticket panel sent!');
    } catch (err) {
      console.error('[Panel]', err);
    }
  },
};
