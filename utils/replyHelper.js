const DELETE_DELAY = 3000;

module.exports = {
  async slashError(interaction, content) {
    try {
      return await interaction.reply({
        content,
        ephemeral: true,
      });
    } catch (err) {
      console.error('[ReplyHelper] slashError failed:', err);
    }
    return null;
  },

  async slashSuccess(interaction, options) {
    try {
      return await interaction.reply(options);
    } catch (err) {
      console.error('[ReplyHelper] slashSuccess failed:', err);
    }
    return null;
  },

  async prefixError(message, content) {
    try {
      const msg = await message.reply({ content });
      setTimeout(() => msg.delete().catch((err) => {
        console.error('[ReplyHelper] prefixError delete failed:', err);
      }), DELETE_DELAY);
      return msg;
    } catch (err) {
      console.error('[ReplyHelper] prefixError failed:', err);
    }
    return null;
  },

  async prefixSuccess(message, options) {
    try {
      return await message.reply(options);
    } catch (err) {
      console.error('[ReplyHelper] prefixSuccess failed:', err);
    }
    return null;
  },

  async deleteTrigger(message, delay = 0) {
    try {
      setTimeout(() => message.delete().catch((err) => {
        console.error('[ReplyHelper] deleteTrigger failed:', err);
      }), delay);
    } catch (err) {
      console.error('[ReplyHelper] deleteTrigger failed:', err);
    }
  },
};
