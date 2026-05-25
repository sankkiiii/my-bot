const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const e = require('../../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for going AFK')
        .setRequired(false)
        .setMaxLength(100),
    ),
  aliases: ['away', 'brb'],
  async execute(interactionOrMessage, argsOrClient, clientOrUndefined) {
    const isSlash = interactionOrMessage instanceof CommandInteraction;
    try {
      if (isSlash) {
        const interaction = interactionOrMessage;
        const guildId = interaction.guild?.id;
        if (!guildId) {
          return interaction.reply({
            content: 'This command only works in a server.',
            ephemeral: true,
          });
        }

        const userId = interaction.user.id;
        const member = interaction.member;
        const reason = interaction.options?.getString('reason') || 'AFK';

        let existing;
        try {
          existing = guildConfig.getAFK(guildId, userId);
        } catch (err) {
          console.error('[AFK Error]', err);
          return interaction.reply({
            content: `${e.error} Error: ${err.message}`,
            ephemeral: true,
          });
        }

        if (existing) {
          return interaction.reply({
            content: `${e.warning} You are already AFK with reason: **${existing.reason}**`,
            ephemeral: true,
          });
        }

        try {
          guildConfig.setAFK(guildId, userId, reason);
        } catch (err) {
          console.error('[AFK Error]', err);
          return interaction.reply({
            content: `${e.error} Error: ${err.message}`,
            ephemeral: true,
          });
        }

        await interaction.reply({
          content: `${e.afk} **${member.displayName}** is now AFK\n${e.reason} **Reason:** ${reason}`,
        });

        try {
          if (member && !member.displayName.startsWith('[AFK]')) {
            await member.setNickname(`[AFK] ${member.displayName}`.slice(0, 32));
          }
        } catch (err) {
          console.error('[AFK Nickname Error]', err);
        }
        return;
      }

      const message = interactionOrMessage;
      const args = argsOrClient || [];
      const guildId = message.guild?.id;
      if (!guildId) {
        return message.reply('This command only works in a server.');
      }

      const userId = message.author.id;
      const member = message.member;
      const reason = args.join(' ') || 'AFK';

      let existing;
      try {
        existing = guildConfig.getAFK(guildId, userId);
      } catch (err) {
        console.error('[AFK Error]', err);
        return message.reply(`${e.error} Error: ${err.message}`);
      }

      if (existing) {
        return message.reply(`${e.warning} You are already AFK with reason: **${existing.reason}**`);
      }

      try {
        guildConfig.setAFK(guildId, userId, reason);
      } catch (err) {
        console.error('[AFK Error]', err);
        return message.reply(`${e.error} Error: ${err.message}`);
      }

      await message.reply({
        content: `${e.afk} **${member.displayName}** is now AFK\n${e.reason} **Reason:** ${reason}`,
      });

      try {
        if (member && !member.displayName.startsWith('[AFK]')) {
          await member.setNickname(`[AFK] ${member.displayName}`.slice(0, 32));
        }
      } catch (err) {
        console.error('[AFK Nickname Error]', err);
      }
    } catch (err) {
      console.error('[AFK Command Error]', err);
      try {
        if (isSlash) {
          const interaction = interactionOrMessage;
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
              content: `${e.error} Error: ${err.message}`,
              ephemeral: true,
            });
          }
          return interaction.reply({
            content: `${e.error} Error: ${err.message}`,
            ephemeral: true,
          });
        }
        return interactionOrMessage.reply(`${e.error} Error: ${err.message}`);
      } catch (err) {
        console.error('[AFK Reply Error]', err);
      }
    }
  },
};
