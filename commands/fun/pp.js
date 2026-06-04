const {
  SlashCommandBuilder,
  EmbedBuilder,
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
    .setName('pp')
    .setDescription("Check someone's pp size")
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Username or user ID').setRequired(false)
    ),

  name: 'pp',
  aliases: ['dicksize', 'dick'],

  async execute(interactionOrMessage, argsOrClient) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const guild = interactionOrMessage.guild;
    const executorId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
    const executor = isSlash ? interactionOrMessage.member : interactionOrMessage.member;

    if (!guild) return;

    // Cooldown check (3s)
    const remaining = cooldown.check('pp', executorId, guild.id, 3000);
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

    // PP Logic
    const size = Math.floor(Math.random() * 21);
    const bar = size === 0 ? '8D' : '8' + '='.repeat(size) + 'D';

    let comment;
    if (size === 0)      comment = 'Magnifying glass needed 🔍';
    else if (size <= 3)  comment = "That's... something 😬";
    else if (size <= 6)  comment = 'Pretty average 😐';
    else if (size <= 10) comment = 'Not bad at all 😏';
    else if (size <= 14) comment = 'Impressive 👀';
    else if (size <= 18) comment = 'Absolutely massive 😱';
    else                 comment = 'LEGENDARY 🏆';

    const embed = new EmbedBuilder()
      .setColor('#EB459E')
      .setTitle(`${target.displayName}'s Dick size`)
      .setDescription(bar);

    if (target.id === executorId) {
      embed.setFooter({ text: 'Look in your pants and tell us if I am right.' });
    } else {
      embed.setFooter({ text: comment.replace(/\*/g, '') });
    }

    if (isSlash) {
      return slashSuccess(interactionOrMessage, { embeds: [embed] });
    } else {
      return prefixSuccess(interactionOrMessage, { embeds: [embed] });
    }
  },
};
