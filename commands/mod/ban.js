const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
  EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const resolveUser = require('../../utils/resolveUser');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((opt) => opt.setName('user').setDescription('Select user from list').setRequired(false))
    .addStringOption((opt) => opt.setName('query').setDescription('Or type username / user ID').setRequired(false))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  name: 'ban',
  aliases: ['forceban', 'hackban'],

  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const client = isSlash ? argsOrClient : clientOrUndefined;
    const isOwner = (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id) === config.ownerId;

    try {
      let member;
      let targetUser;
      let reason;
      let guild;
      let executor;
      let executorMember;
      let replyError;
      let replySuccess;

      if (isSlash) {
        const interaction = interactionOrMessage;
        if (!interaction.guild) {
          return interaction.reply({
            content: 'This command only works in a server.',
            ephemeral: true,
          });
        }
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        replyError = (content) => slashError(interaction, content);
        replySuccess = (payload) => slashSuccess(interaction, payload);

        const remaining = cooldown.check('ban', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return replyError(`${e.error} You need the **Ban Members** permission to use this command.`);
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');
        reason = interaction.options.getString('reason') || 'No reason provided';

        if (!userOption && !query) {
          return replyError(`${e.error} Please provide a user (select or type username/ID).`);
        }

        if (userOption) {
          member = await guild.members.fetch(userOption.id).catch(() => null);
          targetUser = userOption;
        } else {
          member = await resolveUser(query, guild);
          if (member) {
            targetUser = member.user;
          } else {
            const cleaned = query.replace(/[<@!>]/g, '').trim();
            if (/^\d{17,19}$/.test(cleaned)) {
              try {
                targetUser = await client.users.fetch(cleaned);
              } catch {
                return replyError(`${e.error} Could not find or ban that user.`);
              }
            } else {
              return replyError(`${e.error} Could not find that user.`);
            }
          }
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        if (!message.guild) {
          return message.reply('This command only works in a server.');
        }
        guild = message.guild;
        executor = message.author;
        executorMember = message.member;
        replyError = (content) => prefixError(message, content);
        replySuccess = (payload) => prefixSuccess(message, payload);

        const remaining = cooldown.check('ban', message.author.id, message.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return replyError(`${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return replyError(`${e.error} You need the **Ban Members** permission to use this command.`);
        }

        if (!args[0]) return replyError(`${e.error} Please provide a user to ban.`);

        const input = args[0];
        member = await resolveUser(input, guild);
        reason = args.slice(1).join(' ') || 'No reason provided';

        if (!member) {
          const cleaned = input.replace(/[<@!>]/g, '').trim();
          if (/^\d{17,19}$/.test(cleaned)) {
            try {
              targetUser = await client.users.fetch(cleaned);
            } catch {
              return replyError(`${e.error} Could not find or ban that user.`);
            }
          } else {
            return replyError(`${e.error} Could not find that user.`);
          }
        } else {
          targetUser = member.user;
        }
      }

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
        return replyError(`${e.error} I don't have the **Ban Members** permission to do this.`);
      }

      if (member) {
        if (!isOwner && member.roles.highest.position >= executorMember.roles.highest.position) {
          return replyError(`${e.error} You cannot moderate someone with an equal or higher role than you.`);
        }
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          return replyError(`${e.error} I cannot moderate this user as their role is higher than or equal to mine.`);
        }
      }

      try {
        await targetUser.send(`You have been **banned** from **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (err) {
        console.error('[Ban DM Error]', err);
      }

      if (member) {
        await member.ban({ reason });
      } else {
        await guild.members.ban(targetUser, { reason });
      }

      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(`🔨 | Banned **${targetUser.tag}**\n**Reason:** ${reason}`)
        .setFooter({ text: `Requested by ${executor.tag}` });

      await replySuccess({ embeds: [embed] });
    } catch (err) {
      console.error('[Ban]', err);
    }
  },
};
