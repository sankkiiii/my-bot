const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dump')
    .setDescription('Show all members with a specific role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption((opt) =>
      opt
        .setName('role')
        .setDescription('The role to dump members of')
        .setRequired(true)
    ),

  name: 'dump',
  aliases: ['rolememebers', 'rolelist'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const interaction = isSlash ? interactionOrMessage : null;
    const message = isSlash ? null : interactionOrMessage;
    const guild = interactionOrMessage.guild;
    const executor = isSlash ? interaction.member : message.member;

    if (!guild) return;

    // Cooldown check
    const remaining = cooldown.check('dump', executor.id, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Permission check
    if (!executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
      const msg = `${e.error} You need **Manage Roles** permission.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    let role;
    if (isSlash) {
      role = interaction.options.getRole('role');
    } else {
      const args = message.content.trim().split(/\s+/).slice(1);
      if (!args[0]) {
        return prefixError(message, `${e.error} Please specify a role.`);
      }

      role =
        message.mentions.roles.first() ||
        guild.roles.cache.get(args[0]) ||
        guild.roles.cache.find(
          (r) => r.name.toLowerCase() === args.join(' ').toLowerCase()
        ) ||
        guild.roles.cache.find((r) =>
          r.name.toLowerCase().includes(args.join(' ').toLowerCase())
        );
    }

    if (!role) {
      const msg = `${e.error} Role not found.`;
      return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
    }

    // Fetch all members to ensure cache is full
    await guild.members.fetch();

    const members = role.members;
    if (members.size === 0) {
      const content = `${e.role} **Role:** ${role.name}\n${e.members} **Members:** 0\n\nNo members have this role.`;
      return isSlash
        ? slashSuccess(interaction, { content })
        : prefixSuccess(message, { content });
    }

    const memberLines = members.map(
      (m) => `${m.displayName}, ${m.user.id}, ${m}`
    );

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setAuthor({
        name: role.name,
        iconURL: role.iconURL() || guild.iconURL({ dynamic: true })
      })
      .setDescription(`🎭 | **${role.name}** has **${members.size}** member${members.size !== 1 ? 's' : ''}${members.size <= 25 ? `\n\n${memberLines.join('\n')}` : ''}`)
      .setFooter({ text: `Requested by ${executor.user.tag}` });

    if (members.size <= 25) {
      return isSlash
        ? slashSuccess(interaction, { embeds: [embed] })
        : prefixSuccess(message, { embeds: [embed] });
    }

    // More than 25 members -> send as .txt file
    const fileContent = [
      `Role: ${role.name} (${role.id})`,
      `Members: ${members.size}`,
      `Generated: ${new Date().toUTCString()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...memberLines,
    ].join('\n');

    const buffer = Buffer.from(fileContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, {
      name: `dump-${role.name.replace(/\s+/g, '-')}-${Date.now()}.txt`,
    });

    const replyOptions = { embeds: [embed], files: [attachment] };
    return isSlash
      ? slashSuccess(interaction, replyOptions)
      : prefixSuccess(message, replyOptions);
  },
};
