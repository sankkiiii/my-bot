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
  name: 'vclimit',
  aliases: ['vcuserlimit', 'setlimit'],
  data: new SlashCommandBuilder()
    .setName('vclimit')
    .setDescription('Set user limit for your voice channel')
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('User limit (0 = unlimited)')
        .setMinValue(0)
        .setMaxValue(99)
        .setRequired(true)
    ),

  async execute(interaction) {
    const result = await creatorCheck(interaction);
    if (!result) return;
    const { vcData, voiceChannel } = result;

    if (vcData.type === 'duo') {
      return interaction.reply({
        content: error('Duo VCs are locked to 2 users.'),
        ephemeral: true
      });
    }

    const limit = interaction.options.getInteger('limit');
    await voiceChannel.setUserLimit(limit);
    await interaction.reply({
      content: success(limit === 0
        ? 'User limit removed (unlimited).'
        : `User limit set to **${limit}**.`),
      ephemeral: true
    });
  }
};
