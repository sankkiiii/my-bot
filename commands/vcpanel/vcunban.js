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
  name: 'vcunban',
  aliases: ['unbanfromvc', 'vcunbanuser'],
  data: new SlashCommandBuilder()
    .setName('vcunban')
    .setDescription('Unban a user from your voice channel')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to unban')
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

    const existingOverwrite = voiceChannel.permissionOverwrites.cache.get(member.id);
    if (!existingOverwrite ||
        (!existingOverwrite.deny.has('ViewChannel') &&
         !existingOverwrite.deny.has('Connect'))) {
      return interaction.reply({
        content: error(`**${member.displayName}** is not banned from your VC.`),
        ephemeral: true
      });
    }

    await voiceChannel.permissionOverwrites.delete(member.id);
    await interaction.reply({
      content: success(`**${member.displayName}** has been unbanned.`),
      ephemeral: true
    });
  }
};
