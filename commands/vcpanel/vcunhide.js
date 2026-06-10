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
  name: 'vcunhide',
  aliases: ['unhidevc', 'unhidevoice'],
  data: new SlashCommandBuilder()
    .setName('vcunhide')
    .setDescription('Make your voice channel visible'),

  async execute(interaction) {
    const result = await creatorCheck(interaction);
    if (!result) return;
    const { voiceChannel } = result;
    await voiceChannel.permissionOverwrites.edit(
      interaction.guild.id, { ViewChannel: null }
    );
    await interaction.reply({
      content: success('Voice channel is now visible.'),
      ephemeral: true
    });
  }
};
