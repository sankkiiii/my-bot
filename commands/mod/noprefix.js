const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');
const resolveUser = require('../../utils/resolveUser');
const guildConfig = require('../../database/guildConfig');
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
      let guild, replyFn, subcommand, targetUser;

      const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: `${e.error} You need the **Administrator** permission to manage no-prefix users.`,
            ephemeral: true,
          });
        }

        replyFn = (content) => interaction.reply({ content, ephemeral: true });
        subcommand = interaction.options.getSubcommand();
        if (subcommand === 'add' || subcommand === 'remove') {
          targetUser = interaction.options.getUser('user');
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        const client = clientOrUndefined;
        guild = message.guild;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return message.reply(`${e.error} You need the **Administrator** permission to manage no-prefix users.`);
        }

        replyFn = (content) => message.reply(content);
        subcommand = (args[0] || '').toLowerCase();

        if (!['add', 'remove', 'list'].includes(subcommand)) {
          return replyFn(`${e.error} Usage: \`!noprefix add <user>\` / \`!noprefix remove <user>\` / \`!noprefix list\``);
        }

        if (subcommand === 'add' || subcommand === 'remove') {
          const userInput = args.slice(1).join(' ');
          if (!userInput) {
            return replyFn(`${e.error} Please provide a user (@mention, username, or ID).`);
          }
          const member = await resolveUser(userInput, guild);
          if (!member) {
            return replyFn(`${e.error} Could not find that user. Try @mention, username, or user ID.`);
          }
          targetUser = member.user;
        }
      }

      if (subcommand === 'add') {
        if (targetUser.bot) {
          return replyFn(`${e.error} You cannot give no-prefix to a bot.`);
        }
        if (config.ownerId && targetUser.id === config.ownerId) {
          return replyFn(`${e.warning} The bot owner already has no-prefix access (hardcoded).`);
        }
        if (guildConfig.isNoPrefixUser(guild.id, targetUser.id)) {
          return replyFn(`${e.warning} ${targetUser} already has no-prefix access.`);
        }
        const addedBy = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        guildConfig.addNoPrefixUser(guild.id, targetUser.id, addedBy);
        return replyFn(`${e.success} ${targetUser} has been given no-prefix access.`);
      }

      if (subcommand === 'remove') {
        if (config.ownerId && targetUser.id === config.ownerId) {
          return replyFn(`${e.error} Cannot remove no-prefix from the bot owner (hardcoded).`);
        }
        if (!guildConfig.isNoPrefixUser(guild.id, targetUser.id)) {
          return replyFn(`${e.warning} ${targetUser} doesn't have no-prefix access.`);
        }
        guildConfig.removeNoPrefixUser(guild.id, targetUser.id);
        return replyFn(`${e.success} No-prefix access removed from ${targetUser}.`);
      }

      if (subcommand === 'list') {
        const client = isSlash ? argsOrClient : clientOrUndefined;
        const users = guildConfig.getNoPrefixUsers(guild.id);
        const embed = new EmbedBuilder()
          .setTitle(`${e.noprefix} No-Prefix Users`)
          .setColor(0x5865f2)
          .setTimestamp();

        let ownerLine = 'Not set';
        if (config.ownerId) {
          try {
            const owner = await client.users.fetch(config.ownerId);
            ownerLine = `${owner.username} (${config.ownerId})`;
          } catch {
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
            } catch {
              lines.push(`User ${userId}`);
            }
          }
          embed.addFields({ name: `${e.noprefix} No-Prefix Users`, value: lines.join('\n') });
        }

        if (isSlash) {
          return interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
        }
        return interactionOrMessage.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[NoPrefix]', err);
    }
  },
};
