const {
  SlashCommandBuilder,
  ChannelType,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const isOwner = require('../../utils/isOwner');
const { success, error } = require('../../utils/emoji');

async function creatorCheck(interaction) {
  const channel = interaction.channel;
  if (channel.type !== ChannelType.GuildVoice) {
    await interaction.reply({
      content: error('This command only works inside a voice channel text chat.'),
      ephemeral: true
    });
    return null;
  }

  const vcData = interaction.client.tempVCs.get(interaction.channelId);
  if (!vcData) {
    await interaction.reply({
      content: error('This is not a temporary voice channel.'),
      ephemeral: true
    });
    return null;
  }

  if (vcData.creatorId !== interaction.user.id) {
    await interaction.reply({
      content: error('Only the voice channel creator can use this.'),
      ephemeral: true
    });
    return null;
  }

  const voiceChannel = interaction.guild.channels.cache.get(interaction.channelId);
  if (!voiceChannel) {
    await interaction.reply({
      content: error('Voice channel not found.'),
      ephemeral: true
    });
    return null;
  }

  return { vcData, voiceChannel };
}

module.exports = {
  name: 'vctransfer',
  aliases: ['transfervc', 'givevc'],
  data: new SlashCommandBuilder()
    .setName('vctransfer')
    .setDescription('Transfer ownership of your VC to another user')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to transfer to (must be in VC)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Username or user ID')
        .setRequired(false)
    ),

  async execute(interaction) {
    const result = await creatorCheck(interaction);
    if (!result) return;
    const { vcData, voiceChannel } = result;

    const userOpt = interaction.options.getUser('user');
    const query = interaction.options.getString('query');
    let member;
    if (userOpt) {
      member = await interaction.guild.members.fetch(userOpt.id).catch(() => null);
    } else if (query) {
      member = await resolveUser(query, interaction.guild);
    }

    if (!member) {
      return interaction.reply({
        content: error('User not found.'),
        ephemeral: true
      });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({
        content: error('Cannot transfer to yourself.'),
        ephemeral: true
      });
    }

    if (member.user.bot) {
      return interaction.reply({
        content: error('Cannot transfer to a bot.'),
        ephemeral: true
      });
    }

    if (member.voice?.channelId !== interaction.channelId) {
      return interaction.reply({
        content: error('User must be in your VC.'),
        ephemeral: true
      });
    }

    const oldCreatorId = interaction.user.id;
    interaction.client.tempVCs.set(interaction.channelId, {
      ...vcData,
      creatorId: member.id
    });

    try {
      await voiceChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true, Connect: true,
        Speak: true, SendMessages: true,
        ManageChannels: true, MoveMembers: true
      });
      await voiceChannel.permissionOverwrites.edit(oldCreatorId, {
        ManageChannels: null, MoveMembers: null
      });
    } catch {}

    try {
      await voiceChannel.send(
        `🔄 **${member.displayName}** is now the owner.\n*(Transferred from <@${oldCreatorId}>)*`
      );
    } catch {}

    await interaction.reply({
      content: success(`Ownership transferred to **${member.displayName}**.`),
      ephemeral: true
    });
  }
};
