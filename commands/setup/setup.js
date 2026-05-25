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
        return interactionOrMessage.reply('⚙️ Please use `/setup` for bot configuration.');
      }

      const interaction = interactionOrMessage;
      const guild = interaction.guild;
      const me = guild.members.me;
      const subcommand = interaction.options.getSubcommand();

      if (!me) {
        return interaction.reply({ content: '❌ Could not verify bot permissions.', ephemeral: true });
      }

      if (subcommand === 'tickets') {
        const category = interaction.options.getChannel('category');
        const logChannel = interaction.options.getChannel('log_channel');
        const transcriptChannel = interaction.options.getChannel('transcript_channel');

        if (category.type !== ChannelType.GuildCategory) {
          return interaction.reply({ content: '❌ Ticket category must be a **Category** channel.', ephemeral: true });
        }
        if (logChannel.type !== ChannelType.GuildText) {
          return interaction.reply({ content: '❌ Log channel must be a **Text** channel.', ephemeral: true });
        }
        if (transcriptChannel.type !== ChannelType.GuildText) {
          return interaction.reply({ content: '❌ Transcript channel must be a **Text** channel.', ephemeral: true });
        }
        if (!category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '❌ I need **Manage Channels** in the ticket category.', ephemeral: true });
        }
        if (!logChannel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
          return interaction.reply({ content: '❌ I need **Send Messages** in the log channel.', ephemeral: true });
        }
        if (!transcriptChannel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
          return interaction.reply({ content: '❌ I need **Send Messages** in the transcript channel.', ephemeral: true });
        }

        guildConfig.setMany(guild.id, {
          ticket_category: category.id,
          ticket_log_channel: logChannel.id,
          transcript_channel: transcriptChannel.id,
          setup_by: interaction.user.id,
          setup_at: new Date().toISOString(),
        });
        configCache.invalidate(guild.id);

        const embed = new EmbedBuilder()
          .setTitle('✅ Setup Complete')
          .setColor(0x57F287)
          .addFields(
            { name: '🎫 Ticket Category', value: `${category}`, inline: true },
            { name: '📜 Log Channel', value: `${logChannel}`, inline: true },
            { name: '🧾 Transcript Channel', value: `${transcriptChannel}`, inline: true },
          )
          .setFooter({ text: `Setup by ${interaction.user.username} • ${new Date().toLocaleString()}` });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (subcommand === 'tempvc') {
        const category = interaction.options.getChannel('category');
        const hubTrigger = interaction.options.getChannel('hub_trigger');

        if (category.type !== ChannelType.GuildCategory) {
          return interaction.reply({ content: '❌ Temp VC category must be a **Category** channel.', ephemeral: true });
        }
        if (hubTrigger.type !== ChannelType.GuildVoice) {
          return interaction.reply({ content: '❌ Hub trigger must be a **Voice** channel.', ephemeral: true });
        }
        if (!category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '❌ I need **Manage Channels** in the temp VC category.', ephemeral: true });
        }
        if (!hubTrigger.permissionsFor(me).has(PermissionFlagsBits.MoveMembers)) {
          return interaction.reply({ content: '❌ I need **Move Members** in the hub trigger channel.', ephemeral: true });
        }

        guildConfig.setMany(guild.id, {
          temp_vc_category: category.id,
          create_vc_channel: hubTrigger.id,
          setup_by: interaction.user.id,
          setup_at: new Date().toISOString(),
        });
        configCache.invalidate(guild.id);

        const embed = new EmbedBuilder()
          .setTitle('✅ Setup Complete')
          .setColor(0x57F287)
          .addFields(
            { name: '🔊 Temp VC Category', value: `${category}`, inline: true },
            { name: '➕ Hub Trigger', value: `${hubTrigger}`, inline: true },
          )
          .setFooter({ text: `Setup by ${interaction.user.username} • ${new Date().toLocaleString()}` });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (subcommand === 'duo') {
        const duoTrigger = interaction.options.getChannel('duo_trigger');
        const existing = getConfig(guild.id);

        if (duoTrigger.type !== ChannelType.GuildVoice) {
          return interaction.reply({ content: '❌ Duo trigger must be a **Voice** channel.', ephemeral: true });
        }
        if (existing?.create_vc_channel && existing.create_vc_channel === duoTrigger.id) {
          return interaction.reply({ content: '❌ Duo trigger cannot be the same as the hub trigger.', ephemeral: true });
        }

        guildConfig.setMany(guild.id, {
          create_duo_channel: duoTrigger.id,
          setup_by: interaction.user.id,
          setup_at: new Date().toISOString(),
        });
        configCache.invalidate(guild.id);

        const embed = new EmbedBuilder()
          .setTitle('✅ Setup Complete')
          .setColor(0x57F287)
          .addFields(
            { name: '🎧 Duo Trigger', value: `${duoTrigger}`, inline: true },
          )
          .setFooter({ text: `Setup by ${interaction.user.username} • ${new Date().toLocaleString()}` });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      console.error('[Setup]', err);
    }
  },
};
