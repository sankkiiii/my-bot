const emojis = require('../config/emojis');

// Get any emoji safely — returns '' if not set
function getEmoji(key) {
  const val = emojis[key];
  if (!val || val === '' || val.includes('EMOJI_ID_HERE')) return '';
  return val;
}

// Get success emoji — always returns something
// Falls back to ✅ if not set
function successEmoji() {
  const val = emojis.success;
  if (!val || val === '' || val.includes('EMOJI_ID_HERE')) return '✅';
  return val;
}

// Get error emoji — always returns something
// Falls back to ❌ if not set
function errorEmoji() {
  const val = emojis.error;
  if (!val || val === '' || val.includes('EMOJI_ID_HERE')) return '❌';
  return val;
}

// Build a line with optional emoji prefix
// If emoji not set → just return the text
function withEmoji(key, text) {
  const emoji = getEmoji(key);
  if (!emoji) return text;
  return `${emoji} ${text}`;
}

// Build success line
function success(text) {
  return `${successEmoji()} | ${text}`;
}

// Build error line
function error(text) {
  return `${errorEmoji()} ${text}`;
}

module.exports = {
  getEmoji,
  successEmoji,
  errorEmoji,
  withEmoji,
  success,
  error,
};
