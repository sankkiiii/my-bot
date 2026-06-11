const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const checkOwnerBypass = require('../../utils/isOwner');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
const { success, error, getEmoji, withEmoji } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drag')
    .setDescription('Drag a user to a voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to drag').setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target VC (leave empty to use your current VC)')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    ),

  name: 'drag',
  aliases: ['pull', 'move', 'summon'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    const bypassExecutorId = (typeof isSlash !== 'undefined' && isSlash) ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage && interactionOrMessage.author ? interactionOrMessage.author.id : (interactionOrMessage && interactionOrMessage.user ? interactionOrMessage.user.id : (typeof executorId !== 'undefined' ? executorId : (typeof executor !== 'undefined' ? executor.id : ''))));
    const ownerBypass = checkOwnerBypass(bypassExecutorId);

    try {
      let guild, executor, args, message, interaction;

      if (isSlash) {
        interaction = interactionOrMessage;
        guild = interaction.guild;
        executor = interaction.member;
        if (!guild) {
          return slashError(interaction, 'This command only works in a server.');
        }
      } else {
        message = interactionOrMessage;
        guild = message.guild;
        executor = message.member;
        args = message.content.slice(1).split(/\s+/).slice(1);
        if (!guild) {
          return prefixError(message, 'This command only works in a server.');
        }
      }

      if (!ownerBypass) {
    const remaining = cooldown.check(
        'drag',
        executor.id,
        guild.id,
        3000
      );
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
        if (isSlash) {
          return slashError(interaction, msg);
        }
    } else {
          return prefixError(message, msg);
        }
      }

      if (!executor.permissions.has(PermissionFlagsBits.MoveMembers)) {
        const errMsg = error(`You need **Move Members** permission.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      const botMember = guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
        const errMsg = error(`I need **Move Members** permission.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      // Get target member
      let target;
      if (!isSlash && message.reference) {
        try {
          const refMsg = await message.channel.messages.fetch(
            message.reference.messageId
          );
          if (refMsg && !refMsg.author.bot) {
            target = await guild.members.fetch(refMsg.author.id).catch(() => null);
          }
        } catch {}
      }

      if (!target) {
        if (isSlash) {
          const userOpt = interaction.options.getUser('user');
          target = await guild.members.fetch(userOpt.id).catch(() => null);
        } else {
          const input = message.mentions.members.first()?.id || args[0];
          if (input) {
            target = await resolveUser(input, guild);
          }
        }
      }

      if (!target) {
        const errMsg = error(`User not found.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      if (target.id === executor.id) {
        const errMsg = error(`You cannot drag yourself.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      if (!target.voice?.channel) {
        const errMsg = error(`**${target.displayName}** is not in a voice channel.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      // Get target VC
      let targetVC;
      if (isSlash) {
        targetVC =
          interaction.options.getChannel('channel') || executor.voice?.channel;
      } else {
        const chMention = message.mentions.channels.first();
        let vcArg;
        if (chMention) {
          vcArg = chMention;
        } else if (args[1]) {
          vcArg = guild.channels.cache.get(args[1]);
        }
        targetVC = vcArg || executor.voice?.channel;
      }

      if (!targetVC) {
        const errMsg = error(`Please specify a voice channel or join one first.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      if (targetVC.type !== ChannelType.GuildVoice) {
        const errMsg = error(`Target must be a voice channel.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      // Already in target VC
      if (target.voice.channelId === targetVC.id) {
        const errMsg = error(`**${target.displayName}** is already in ${targetVC.name}.`);
        return isSlash
          ? slashError(interaction, errMsg)
          : prefixError(message, errMsg);
      }

      // Move the user
      await target.voice.setChannel(
        targetVC,
        `Dragged by ${executor.user.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({
          name: target.user.username,
          iconURL: target.user.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(success(`Dragged **${target.displayName}** to **${targetVC.name}**`))
        .setFooter({ text: `Requested by ${executor.user.tag}` });

      if (isSlash) {
        return slashSuccess(interaction, { embeds: [embed] });
      } else {
        return prefixSuccess(message, { embeds: [embed] });
      }
    } catch (err) {
      console.error('[Drag]', err);
    }
  },
};
