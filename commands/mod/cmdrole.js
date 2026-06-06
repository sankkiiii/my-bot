const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { success, error, withEmoji } = require('../../utils/emoji');

function resolveRole(input, guild) {
  if (!input) return null;
  const cleaned = input.replace(/[< @&>]/g, '').trim();

  // By ID (17-19 digit snowflake)
  if (/^\d{17,19}$/.test(cleaned)) {
    return guild.roles.cache.get(cleaned) || null;
  }

  // Exact name match (case insensitive)
  const exact = guild.roles.cache.find(r =>
    r.name.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;

  // Partial name match
  const partial = guild.roles.cache.find(r =>
    r.name.toLowerCase().includes(cleaned.toLowerCase())
  );
  return partial || null;
}

const roleNotFoundError = error(
  "Role not found. Try:\n" +
  "• Role ID: `123456789012345678`\n" +
  "• Role mention: `<@&roleid>`\n" +
  "• Role name: `Admin`"
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cmdrole')
    .setDescription('Restrict commands to specific roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a role that can use a command')
        .addStringOption(opt =>
          opt.setName('command')
            .setDescription('Command to restrict')
            .setRequired(true)
            .addChoices(
              { name: 'av (avatar)', value: 'av' },
            )
        )
        .addStringOption(opt =>
          opt.setName('role')
            .setDescription('Role mention, role name or role ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from a command')
        .addStringOption(opt =>
          opt.setName('command')
            .setDescription('Command name')
            .setRequired(true)
            .addChoices(
              { name: 'av (avatar)', value: 'av' },
            )
        )
        .addStringOption(opt =>
          opt.setName('role')
            .setDescription('Role mention, role name or role ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List allowed roles for a command')
        .addStringOption(opt =>
          opt.setName('command')
            .setDescription('Command name')
            .setRequired(true)
            .addChoices(
              { name: 'av (avatar)', value: 'av' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Remove all role restrictions from a command (everyone can use it)')
        .addStringOption(opt =>
          opt.setName('command')
            .setDescription('Command name')
            .setRequired(true)
            .addChoices(
              { name: 'av (avatar)', value: 'av' },
            )
        )
    ),

  name: 'cmdrole',
  aliases: ['addavrole', 'commandrole', 'restrictrole', 'crole'],

  async execute(interactionOrMessage, argsOrClient) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const guild = interactionOrMessage.guild;
    if (!guild) return;

    const executor = interactionOrMessage.member;
    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;

    // Cooldown check
    const remaining = cooldown.check('cmdrole', executorId, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`);
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    // Permission Check
    const isOwner = guildConfig.isOwner(executorId);
    const isAdmin = executor.permissions.has(PermissionFlagsBits.Administrator);
    if (!isOwner && !isAdmin) {
      const msg = error('You need **Administrator** permission or be a bot owner.');
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    const replyError = (content) => isSlash ? slashError(interactionOrMessage, content) : prefixError(interactionOrMessage, content);
    const replySuccess = (opts) => isSlash ? slashSuccess(interactionOrMessage, opts) : prefixSuccess(interactionOrMessage, opts);

    let subcommand;
    let cmdName;
    let role;

    if (isSlash) {
      subcommand = interactionOrMessage.options.getSubcommand();
      cmdName = interactionOrMessage.options.getString('command');
      
      if (subcommand === 'add' || subcommand === 'remove') {
        const roleInput = interactionOrMessage.options.getString('role');
        role = resolveRole(roleInput, guild);
        if (!role) {
          return replyError(roleNotFoundError);
        }
      }
    } else {
      const args = argsOrClient;
      if (!args || args.length < 1) {
        return replyError(error('Please provide a subcommand (add, remove, list, clear).'));
      }
      subcommand = args[0].toLowerCase();
      cmdName = args[1]?.toLowerCase();
      
      const validSubcommands = ['add', 'remove', 'list', 'clear'];
      if (!validSubcommands.includes(subcommand)) {
        return replyError(error(`Invalid subcommand. Valid options: ${validSubcommands.join(', ')}`));
      }

      if (!cmdName) {
        return replyError(error('Please provide a command name (e.g., `av`).'));
      }

      const validCommands = ['av'];
      if (!validCommands.includes(cmdName)) {
        return replyError(error(`Invalid command. Valid options: ${validCommands.join(', ')}`));
      }

      if (subcommand === 'add' || subcommand === 'remove') {
        const roleInput = interactionOrMessage.mentions.roles.first()
          ? interactionOrMessage.mentions.roles.first().id
          : args.slice(2).join(' ');

        role = interactionOrMessage.mentions.roles.first()
          || resolveRole(roleInput, guild);

        if (!role) {
          return replyError(roleNotFoundError);
        }
      }
    }

    const guildId = guild.id;

    if (subcommand === 'add') {
      const existing = guildConfig.getCommandRoles(guildId, cmdName);
      if (existing.includes(role.id)) {
        return replyError(error(`**${role.name}** can already use \`${cmdName}\`.`));
      }
      guildConfig.addCommandRole(guildId, cmdName, role.id, executorId);
      return replySuccess({
        content: success(`**${role.name}** can now use \`${cmdName}\`.`)
      });
    }

    if (subcommand === 'remove') {
      const existing = guildConfig.getCommandRoles(guildId, cmdName);
      if (!existing.includes(role.id)) {
        return replyError(error(`**${role.name}** is not in the allowed list for \`${cmdName}\`.`));
      }
      guildConfig.removeCommandRole(guildId, cmdName, role.id);
      return replySuccess({
        content: success(`**${role.name}** can no longer use \`${cmdName}\`.`)
      });
    }

    if (subcommand === 'list') {
      const roles = guildConfig.getCommandRoles(guildId, cmdName);
      if (roles.length === 0) {
        return replySuccess({
          content: `📋 No role restrictions for \`${cmdName}\` — everyone can use it.`
        });
      }
      const roleList = roles.map((id, i) => {
        const r = guild.roles.cache.get(id);
        return `${i + 1}. ${r ? r.toString() : `Unknown Role (${id})`}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: `Allowed Roles — ${cmdName}` })
        .setDescription(roleList)
        .setFooter({ text: `${roles.length} role(s) • Only these roles can use /${cmdName}` });

      return replySuccess({ embeds: [embed] });
    }

    if (subcommand === 'clear') {
      const existing = guildConfig.getCommandRoles(guildId, cmdName);
      if (existing.length === 0) {
        return replyError(error(`No restrictions found for \`${cmdName}\`.`));
      }
      // Delete all roles for this command
      existing.forEach(roleId => {
        guildConfig.removeCommandRole(guildId, cmdName, roleId);
      });
      return replySuccess({
        content: success(`All role restrictions cleared for \`${cmdName}\`. Everyone can now use it.`)
      });
    }
  },
};
