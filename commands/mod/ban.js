const { SlashCommandBuilder, PermissionFlagsBits, CommandInteraction } = require('discord.js');
const config = require('../../config');
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
      let member, targetUser, reason, guild, executor, executorMember, replyFn;

      if (isSlash) {
        const interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.user;
        executorMember = interaction.member;
        replyFn = (content) => interaction.reply({ content, ephemeral: true });

        if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return interaction.reply({
            content: `${e.error} You need the **Ban Members** permission to use this command.`,
            ephemeral: true,
          });
        }

        const userOption = interaction.options.getUser('user');
        const query = interaction.options.getString('query');
        reason = interaction.options.getString('reason') || 'No reason provided';

        if (!userOption && !query) {
          return interaction.reply({
            content: `${e.error} Please provide a user (select or type username/ID).`,
            ephemeral: true,
          });
        }

        if (userOption) {
          member = await guild.members.fetch(userOption.id).catch(() => null);
          targetUser = userOption;
        } else {
          member = await resolveUser(query, guild);
          if (member) {
            targetUser = member.user;
          } else {
            // Try ID-only ban for users not in server
            const cleaned = query.replace(/[<@!>]/g, '').trim();
            if (/^\d{17,19}$/.test(cleaned)) {
              try {
                const user = await client.users.fetch(cleaned);
                await guild.members.ban(user, { reason });
                return replyFn(`**${user.username}** has been banned (not in server). Reason: ${reason}`);
              } catch {
                return replyFn(`${e.error} Could not find or ban that user.`);
              }
            }
            return replyFn(`${e.error} Could not find that user.`);
          }
        }
      } else {
        const message = interactionOrMessage;
        const args = argsOrClient;
        guild = message.guild;
        executor = message.author;
        executorMember = message.member;

        if (!isOwner && !message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return message.reply(`${e.error} You need the **Ban Members** permission to use this command.`);
        }

        if (!args[0]) return message.reply('Please provide a user to ban.');

        const input = args[0];
        member = await resolveUser(input, guild);
        reason = args.slice(1).join(' ') || 'No reason provided';
        replyFn = (content) => message.reply(content);

        if (!member) {
          // Try ID-only ban for users not in server
          const cleaned = input.replace(/[<@!>]/g, '').trim();
          if (/^\d{17,19}$/.test(cleaned)) {
            try {
              const user = await client.users.fetch(cleaned);
              await guild.members.ban(user, { reason });
              return replyFn(`**${user.username}** has been banned (not in server). Reason: ${reason}`);
            } catch {
              return replyFn(`${e.error} Could not find or ban that user.`);
            }
          }
          return replyFn(`${e.error} Could not find that user.`);
        }
        targetUser = member.user;
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return replyFn(`${e.error} I don't have the **Ban Members** permission to do this.`);
      }

      if (!isOwner && member.roles.highest.position >= executorMember.roles.highest.position) {
        return replyFn(`${e.error} You cannot moderate someone with an equal or higher role than you.`);
      }

      if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
        return replyFn(`${e.error} I cannot moderate this user as their role is higher than or equal to mine.`);
      }

      try {
        await targetUser.send(`You have been **banned** from **${guild.name}**.\n**Reason:** ${reason}`);
      } catch (_) { /* DMs may be disabled */ }

      await member.ban({ reason });

      await replyFn(`**${targetUser.username}** has been banned. Reason: ${reason}`);
    } catch (err) {
      console.error('[Ban]', err);
    }
  },
};
