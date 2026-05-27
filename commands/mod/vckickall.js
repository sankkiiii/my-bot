const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccessTemp,
  prefixError,
  prefixSuccessTemp,
  deleteTrigger,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vckickall')
    .setDescription('Disconnect everyone from a voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target VC (leave empty to use your current VC)')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    ),

  name: 'vckickall',
  aliases: ['vcpurge', 'kickall', 'emptyvc', 'clearvc'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check (5s as requested)
    const remaining = cooldown.check('vckickall', executor.id, guild.id, 5000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Permission checks
    if (!executor.permissions.has(PermissionFlagsBits.MoveMembers)) {
      const msg = `${e.error} You need **Move Members** permission.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
      const msg = `${e.error} I need **Move Members** permission.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Get target VC
    let targetVC;
    if (isSlash) {
      targetVC = interaction.options.getChannel('channel') || executor.voice?.channel;
    } else {
      const args = message.content.trim().split(/\s+/).slice(1);
      const chMention = message.mentions.channels.first();
      if (chMention) {
        targetVC = chMention;
      } else if (args[0]) {
        targetVC = guild.channels.cache.get(args[0]);
      } else {
        targetVC = executor.voice?.channel;
      }
    }

    // Validate VC
    if (!targetVC) {
      const msg = `${e.error} Please specify a voice channel or join one first.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    if (targetVC.type !== ChannelType.GuildVoice) {
      const msg = `${e.error} That is not a voice channel.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Get all members in VC
    const members = targetVC.members;
    if (members.size === 0) {
      const msg = `${e.error} **${targetVC.name}** is already empty.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Delete trigger for prefix
    if (!isSlash) {
      await deleteTrigger(message, 0);
    }

    // Kick all members
    let kicked = 0;
    let failed = 0;
    const kickedNames = [];
    const reason = `VC purged by ${executor.user.tag}`;

    for (const [memberId, member] of members) {
      try {
        await member.voice.disconnect(reason);
        kicked++;
        kickedNames.push(member.displayName);
      } catch {
        failed++;
      }
    }

    // Success embed
    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setAuthor({
        name: `Voice Channel Purged — ${targetVC.name}`,
        iconURL: executor.user.displayAvatarURL({ dynamic: true })
      })
      .addFields(
        {
          name: `${e.vckick} Disconnected`,
          value: `**${kicked}** member${kicked !== 1 ? 's' : ''}`,
          inline: true
        },
        {
          name: `${e.channels} Channel`,
          value: targetVC.name,
          inline: true
        },
        {
          name: `${e.user} By`,
          value: `${executor}`,
          inline: true
        }
      )
      .setFooter({
        text: failed > 0
          ? `${failed} member(s) could not be disconnected`
          : `All members disconnected successfully`
      })
      .setTimestamp();

    // Show names if 10 or fewer
    if (kickedNames.length > 0 && kickedNames.length <= 10) {
      embed.addFields({
        name: 'Members',
        value: kickedNames.join(', '),
        inline: false
      });
    }

    const replyOptions = { embeds: [embed] };
    if (isSlash) {
      return slashSuccessTemp(interaction, replyOptions);
    } else {
      return prefixSuccessTemp(message, replyOptions);
    }
  },
};
