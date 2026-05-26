const {
  SlashCommandBuilder,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const resolveUser = require('../../utils/resolveUser');
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
    .setName('owner')
    .setDescription('Manage bot owners')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a bot owner')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to add as owner').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Username or user ID').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a bot owner')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to remove from owners').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Username or user ID').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all bot owners')
    ),

  name: 'owner',
  aliases: ['addowner', 'botowner', 'owners'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
    const guild = interactionOrMessage.guild;

    if (!guild) return;

    // Permission check: Only bot owners can use this command
    if (!guildConfig.isOwner(executorId)) {
      const msg = `${e.error} Only bot owners can manage owners.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    // Cooldown check (3s)
    const remaining = cooldown.check('owner', executorId, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    const subcommand = isSlash ? interactionOrMessage.options.getSubcommand() : (argsOrClient[0] || '').toLowerCase();
    const replyError = (content) => isSlash ? slashError(interactionOrMessage, content) : prefixError(interactionOrMessage, content);
    const replySuccess = (opts) => isSlash ? slashSuccess(interactionOrMessage, opts) : prefixSuccess(interactionOrMessage, opts);

    if (subcommand === 'add' || subcommand === 'remove') {
      let targetUser;
      if (isSlash) {
        const userOpt = interactionOrMessage.options.getUser('user');
        const query = interactionOrMessage.options.getString('query');
        if (userOpt) {
          targetUser = userOpt;
        } else if (query) {
          const member = await resolveUser(query, guild);
          targetUser = member?.user || await client.users.fetch(query.replace(/[<@!>]/g, '')).catch(() => null);
        }
      } else {
        const input = argsOrClient.slice(1).join(' ');
        if (input) {
          const member = await resolveUser(input, guild);
          targetUser = member?.user || await client.users.fetch(input.replace(/[<@!>]/g, '')).catch(() => null);
        }
      }

      if (!targetUser) {
        return replyError(`${e.error} Please provide a valid user.`);
      }

      if (targetUser.bot) {
        return replyError(`${e.error} You cannot add a bot as an owner.`);
      }

      if (subcommand === 'add') {
        if (guildConfig.isOwner(targetUser.id)) {
          return replyError(`${e.warning} That user is already a bot owner.`);
        }
        guildConfig.addOwner(targetUser.id, executorId);
        return replySuccess({ content: `${e.success} **${targetUser.tag}** has been added as a bot owner.` });
      }

      if (subcommand === 'remove') {
        if (targetUser.id === executorId) {
          return replyError(`${e.error} You cannot remove yourself as owner.`);
        }
        if (!guildConfig.isOwner(targetUser.id)) {
          return replyError(`${e.warning} That user is not a bot owner.`);
        }
        guildConfig.removeOwner(targetUser.id);
        return replySuccess({ content: `${e.success} **${targetUser.tag}** has been removed from bot owners.` });
      }
    }

    if (subcommand === 'list') {
      const owners = guildConfig.getOwners();
      if (owners.length === 0) {
        return replySuccess({ content: 'No bot owners found.' });
      }

      const ownerLines = [];
      for (let i = 0; i < owners.length; i++) {
        const id = owners[i];
        const user = await client.users.fetch(id).catch(() => null);
        ownerLines.push(`${i + 1}. ${user ? user.tag : 'Unknown User'} (${id})`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`${e.ownerCrown} Bot Owners`)
        .setColor('#FEE75C')
        .setDescription(ownerLines.join('\n'))
        .setFooter({ text: `Total: ${owners.length} owner(s)` })
        .setTimestamp();

      return replySuccess({ embeds: [embed] });
    }

    if (!isSlash) {
      return replyError(`${e.error} Usage: \`!owner add/remove/list <user>\``);
    }
  },
};
