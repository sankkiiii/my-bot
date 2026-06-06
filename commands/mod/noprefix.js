const {
  SlashCommandBuilder,
  EmbedBuilder,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const checkOwnerBypass = require('../../utils/isOwner');
const guildConfig = require('../../database/guildConfig');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { success, error, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('noprefix')
    .setDescription('Manage no-prefix users')
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
  aliases: [],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const bypassExecutorId = (typeof isSlash !== 'undefined' && isSlash) ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage && interactionOrMessage.author ? interactionOrMessage.author.id : (interactionOrMessage && interactionOrMessage.user ? interactionOrMessage.user.id : (typeof executorId !== 'undefined' ? executorId : (typeof executor !== 'undefined' ? executor.id : ''))));
    const ownerBypass = checkOwnerBypass(bypassExecutorId);
    const client = isSlash ? interactionOrMessage.client : clientOrUndefined;
    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
    const guild = interactionOrMessage.guild;

    if (!guild) return;

    // Permission check: Only bot owners can manage no-prefix users
    if (!ownerBypass) {
      const msg = error('Only bot owners can manage no-prefix users.');
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    // Cooldown check (5s)
    if (!ownerBypass) {
    const remaining = cooldown.check('noprefix', executorId, guild.id, 5000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = withEmoji('warning', `You are on cooldown. Try again in **${secs}s**.`);
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }
    }

    const subcommand = isSlash ? interactionOrMessage.options.getSubcommand() : (argsOrClient[0] || '').toLowerCase();
    const replyError = (content) => isSlash ? slashError(interactionOrMessage, content) : prefixError(interactionOrMessage, content);
    const replySuccess = (opts) => isSlash ? slashSuccess(interactionOrMessage, opts) : prefixSuccess(interactionOrMessage, opts);

    if (subcommand === 'add' || subcommand === 'remove') {
      let targetUser;
      if (isSlash) {
        targetUser = interactionOrMessage.options.getUser('user');
      } else {
        const userInput = argsOrClient.slice(1).join(' ');
        if (!userInput) {
          return replyError(error('Please provide a user (@mention, username, or ID).'));
        }
        const member = await resolveUser(userInput, guild);
        if (!member) {
          return replyError(error('Could not find that user. Try @mention, username, or user ID.'));
        }
        targetUser = member.user;
      }

      if (subcommand === 'add') {
        if (targetUser.bot) {
          return replyError(error('You cannot give no-prefix to a bot.'));
        }
        if (guildConfig.isNoPrefixUser(guild.id, targetUser.id)) {
          return replyError(withEmoji('warning', 'That user already has no-prefix access.'));
        }
        guildConfig.addNoPrefixUser(guild.id, targetUser.id, executorId);
        return replySuccess({ content: success(`**${targetUser.username}** has been given no-prefix access.`) });
      }

      if (subcommand === 'remove') {
        if (!guildConfig.isNoPrefixUser(guild.id, targetUser.id)) {
          return replyError(withEmoji('warning', `${targetUser.tag} doesn't have no-prefix access.`));
        }
        guildConfig.removeNoPrefixUser(guild.id, targetUser.id);
        return replySuccess({ content: success(`No-prefix access removed from **${targetUser.username}**.`) });
      }
    }

    if (subcommand === 'list') {
      const npUsers = guildConfig.getNoPrefixUsers(guild.id);

      let description = '';

      if (npUsers.length > 0) {
        for (let i = 0; i < npUsers.length; i++) {
          const id = npUsers[i];
          const user = await client.users.fetch(id).catch(() => null);
          description += `${i + 1}. ${user ? user.tag : 'Unknown'} (\`${id}\`)\n`;
        }
      } else {
        description = 'No users have no-prefix access.';
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(withEmoji('noprefix', `**No-Prefix Users**\n\n${description}`));

      if (isSlash) {
        return replySuccess({ embeds: [embed], ephemeral: true });
      }
      return replySuccess({ embeds: [embed] });
    }

    if (!isSlash) {
      return replyError(error(`Usage: \`!noprefix add/remove/list <user>\``));
    }
  },
};
