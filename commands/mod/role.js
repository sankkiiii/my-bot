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
  const cleaned = input.replace(/[< @&>]/g, '').trim();

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
    .setDescription('Toggle a role on a user (add if missing, remove if present)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Select user from list')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Select role from list')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Username or user ID')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('roleinput')
        .setDescription('Role name or role ID')
        .setRequired(false)
    ),

  name: 'role',
  aliases: ['giverole', 'removerole', 'addrole', 'ar', 'rr', 'gr'],

  async execute(interactionOrMessage, argsOrClient) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const guild = interactionOrMessage.guild;
    if (!guild) return;

    const executor = interactionOrMessage.member;
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

    if (isSlash) {
      // Resolve User
      const userOpt = interactionOrMessage.options.getUser('user');
      const query = interactionOrMessage.options.getString('query');
      if (userOpt) {
        member = await guild.members.fetch(userOpt.id).catch(() => null);
      } else if (query) {
        member = await resolveUser(query, guild);
      }

      // Resolve Role
      const roleOpt = interactionOrMessage.options.getRole('role');
      const roleInput = interactionOrMessage.options.getString('roleinput');
      if (roleOpt) {
        role = roleOpt;
      } else if (roleInput) {
        role = resolveRole(roleInput, guild);
      }
    } else {
      const args = argsOrClient;
      if (!args || args.length < 1) {
        return prefixError(interactionOrMessage, `${e.error} Please provide a user and a role.`);
      }

      const mentioned = interactionOrMessage.mentions.members.first();
      let roleInputStr;

      if (mentioned) {
        member = mentioned;
        const mentionedRole = interactionOrMessage.mentions.roles.first();
        if (mentionedRole) {
          role = mentionedRole;
        } else {
          roleInputStr = args
            .filter(a => !a.includes(mentioned.id))
            .join(' ')
            .trim();
          role = resolveRole(roleInputStr, guild);
        }
      } else {
        member = await resolveUser(args[0], guild);
        roleInputStr = args.slice(1).join(' ').trim();
        const mentionedRole = interactionOrMessage.mentions.roles.first();
        role = mentionedRole || resolveRole(roleInputStr, guild);
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
    const hasRole = member.roles.cache.has(role.id);

    try {
      if (hasRole) {
        // REMOVE
        await member.roles.remove(role, `Toggled by ${executorTag}`);
        
        const embed = new EmbedBuilder()
          .setColor('#ED4245')
          .setAuthor({
            name: member.displayName,
            iconURL: member.user.displayAvatarURL({ dynamic: true })
          })
          .setDescription(`✅ | Removed ${role} from **${member.displayName}**`);

        return isSlash ? slashSuccess(interactionOrMessage, { embeds: [embed] }) : prefixSuccess(interactionOrMessage, { embeds: [embed] });
      } else {
        // ADD
        await member.roles.add(role, `Toggled by ${executorTag}`);

        const embed = new EmbedBuilder()
          .setColor(role.color || 0x57F287)
          .setAuthor({
            name: member.displayName,
            iconURL: member.user.displayAvatarURL({ dynamic: true })
          })
          .setDescription(`✅ | Added ${role} to **${member.displayName}**`);

        return isSlash ? slashSuccess(interactionOrMessage, { embeds: [embed] }) : prefixSuccess(interactionOrMessage, { embeds: [embed] });
      }
    } catch (err) {
      console.error('[Role Toggle Error]', err);
      const msg = `${e.error} Failed to update roles. Check my permissions.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }
  },
};
