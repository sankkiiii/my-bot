const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const cooldown = require('../../utils/cooldown');
const checkOwnerBypass = require('../../utils/isOwner');
const { slashError, prefixError } = require('../../utils/replyHelper');
const { error } = require('../../utils/emoji');

const categories = {
  mod: {
    label: '🛡️ Moderation',
    color: '#FEE75C',
    commands: [
      { name: 'ban',       alias: 'forceban, hackban',     desc: 'Ban a user from the server' },
      { name: 'kick',      alias: 'boot, remove',          desc: 'Kick a user from the server' },
      { name: 'mute',      alias: 'timeout, silence, shut',desc: 'Timeout a user' },
      { name: 'unmute',    alias: 'untimeout, unsilence',  desc: 'Remove timeout from a user' },
      { name: 'warn',      alias: 'warning, caution',      desc: 'Warn a user' },
      { name: 'purge',     alias: 'clear, clean, prune',   desc: 'Delete messages. Use: purge img / gif / video / link / attach' },
      { name: 'purgemedia',alias: 'purgeimg, purgeimages', desc: 'Delete messages containing media/images/videos' },
      { name: 'nick',      alias: 'nickname, setnick',     desc: 'Change a user nickname' },
      { name: 'role',      alias: 'giverole, addrole',     desc: 'Toggle a role on a user' },
      { name: 'drag',      alias: 'pull, move',            desc: 'Drag user to a voice channel' },
      { name: 'vckick',    alias: 'vcremove, forcedc',     desc: 'Disconnect a user from VC' },
      { name: 'vckickall', alias: 'vcpurge, emptyvc',     desc: 'Disconnect everyone from VC' },
      { name: 'dump',      alias: 'rolemembers, rolelist', desc: 'List all members with a role' },
      { name: 'cmdrole',   alias: 'crole, restrictrole',   desc: 'Restrict commands to roles' },
      { name: 'rpc',       alias: 'presence',              desc: 'Set bot status/activity' },
      { name: 'status',    alias: 'botstatus',             desc: 'Change bot online status' },
      { name: 'noprefix',  alias: 'np',                    desc: 'Manage no-prefix users' },
    ]
  },
  util: {
    label: '🔧 Utility',
    color: '#57F287',
    commands: [
      { name: 'av',         alias: 'avatar, pfp',           desc: 'Show user avatar' },
      { name: 'banner',     alias: 'userbanner, profilebanner', desc: 'Show user banner' },
      { name: 'sicon',      alias: 'servericon, srvicon',   desc: 'Show server icon' },
      { name: 'sbanner',    alias: 'serverbanner, guildbanner', desc: 'Show server banner' },
      { name: 'serverinfo', alias: 'server, guildinfo',     desc: 'Show server information' },
      { name: 'userinfo',   alias: 'whois, lookup',         desc: 'Show user information' },
      { name: 'purgebots',  alias: 'clearbots, delbots',    desc: 'Delete bot messages' },
      { name: 'purgeuser',  alias: 'clearuser, deluser',    desc: 'Delete user messages' },
      { name: 'afk',        alias: 'away, brb',             desc: 'Set your AFK status' },
      { name: 'help',       alias: 'cmds, commands',        desc: 'Show this help menu' },
      { name: 'vcpanel',    alias: 'vcp',                   desc: 'Show VC control panel' },
    ]
  },
  setup: {
    label: '⚙️ Setup',
    color: '#95A5A6',
    commands: [
      { name: 'setup',       alias: 'start',      desc: 'Run initial bot setup' },
      { name: 'config',      alias: 'settings',   desc: 'View/edit server config' },
      { name: 'resetconfig', alias: 'reset',      desc: 'Reset server configuration' },
    ]
  },
  fun: {
    label: '🎉 Fun',
    color: '#EB459E',
    commands: [
      { name: 'pp',  alias: 'dicksize, ppsize', desc: "Check someone's PP size" },
      { name: 'gay', alias: 'gayrate, howgay',  desc: "Check someone's gay level" },
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
      '⚙️ **Setup** — Bot and server setup\n' +
      '🎉 **Fun** — Fun and games commands\n' +
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
      { label: 'Setup',          value: 'setup',   description: 'Bot setup and configuration',     emoji: '⚙️' },
      { label: 'Fun',            value: 'fun',     description: 'Fun and games commands',          emoji: '🎉' },
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

  const start = currentPage * CMDS_PER_PAGE;
  const pageCmds = cat.commands.slice(start, start + CMDS_PER_PAGE);

  const cmdList = pageCmds.map(cmd =>
    `\`${cmd.name}\` — ${cmd.desc}` +
    (cmd.alias && cmd.alias !== 'Button'
      ? `\n-# *${cmd.alias}*`
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

  const components = [];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_select')
    .setPlaceholder(`📚 Currently: ${cat.label}`)
    .addOptions([
      { label: 'Moderation',     value: 'mod',     description: 'Ban, kick, mute, warn and more',  emoji: '🛡️' },
      { label: 'Utility',        value: 'util',    description: 'Avatar, userinfo, AFK and more',   emoji: '🔧' },
      { label: 'Setup',          value: 'setup',   description: 'Bot setup and configuration',     emoji: '⚙️' },
      { label: 'Fun',            value: 'fun',     description: 'Fun and games commands',          emoji: '🎉' },
      { label: 'Voice Controls', value: 'voice',   description: 'VC control panel buttons',         emoji: '🔊' },
    ]);
  components.push(new ActionRowBuilder().addComponents(selectMenu));

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
      .setDisabled(true);

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
  aliases: ['cmds', 'commands', 'menu'],
  categories,
  buildHelpMenu,
  buildCategoryEmbed,
  async execute(interaction, args, client) {
    const isSlash = !!interaction.isChatInputCommand?.();
    const executorId = isSlash ? interaction.user.id : interaction.author.id;
    
    const checkOwnerBypassFunc = require('../../utils/isOwner');
    const ownerBypass = checkOwnerBypassFunc(executorId);
    
    const message = isSlash ? null : interaction;
    const actualClient = isSlash ? args : client;
    const { prefix } = require('../../config');

    if (!ownerBypass) {
      const remaining = cooldown.check('help',
        executorId,
        interaction.guild?.id,
        3000
      );
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        const msg = error(`You are on cooldown. Try again in **${secs}s**.`);
        return isSlash
          ? slashError(interaction, msg)
          : prefixError(message, msg);
      }
    }

    const { embed, rows } = buildHelpMenu(actualClient, prefix);

    if (isSlash) {
      const sentMsg = await interaction.reply({ embeds: [embed], components: rows, fetchReply: true });

      // Auto-disable after 5 minutes
      setTimeout(async () => {
        try {
          const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId('help_select_disabled')
            .setPlaceholder('⏰ This menu has expired. Run /help again.')
            .setDisabled(true)
            .addOptions([{ label: 'Expired', value: 'expired' }]);
          
          const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
          await interaction.editReply({ embeds: [embed], components: [disabledRow] });
        } catch {}
      }, 5 * 60 * 1000);

    } else {
      const sentMsg = await message.reply({ embeds: [embed], components: rows });

      // Auto-disable after 5 minutes
      setTimeout(async () => {
        try {
          const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId('help_select_disabled')
            .setPlaceholder(`⏰ This menu has expired. Run ${prefix}help again.`)
            .setDisabled(true)
            .addOptions([{ label: 'Expired', value: 'expired' }]);
          
          const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
          await sentMsg.edit({ embeds: [embed], components: [disabledRow] });
        } catch {}
      }, 5 * 60 * 1000);
    }
  }
};
