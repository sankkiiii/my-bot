const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const configCache = require('../../utils/configCache');
const getConfig = require('../../utils/getConfig');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
} = require('../../utils/replyHelper');
const { success, error, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('tickets')
        .setDescription('Set up the ticket system')
        .addChannelOption((opt) =>
          opt.setName('category')
            .setDescription('Category where ticket channels will be created')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName('log_channel')
            .setDescription('Channel for ticket open/close logs')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName('transcript_channel')
            .setDescription('Channel where HTML transcripts are sent')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('tempvc')
        .setDescription('Set up the temp voice channel system')
        .addChannelOption((opt) =>
          opt.setName('category')
            .setDescription('Category where temp VCs will be created')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName('hub_trigger')
            .setDescription('Voice channel that triggers hub VC creation')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('duo')
        .setDescription('Set the duo VC trigger channel')
        .addChannelOption((opt) =>
          opt.setName('duo_trigger')
            .setDescription('Voice channel that triggers duo VC creation')
            .setRequired(true),
        ),
    ),

  name: 'setup',
  aliases: ['configure', 'botsetup'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      if (!isSlash) {
        return prefixError(interactionOrMessage, withEmoji('setup', 'Please use `/setup` for bot configuration.'));
      }

      const interaction = interactionOrMessage;
      const guild = interaction.guild;
      if (!guild) {
        return slashError(interaction, 'This command only works in a server.');
      }

      const remaining = cooldown.check('setup', interaction.user.id, interaction.guild.id, 5000);
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        return slashError(interaction, withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`));
      }

      const me = guild.members.me;
      const subcommand = interaction.options.getSubcommand();

      if (!me) {
        return slashError(interaction, error('Could not verify bot permissions.'));
      }

      if (subcommand === 'tickets') {
        const category = interaction.options.getChannel('category');
        const logChannel = interaction.options.getChannel('log_channel');
        const transcriptChannel = interaction.options.getChannel('transcript_channel');

        if (category.type !== ChannelType.GuildCategory) {
          return slashError(interaction, error('Ticket category must be a **Category** channel.'));
        }
        if (logChannel.type !== ChannelType.GuildText) {
          return slashError(interaction, error('Log channel must be a **Text** channel.'));
        }
        if (transcriptChannel.type !== ChannelType.GuildText) {
          return slashError(interaction, error('Transcript channel must be a **Text** channel.'));
        }
        if (!category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
          return slashError(interaction, error('I need **Manage Channels** in the ticket category.'));
        }
        if (!logChannel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
          return slashError(interaction, error('I need **Send Messages** in the log channel.'));
        }
        if (!transcriptChannel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
          return slashError(interaction, error('I need **Send Messages** in the transcript channel.'));
        }

        try {
          guildConfig.setMany(guild.id, {
            ticket_category: category.id,
            ticket_log_channel: logChannel.id,
            transcript_channel: transcriptChannel.id,
            setup_by: interaction.user.id,
            setup_at: new Date().toISOString(),
          });
          configCache.invalidate(guild.id);
        } catch (err) {
          console.error('[Setup]', err);
          return slashError(interaction, error(`Error: ${err.message}`));
        }

        const embed = new EmbedBuilder()
          .setColor('#FF7043')
          .setAuthor({
            name: guild.name,
            iconURL: guild.iconURL({ dynamic: true }),
          })
          .setDescription(success(`Setup complete\n\n🎫 **Tickets:** ${category} • ${logChannel} • ${transcriptChannel}`));

        return slashSuccess(interaction, { embeds: [embed], ephemeral: true });
      }

      if (subcommand === 'tempvc') {
        const category = interaction.options.getChannel('category');
        const hubTrigger = interaction.options.getChannel('hub_trigger');

        if (category.type !== ChannelType.GuildCategory) {
          return slashError(interaction, error('Temp VC category must be a **Category** channel.'));
        }
        if (hubTrigger.type !== ChannelType.GuildVoice) {
          return slashError(interaction, error('Hub trigger must be a **Voice** channel.'));
        }
        if (!category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
          return slashError(interaction, error('I need **Manage Channels** in the temp VC category.'));
        }
        if (!hubTrigger.permissionsFor(me).has(PermissionFlagsBits.MoveMembers)) {
          return slashError(interaction, error('I need **Move Members** in the hub trigger channel.'));
        }

        try {
          guildConfig.setMany(guild.id, {
            temp_vc_category: category.id,
            create_vc_channel: hubTrigger.id,
            setup_by: interaction.user.id,
            setup_at: new Date().toISOString(),
          });
          configCache.invalidate(guild.id);
        } catch (err) {
          console.error('[Setup]', err);
          return slashError(interaction, error(`Error: ${err.message}`));
        }

        const embed = new EmbedBuilder()
          .setColor('#FF7043')
          .setAuthor({
            name: guild.name,
            iconURL: guild.iconURL({ dynamic: true }),
          })
          .setDescription(success(`Setup complete\n\n🔊 **Temp VC:** ${category} • ${hubTrigger}`));

        return slashSuccess(interaction, { embeds: [embed], ephemeral: true });
      }

      if (subcommand === 'duo') {
        const duoTrigger = interaction.options.getChannel('duo_trigger');
        const existing = getConfig(guild.id);

        if (duoTrigger.type !== ChannelType.GuildVoice) {
          return slashError(interaction, error('Duo trigger must be a **Voice** channel.'));
        }
        if (existing?.create_vc_channel && existing.create_vc_channel === duoTrigger.id) {
          return slashError(interaction, error('Duo trigger cannot be the same as the hub trigger.'));
        }

        try {
          guildConfig.setMany(guild.id, {
            create_duo_channel: duoTrigger.id,
            setup_by: interaction.user.id,
            setup_at: new Date().toISOString(),
          });
          configCache.invalidate(guild.id);
        } catch (err) {
          console.error('[Setup]', err);
          return slashError(interaction, error(`Error: ${err.message}`));
        }

        const embed = new EmbedBuilder()
          .setColor('#FF7043')
          .setAuthor({
            name: guild.name,
            iconURL: guild.iconURL({ dynamic: true }),
          })
          .setDescription(success(`Setup complete\n\n🎙️ **Duo VC:** ${duoTrigger}`));

        return slashSuccess(interaction, { embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      console.error('[Setup]', err);
    }
  },
};
