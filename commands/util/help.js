const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const { slashError, prefixError } = require('../../utils/replyHelper');
const { error } = require('../../utils/emoji');

const categories = {
  mod: {
    label: '🛡️ Moderation',
    color: '#ED4245',
    commands: [
      { name: 'ban',       alias: 'b, forceban',     desc: 'Ban a user from the server' },
      { name: 'kick',      alias: 'k, boot',         desc: 'Kick a user from the server' },
      { name: 'mute',      alias: 'm, timeout',      desc: 'Timeout a user' },
      { name: 'unmute',    alias: 'um, untimeout',   desc: 'Remove timeout from a user' },
      { name: 'warn',      alias: 'w, warning',      desc: 'Warn a user' },
      { name: 'purge',     alias: 'clear, clean',    desc: 'Delete bulk messages' },
      { name: 'nick',      alias: 'nickname',        desc: 'Change a user nickname' },
      { name: 'role',      alias: 'giverole, ar',    desc: 'Toggle a role on a user' },
      { name: 'drag',      alias: 'pull, move',      desc: 'Drag user to a voice channel' },
      { name: 'vckick',    alias: 'dvc, forcedc',    desc: 'Disconnect a user from VC' },
      { name: 'vckickall', alias: 'vcpurge, emptyvc',desc: 'Disconnect everyone from VC' },
      { name: 'dump',      alias: 'rolemembers, rd', desc: 'List all members with a role' },
      { name: 'noprefix',  alias: 'np, nopfx',       desc: 'Manage no-prefix users' },
      { name: 'owner',     alias: 'addowner',        desc: 'Manage bot owners' },
      { name: 'rpc',       alias: 'presence',        desc: 'Change bot rich presence' },
      { name: 'status',    alias: 'stats, botinfo',  desc: 'Show bot statistics' },
    ]
  },
  util: {
    label: '🔧 Utility',
    color: '#5865F2',
    commands: [
      { name: 'av',         alias: 'avatar, pfp',   desc: 'Show user avatar' },
      { name: 'banner',     alias: 'userbanner, ub',desc: 'Show user banner' },
      { name: 'sicon',      alias: 'servericon',    desc: 'Show server icon' },
      { name: 'sbanner',    alias: 'serverbanner',  desc: 'Show server banner' },
      { name: 'serverinfo', alias: 'si, server',    desc: 'Show server information' },
      { name: 'userinfo',   alias: 'ui, whois',     desc: 'Show user information' },
      { name: 'purgebots',  alias: 'pb, clearbots', desc: 'Delete bot messages in bulk' },
      { name: 'purgeuser',  alias: 'pu, clearuser', desc: 'Delete messages from a user' },
      { name: 'afk',        alias: 'away, brb',     desc: 'Set your AFK status' },
      { name: 'help',       alias: 'h, cmds',       desc: 'Show this help menu' },
    ]
  },
  tickets: {
    label: '🎫 Tickets',
    color: '#57F287',
    commands: [
      { name: 'panel', alias: 'tp, ticketpanel', desc: 'Send the ticket open panel' },
    ]
  },
  setup: {
    label: '⚙️ Setup',
    color: '#FEE75C',
    commands: [
      { name: 'setup',       alias: 'configure, botsetup', desc: 'Configure the bot for this server' },
      { name: 'config',      alias: 'cfg, settings',       desc: 'View current bot configuration' },
      { name: 'resetconfig', alias: 'resetcfg',            desc: 'Reset bot configuration' },
      { name: 'vcpanel',     alias: 'vcp, voicepanel',     desc: 'Send VC control panel in a channel' },
    ]
  },
  voice: {
    label: '🔊 Voice Controls',
    color: '#5865F2',
    description: 'These controls are available as **buttons** inside your temporary voice channel text chat.\nCreate a temp VC by joining the **➕ Create VC** or **➕ Create Duo** channel.',
    commands: [
      { name: 'Rename',   alias: 'Button', desc: 'Rename your voice channel' },
      { name: 'Limit',    alias: 'Button', desc: 'Set user limit (hub only)' },
      { name: 'Lock',     alias: 'Button', desc: 'Lock VC — no one new can join' },
      { name: 'Unlock',   alias: 'Button', desc: 'Unlock your voice channel' },
      { name: 'Hide',     alias: 'Button', desc: 'Hide VC from channel list' },
      { name: 'Unhide',   alias: 'Button', desc: 'Make VC visible again' },
      { name: 'Waiting',  alias: 'Button', desc: 'Users can see but not join' },
      { name: 'Trust',    alias: 'Button', desc: 'Allow a user to join even if locked' },
      { name: 'Reject',   alias: 'Button', desc: 'Remove and block a user from VC' },
      { name: 'Kick',     alias: 'Button', desc: 'Disconnect a user from VC' },
      { name: 'Ban',      alias: 'Button', desc: 'Permanently ban user from VC' },
      { name: 'Unban',    alias: 'Button', desc: 'Remove VC ban from a user' },
      { name: 'Claim',    alias: 'Button', desc: 'Claim VC when owner has left' },
      { name: 'Delete',   alias: 'Button', desc: 'Delete your voice channel' },
    ]
  }
};

function buildHelpMenu(client, prefix) {
  const totalCmds = Object.values(categories)
    .reduce((acc, cat) => acc + cat.commands.length, 0);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setAuthor({
      name: `${client.user.username} Help`,
      iconURL: client.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(
      'Welcome! Select a category from the dropdown below\n' +
      'to view all available commands.\n\n' +
      '🛡️ **Moderation** — Server moderation tools\n' +
      '🔧 **Utility** — Info and utility commands\n' +
      '🎫 **Tickets** — Ticket system commands\n' +
      '⚙️ **Setup** — Bot configuration commands\n' +
      '🔊 **Voice** — Voice channel controls'
    )
    .setFooter({
      text: `${totalCmds} commands • Prefix: ${prefix}`
    });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_select')
    .setPlaceholder('📚 Select a category...')
    .addOptions([
      { label: 'Moderation',     value: 'mod',     description: 'Ban, kick, mute, warn and more',  emoji: '🛡️' },
      { label: 'Utility',        value: 'util',    description: 'Avatar, userinfo, AFK and more',   emoji: '🔧' },
      { label: 'Tickets',        value: 'tickets', description: 'Ticket panel and system',          emoji: '🎫' },
      { label: 'Setup',          value: 'setup',   description: 'Configure the bot per server',     emoji: '⚙️' },
      { label: 'Voice Controls', value: 'voice',   description: 'VC control panel buttons',         emoji: '🔊' },
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embed, rows: [row] };
}

function buildCategoryEmbed(key, client, prefix, page = 0) {
  const cat = categories[key];
  if (!cat) return buildHelpMenu(client, prefix);

  const CMDS_PER_PAGE = 6;
  const totalPages = Math.ceil(cat.commands.length / CMDS_PER_PAGE);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  // Slice commands for this page
  const start = currentPage * CMDS_PER_PAGE;
  const pageCmds = cat.commands.slice(start, start + CMDS_PER_PAGE);

  // Build command list for this page
  const cmdList = pageCmds.map(cmd =>
    `\`${cmd.name}\` — ${cmd.desc}` +
    (cmd.alias && cmd.alias !== 'Button'
      ? `\n  *Aliases: \`${cmd.alias}\`*`
      : '')
  ).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(cat.color)
    .setAuthor({
      name: `${cat.label} — Commands`,
      iconURL: client.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(
      (cat.description ? cat.description + '\n\n' : '') +
      cmdList
    )
    .setFooter({
      text: totalPages > 1
        ? `Page ${currentPage + 1}/${totalPages} • ${cat.commands.length} commands • Prefix: ${prefix}`
        : `${cat.commands.length} commands • Prefix: ${prefix}`
    });

  // Build components
  const components = [];

  // Row 1: Select menu (always shown)
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_select')
    .setPlaceholder(`📚 Currently: ${cat.label}`)
    .addOptions([
      { label: 'Moderation',     value: 'mod',     description: 'Ban, kick, mute, warn and more',  emoji: '🛡️' },
      { label: 'Utility',        value: 'util',    description: 'Avatar, userinfo, AFK and more',   emoji: '🔧' },
      { label: 'Tickets',        value: 'tickets', description: 'Ticket panel and system',          emoji: '🎫' },
      { label: 'Setup',          value: 'setup',   description: 'Configure the bot per server',     emoji: '⚙️' },
      { label: 'Voice Controls', value: 'voice',   description: 'VC control panel buttons',         emoji: '🔊' },
    ]);
  components.push(new ActionRowBuilder().addComponents(selectMenu));

  // Row 2: Pagination buttons (only if more than 1 page)
  if (totalPages > 1) {
    const prevBtn = new ButtonBuilder()
      .setCustomId(`help_page_${key}_${currentPage - 1}`)
      .setLabel('← Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0);

    const pageBtn = new ButtonBuilder()
      .setCustomId('help_page_indicator')
      .setLabel(`${currentPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true); // indicator only

    const nextBtn = new ButtonBuilder()
      .setCustomId(`help_page_${key}_${currentPage + 1}`)
      .setLabel('Next →')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1);

    components.push(
      new ActionRowBuilder().addComponents(prevBtn, pageBtn, nextBtn)
    );
  }

  return { embed, rows: components };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all bot commands'),
  name: 'help',
  aliases: ['h', 'cmds', 'commands', 'menu'],
  categories,
  buildHelpMenu,
  buildCategoryEmbed,
  async execute(interaction, args, client) {
    const isSlash = !!interaction.isChatInputCommand?.();
    const message = isSlash ? null : interaction;
    const actualClient = isSlash ? args : client;
    const { prefix } = require('../../config');

    const remaining = cooldown.check('help',
      isSlash ? interaction.user.id : message.author.id,
      isSlash ? interaction.guild?.id : message.guild?.id,
      3000
    );
    if (remaining > 0) {
      const secs = (remaining / 1000).toFixed(1);
      const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
      return isSlash
        ? slashError(interaction, msg)
        : prefixError(message, msg);
    }

    const { embed, rows } = buildHelpMenu(actualClient, prefix);

    if (isSlash) {
      return interaction.reply({ embeds: [embed], components: rows });
    } else {
      return message.reply({ embeds: [embed], components: rows });
    }
  }
};
