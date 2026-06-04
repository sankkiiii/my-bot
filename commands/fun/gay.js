const {
  SlashCommandBuilder,
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
const { error } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gay')
    .setDescription("Check someone's gay level")
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Username or user ID').setRequired(false)
    ),

  name: 'gay',
  aliases: ['gayrate', 'howgay', 'gaymeter'],

  async execute(interactionOrMessage, argsOrClient) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const guild = interactionOrMessage.guild;
    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;

    if (!guild) return;

    // Cooldown check (3s)
    const remaining = cooldown.check('gay', executorId, guild.id, 3000);
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
      return isSlash ? slashError(interactionOrMessage, msg) : prefixError(interactionOrMessage, msg);
    }

    let target;
    if (isSlash) {
      const userOpt = interactionOrMessage.options.getUser('user');
      const query = interactionOrMessage.options.getString('query');
      if (userOpt) {
        target = await guild.members.fetch(userOpt.id).catch(() => null);
      } else if (query) {
        target = await resolveUser(query, guild);
      } else {
        target = interactionOrMessage.member;
      }
    } else {
      const args = argsOrClient || [];
      const mentioned = interactionOrMessage.mentions.members.first();
      if (mentioned) {
        target = mentioned;
      } else if (args[0]) {
        target = await resolveUser(args[0], guild);
      } else {
        target = interactionOrMessage.member;
      }
    }

    if (!target && !isSlash && argsOrClient?.[0]) {
      return prefixError(interactionOrMessage, error('User not found.'));
    }
    if (!target) target = interactionOrMessage.member;

    // Gay Logic
    const percentage = Math.floor(Math.random() * 101);
    const flag = '🏳️‍🌈';
    const isSelf = target.id === executorId;

    let replyContent;
    if (isSelf) {
      replyContent = `**${target.displayName}**, you are the gayest for checking your own gay level.`;
    } else {
      replyContent = `**${target.displayName}** is **${percentage}% Gay** ${flag}`;
    }

    if (isSlash) {
      return interactionOrMessage.reply({ content: replyContent });
    } else {
      return interactionOrMessage.reply({ content: replyContent });
    }
  },
};
