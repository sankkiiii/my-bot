const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

function resolveRole(input, guild) {
  if (!input) return null;
  const cleaned = input.replace(/[<@&>]/g, '').trim();

  // By ID
  if (/^\d{17,19}$/.test(cleaned)) {
    return guild.roles.cache.get(cleaned) || null;
  }

  // Exact name (case insensitive)
  const exact = guild.roles.cache.find(
    (r) => r.name.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;

  // Partial name
  const partial = guild.roles.cache.find((r) =>
    r.name.toLowerCase().includes(cleaned.toLowerCase())
  );
  return partial || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a role to a user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Select user from list').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Select role from list').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Username or user ID').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('roleinput').setDescription('Role name or role ID').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a role from a user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Select user from list').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Select role from list').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Username or user ID').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('roleinput').setDescription('Role name or role ID').setRequired(false)
        )
    ),

  name: 'role',
  aliases: ['giverole', 'removerole', 'addrole', 'ar', 'rr', 'gr'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const guild = interactionOrMessage.guild;
    if (!guild) return;

    const executor = isSlash ? interactionOrMessage.member : interactionOrMessage.member;
    const botMember = guild.members.me;

    // Cooldown check
    const remaining = cooldown.check('role', executor.id, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    // Permission checks
    if (!executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
      const msg = `${e.error} You need **Manage Roles** permission.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      const msg = `${e.error} I need **Manage Roles** permission.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    let member;
    let role;
    let isRemove = false;

    if (isSlash) {
      const subcommand = interactionOrMessage.options.getSubcommand();
      isRemove = subcommand === 'remove';

      // Resolve user
      const userOpt = interactionOrMessage.options.getUser('user');
      const query = interactionOrMessage.options.getString('query');
      if (userOpt) {
        member = await guild.members.fetch(userOpt.id).catch(() => null);
      } else if (query) {
        member = await resolveUser(query, guild);
      }

      // Resolve role
      const roleOpt = interactionOrMessage.options.getRole('role');
      const roleInput = interactionOrMessage.options.getString('roleinput');
      if (roleOpt) {
        role = roleOpt;
      } else if (roleInput) {
        role = resolveRole(roleInput, guild);
      }
    } else {
      const args = argsOrClient;
      let workingArgs = [...args];

      // Prefix Mode Detection
      if (workingArgs[0] === 'remove' || workingArgs[0] === 'rm') {
        isRemove = true;
        workingArgs = workingArgs.slice(1);
      } else if (workingArgs.includes('remove') || workingArgs.includes('rm')) {
        // Check if keyword exists after mention or elsewhere
        const idx = workingArgs.findIndex((a) => a === 'remove' || a === 'rm');
        if (idx !== -1) {
          isRemove = true;
          workingArgs.splice(idx, 1);
        }
      }

      // Resolve user
      if (interactionOrMessage.mentions.members.first()) {
        member = interactionOrMessage.mentions.members.first();
        workingArgs = workingArgs.filter((a) => !a.includes(member.id));
      } else if (workingArgs[0]) {
        member = await resolveUser(workingArgs[0], guild);
        workingArgs = workingArgs.slice(1);
      }

      // Resolve role
      if (interactionOrMessage.mentions.roles.first()) {
        role = interactionOrMessage.mentions.roles.first();
      } else if (workingArgs.length > 0) {
        role = resolveRole(workingArgs.join(' '), guild);
      }
    }

    if (!member) {
      const msg = `${e.error} User not found.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    if (!role) {
      const msg = `${e.error} Role not found.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    // Hierarchy Checks
    if (role.id === guild.id) {
      const msg = `${e.error} Cannot assign the @everyone role.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    if (role.managed) {
      const msg = `${e.error} That role is managed by an integration and cannot be assigned.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    if (role.position >= executor.roles.highest.position) {
      const msg = `${e.error} You cannot assign a role equal to or higher than your highest role.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    if (role.position >= botMember.roles.highest.position) {
      const msg = `${e.error} I cannot assign a role equal to or higher than my highest role.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    const executorTag = isSlash ? interactionOrMessage.user.tag : interactionOrMessage.author.tag;

    try {
      if (isRemove) {
        if (!member.roles.cache.has(role.id)) {
          const msg = `${e.warning} **${member.displayName}** does not have the **${role.name}** role.`;
          return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
        }

        await member.roles.remove(role, `Removed by ${executorTag}`);

        const embed = new EmbedBuilder()
          .setColor('#ED4245')
          .setAuthor({
            name: `Role Removed — ${member.displayName}`,
            iconURL: member.user.displayAvatarURL({ dynamic: true }),
          })
          .addFields(
            { name: `${e.user} User`, value: `${member}`, inline: true },
            { name: `${e.role} Role`, value: `${role}`, inline: true },
            { name: `${e.user} By`, value: `${executor}`, inline: true }
          )
          .setFooter({ text: executorTag })
          .setTimestamp();

        return isSlash ? slashSuccess(interactionOrMessage, { embeds: [embed] }) : prefixSuccess(interactionOrMessage, { embeds: [embed] });
      } else {
        if (member.roles.cache.has(role.id)) {
          const msg = `${e.warning} **${member.displayName}** already has the **${role.name}** role.`;
          return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
        }

        await member.roles.add(role, `Added by ${executorTag}`);

        const embed = new EmbedBuilder()
          .setColor(role.color || 0x57F287)
          .setAuthor({
            name: `Role Added — ${member.displayName}`,
            iconURL: member.user.displayAvatarURL({ dynamic: true }),
          })
          .addFields(
            { name: `${e.user} User`, value: `${member}`, inline: true },
            { name: `${e.role} Role`, value: `${role}`, inline: true },
            { name: `${e.user} By`, value: `${executor}`, inline: true }
          )
          .setFooter({ text: executorTag })
          .setTimestamp();

        return isSlash ? slashSuccess(interactionOrMessage, { embeds: [embed] }) : prefixSuccess(interactionOrMessage, { embeds: [embed] });
      }
    } catch (err) {
      console.error('[Role Command]', err);
      const msg = `${e.error} Failed to update roles. Check my permissions.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }
  },
};
