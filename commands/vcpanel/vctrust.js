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
  name: 'vctrust',
  aliases: ['trustuser', 'allowuser'],
  data: new SlashCommandBuilder()
    .setName('vctrust')
    .setDescription('Allow a user to join your VC even if locked')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to trust')
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
    const { voiceChannel } = result;

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

    await voiceChannel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true
    });
    await interaction.reply({
      content: success(`**${member.displayName}** can now join your VC.`),
      ephemeral: true
    });
  }
};
