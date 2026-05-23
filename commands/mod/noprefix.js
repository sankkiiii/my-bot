const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} = require('discord.js');
const config = require('../../config');

const NOPREFIX_PATH = path.join(__dirname, '..', '..', 'data', 'noprefix.json');

function loadNoprefix() {
  try {
    return JSON.parse(fs.readFileSync(NOPREFIX_PATH, 'utf-8'));
  } catch {
    return { users: [] };
  }
}

function saveNoprefix(data) {
  fs.writeFileSync(NOPREFIX_PATH, JSON.stringify(data, null, 2));
}

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
            content: '\u274C You need the **Administrator** permission to manage no-prefix users.',
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
          return message.reply('\u274C You need the **Administrator** permission to manage no-prefix users.');
        }

        replyFn = (content) => message.reply(content);
        subcommand = (args[0] || '').toLowerCase();

        if (!['add', 'remove', 'list'].includes(subcommand)) {
          return replyFn('\u274C Usage: `!noprefix add @user` / `!noprefix remove @user` / `!noprefix list`');
        }

        if (subcommand === 'add' || subcommand === 'remove') {
          targetUser = message.mentions.users.first();
          if (!targetUser) {
            return replyFn('\u274C Please mention a user.');
          }
        }
      }

      const data = loadNoprefix();

      if (subcommand === 'add') {
        if (targetUser.bot) {
          return replyFn('\u274C You cannot give no-prefix to a bot.');
        }
        if (config.ownerId && targetUser.id === config.ownerId) {
          return replyFn('\u26A0\uFE0F The bot owner already has no-prefix access (hardcoded).');
        }
        if (data.users.includes(targetUser.id)) {
          return replyFn(`\u26A0\uFE0F ${targetUser} already has no-prefix access.`);
        }
        data.users.push(targetUser.id);
        saveNoprefix(data);
        return replyFn(`\u2705 ${targetUser} has been given no-prefix access.`);
      }

      if (subcommand === 'remove') {
        if (config.ownerId && targetUser.id === config.ownerId) {
          return replyFn('\u274C Cannot remove no-prefix from the bot owner (hardcoded).');
        }
        const index = data.users.indexOf(targetUser.id);
        if (index === -1) {
          return replyFn(`\u26A0\uFE0F ${targetUser} doesn't have no-prefix access.`);
        }
        data.users.splice(index, 1);
        saveNoprefix(data);
        return replyFn(`\u2705 No-prefix access removed from ${targetUser}.`);
      }

      if (subcommand === 'list') {
        const client = isSlash ? argsOrClient : clientOrUndefined;
        const embed = new EmbedBuilder()
          .setTitle('\u26A1 No-Prefix Users')
          .setColor(0x5865f2)
          .setTimestamp();

        let ownerLine = 'Not set';
        if (config.ownerId) {
          try {
            const owner = await client.users.fetch(config.ownerId);
            ownerLine = `${owner.tag} (${config.ownerId})`;
          } catch {
            ownerLine = `User ${config.ownerId}`;
          }
        }
        embed.addFields({ name: '\uD83D\uDC51 Owner', value: ownerLine });

        if (data.users.length === 0) {
          embed.addFields({ name: '\u26A1 No-Prefix Users', value: 'None' });
        } else {
          const lines = [];
          for (const userId of data.users) {
            try {
              const u = await client.users.fetch(userId);
              lines.push(`${u.tag} (${userId})`);
            } catch {
              lines.push(`User ${userId}`);
            }
          }
          embed.addFields({ name: '\u26A1 No-Prefix Users', value: lines.join('\n') });
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
