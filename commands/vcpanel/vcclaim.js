const {
  SlashCommandBuilder,
  ChannelType,
} = require('discord.js');
const resolveUser = require('../../utils/resolveUser');
const isOwner = require('../../utils/isOwner');
const { success, error } = require('../../utils/emoji');

module.exports = {
  name: 'vcclaim',
  aliases: ['claimvc', 'takeover'],
  data: new SlashCommandBuilder()
    .setName('vcclaim')
    .setDescription('Claim ownership of this VC (when creator left)'),

  async execute(interaction) {
    const channel = interaction.channel;
    if (channel.type !== ChannelType.GuildVoice) {
      return interaction.reply({
        content: error('This command only works inside a voice channel text chat.'),
        ephemeral: true
      });
    }

    const vcData = interaction.client.tempVCs.get(interaction.channelId);
    if (!vcData) {
      return interaction.reply({
        content: error('This is not a temporary voice channel.'),
        ephemeral: true
      });
    }

    if (vcData.creatorId === interaction.user.id) {
      return interaction.reply({
        content: error('You are already the owner.'),
        ephemeral: true
      });
    }

    const voiceChannel = interaction.guild.channels.cache.get(interaction.channelId);
    const creatorStillInVC = voiceChannel?.members.has(vcData.creatorId);

    const isOwnerUser = isOwner(interaction.user.id);
    if (!isOwnerUser && creatorStillInVC) {
      return interaction.reply({
        content: error('Cannot claim while the owner is still in the VC.'),
        ephemeral: true
      });
    }

    const oldCreatorId = vcData.creatorId;
    interaction.client.tempVCs.set(interaction.channelId, {
      ...vcData,
      creatorId: interaction.user.id
    });

    try {
      await voiceChannel.permissionOverwrites.edit(
        interaction.user.id, {
          ViewChannel: true, Connect: true,
          Speak: true, SendMessages: true,
          ManageChannels: true, MoveMembers: true
        }
      );
      await voiceChannel.permissionOverwrites.edit(
        oldCreatorId, {
          ManageChannels: null, MoveMembers: null
        }
      );
    } catch {}

    try {
      await voiceChannel.send(
        `👑 **${interaction.member.displayName}** has claimed ownership.`
      );
    } catch {}

    await interaction.reply({
      content: success(`You are now the owner of **${voiceChannel.name}**!`),
      ephemeral: true
    });
  }
};
