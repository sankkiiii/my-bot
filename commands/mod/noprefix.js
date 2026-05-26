const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');
const guildConfig = require('../../database/guildConfig');
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
    .setName('noprefix')
    .setDescription('Manage no-prefix users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Give a user no-prefix access')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to add').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove no-prefix access from a user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to remove').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all no-prefix users'),
    ),

  name: 'noprefix',
  aliases: ['np'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

    try {
      let guild;
      let replyError;
      let replySuccess;
      let subcommand;
      let targetUser;

      const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }

        const remaining = cooldown.check('noprefix', interaction.user.id, interaction.guild.id, 5000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return slashError(interaction, `${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return slashError(interaction, `${e.error} You need the **Administrator** permission to manage no-prefix users.`);
        }

        replyError = (content) => slashError(interaction, content);
        replySuccess = (payload) => slashSuccess(interaction, payload);
        subcommand = interaction.options.getSubcommand();
        if (subcommand === 'add' || subcommand === 'remove') {
          targetUser = interaction.options.getUser('user');
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient || [];
        guild = message.guild;
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }

        const remaining = cooldown.check('noprefix', message.author.id, message.guild.id, 5000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return prefixError(message, `${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return prefixError(message, `${e.error} You need the **Administrator** permission to manage no-prefix users.`);
        }

        replyError = (content) => prefixError(message, content);
        replySuccess = (payload) => prefixSuccess(message, payload);
        subcommand = (args[0] || '').toLowerCase();

        if (!['add', 'remove', 'list'].includes(subcommand)) {
          return replyError(`${e.error} Usage: \`!noprefix add <user>\` / \`!noprefix remove <user>\` / \`!noprefix list\``);
        }

        if (subcommand === 'add' || subcommand === 'remove') {
          const userInput = args.slice(1).join(' ');
          if (!userInput) {
            return replyError(`${e.error} Please provide a user (@mention, username, or ID).`);
          }
          const member = await resolveUser(userInput, guild);
          if (!member) {
            return replyError(`${e.error} Could not find that user. Try @mention, username, or user ID.`);
          }
          targetUser = member.user;
        }
      }

      if (subcommand === 'add') {
        if (targetUser.bot) {
          return replyError(`${e.error} You cannot give no-prefix to a bot.`);
        }
        if (config.ownerId && targetUser.id === config.ownerId) {
          return replyError(`${e.warning} The bot owner already has no-prefix access (hardcoded).`);
        }
        let exists = false;
        try {
          exists = guildConfig.isNoPrefixUser(guild.id, targetUser.id);
        } catch (err) {
          console.error('[NoPrefix]', err);
          return replyError(`${e.error} Error: ${err.message}`);
        }
        if (exists) {
          return replyError(`${e.warning} ${targetUser} already has no-prefix access.`);
        }
        const addedBy = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        try {
          guildConfig.addNoPrefixUser(guild.id, targetUser.id, addedBy);
        } catch (err) {
          console.error('[NoPrefix]', err);
          return replyError(`${e.error} Error: ${err.message}`);
        }
        return replySuccess({ content: `${e.success} ${targetUser} has been given no-prefix access.` });
      }

      if (subcommand === 'remove') {
        if (config.ownerId && targetUser.id === config.ownerId) {
          return replyError(`${e.error} Cannot remove no-prefix from the bot owner (hardcoded).`);
        }
        let exists = false;
        try {
          exists = guildConfig.isNoPrefixUser(guild.id, targetUser.id);
        } catch (err) {
          console.error('[NoPrefix]', err);
          return replyError(`${e.error} Error: ${err.message}`);
        }
        if (!exists) {
          return replyError(`${e.warning} ${targetUser} doesn't have no-prefix access.`);
        }
        try {
          guildConfig.removeNoPrefixUser(guild.id, targetUser.id);
        } catch (err) {
          console.error('[NoPrefix]', err);
          return replyError(`${e.error} Error: ${err.message}`);
        }
        return replySuccess({ content: `${e.success} No-prefix access removed from ${targetUser}.` });
      }

      if (subcommand === 'list') {
        const client = isSlash ? argsOrClient : clientOrUndefined;
        let users = [];
        try {
          users = guildConfig.getNoPrefixUsers(guild.id);
        } catch (err) {
          console.error('[NoPrefix]', err);
          return replyError(`${e.error} Error: ${err.message}`);
        }

        const embed = new EmbedBuilder()
          .setTitle(`${e.noprefix} No-Prefix Users`)
          .setColor(0x5865f2)
          .setTimestamp();

        let ownerLine = 'Not set';
        if (config.ownerId) {
          try {
            const owner = await client.users.fetch(config.ownerId);
            ownerLine = `${owner.username} (${config.ownerId})`;
          } catch (err) {
            console.error('[NoPrefix]', err);
            ownerLine = `User ${config.ownerId}`;
          }
        }
        embed.addFields({ name: `${e.owner} Owner`, value: ownerLine });

        if (users.length === 0) {
          embed.addFields({ name: `${e.noprefix} No-Prefix Users`, value: 'None' });
        } else {
          const lines = [];
          for (const userId of users) {
            try {
              const u = await client.users.fetch(userId);
              lines.push(`${u.username} (${userId})`);
            } catch (err) {
              console.error('[NoPrefix]', err);
              lines.push(`User ${userId}`);
            }
          }
          embed.addFields({ name: `${e.noprefix} No-Prefix Users`, value: lines.join('\n') });
        }

        if (isSlash) {
          return replySuccess({ embeds: [embed], ephemeral: true });
        }
        return replySuccess({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[NoPrefix]', err);
    }
  },
};
