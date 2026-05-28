const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  CommandInteraction,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccessTemp,
  prefixError,
  prefixSuccessTemp,
  deleteTrigger,
} = require('../../utils/replyHelper');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vckick')
    .setDescription('Disconnect a user from a voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to disconnect')
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('VC to kick from (leave empty for their current VC)')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    ),

  name: 'vckick',
  aliases: ['vcremove', 'disconnectuser', 'dvc', 'forcedc'],

  async execute(interactionOrMessage) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;

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

      const remaining = cooldown.check(
        'vckick',
        executor.id,
        guild.id,
        3000
      );
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        const msg = `${e.warning} You are on cooldown. Try again in **${secs}s**.`;
        return isSlash ? slashError(interaction, msg) : prefixError(message, msg);
      }

      if (!executor.permissions.has(PermissionFlagsBits.MoveMembers)) {
        const errMsg = `${e.error} You need **Move Members** permission.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
      }

      const botMember = guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
        const errMsg = `${e.error} I need **Move Members** permission.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
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
        const errMsg = `${e.error} User not found.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
      }

      if (target.id === executor.id) {
        const errMsg = `${e.error} You cannot kick yourself from VC.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
      }

      // Get VC to kick from
      let fromVC;
      if (isSlash) {
        fromVC =
          interaction.options.getChannel('channel') || target.voice?.channel;
      } else {
        const chMention = message.mentions.channels.first();
        let vcArg;
        if (chMention) {
          vcArg = chMention;
        } else if (args[1]) {
          vcArg = guild.channels.cache.get(args[1]);
        }
        fromVC = vcArg || target.voice?.channel;
      }

      if (!fromVC) {
        const errMsg = `${e.error} **${target.displayName}** is not in a voice channel.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
      }

      if (fromVC.type !== ChannelType.GuildVoice) {
        const errMsg = `${e.error} That is not a voice channel.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
      }

      // Check if user is actually in that VC
      if (target.voice?.channelId !== fromVC.id) {
        const errMsg = `${e.error} **${target.displayName}** is not in **${fromVC.name}**.`;
        return isSlash ? slashError(interaction, errMsg) : prefixError(message, errMsg);
      }

      // Disconnect trigger for prefix
      if (!isSlash) {
        await deleteTrigger(message, 0);
      }

      // Disconnect the user
      await target.voice.disconnect(
        `Kicked from VC by ${executor.user.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setAuthor({
          name: target.user.username,
          iconURL: target.user.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(`👢 | Disconnected **${target.displayName}** from **${fromVC.name}**`)
        .setFooter({ text: `Requested by ${executor.user.tag}` });

      if (isSlash) {
        return slashSuccessTemp(interaction, { embeds: [embed] });
      } else {
        return prefixSuccessTemp(message, { embeds: [embed] });
      }
    } catch (err) {
      console.error('[VCKick]', err);
    }
  },
};
