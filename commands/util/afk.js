const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const guildConfig = require('../../database/guildConfig');
const cooldown = require('../../utils/cooldown');
const {
  slashError,
  slashSuccess,
  prefixError,
  prefixSuccess,
} = require('../../utils/replyHelper');
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
          return slashError(interaction, 'This command only works in a server.');
        }

        const userId = interaction.user.id;
        const member = interaction.member;
        const reason = interaction.options?.getString('reason') || 'AFK';

        const remaining = cooldown.check('afk', interaction.user.id, interaction.guild.id, 3000);
        if (remaining > 0) {
          const secs = (remaining / 1000).toFixed(1);
          return slashError(interaction, `${e.warning} You are on cooldown. Try again in **${secs}s**.`);
        }

        let existing;
        try {
          existing = guildConfig.getAFK(guildId, userId);
        } catch (err) {
          console.error('[AFK Error]', err);
          return slashError(interaction, `${e.error} Error: ${err.message}`);
        }

        if (existing) {
          return slashError(interaction, `${e.warning} You are already AFK with reason: **${existing.reason}**`);
        }

        try {
          guildConfig.setAFK(guildId, userId, reason);
        } catch (err) {
          console.error('[AFK Error]', err);
          return slashError(interaction, `${e.error} Error: ${err.message}`);
        }

        await slashSuccess(interaction, {
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
        return prefixError(message, 'This command only works in a server.');
      }

      const userId = message.author.id;
      const member = message.member;
      const reason = args.join(' ') || 'AFK';

      const remaining = cooldown.check('afk', message.author.id, message.guild.id, 3000);
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        return prefixError(message, `${e.warning} You are on cooldown. Try again in **${secs}s**.`);
      }

      let existing;
      try {
        existing = guildConfig.getAFK(guildId, userId);
      } catch (err) {
        console.error('[AFK Error]', err);
        return prefixError(message, `${e.error} Error: ${err.message}`);
      }

      if (existing) {
        return prefixError(message, `${e.warning} You are already AFK with reason: **${existing.reason}**`);
      }

      try {
        guildConfig.setAFK(guildId, userId, reason);
      } catch (err) {
        console.error('[AFK Error]', err);
        return prefixError(message, `${e.error} Error: ${err.message}`);
      }

      await prefixSuccess(message, {
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
            return slashError(interaction, `${e.error} Error: ${err.message}`);
          }
          return slashError(interaction, `${e.error} Error: ${err.message}`);
        }
        return prefixError(interactionOrMessage, `${e.error} Error: ${err.message}`);
      } catch (err) {
        console.error('[AFK Reply Error]', err);
      }
    }
  },
};
