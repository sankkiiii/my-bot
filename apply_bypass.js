const fs = require('fs');
const path = require('path');

const files = [
    'commands/mod/ban.js', 'commands/mod/kick.js', 'commands/mod/mute.js', 'commands/mod/unmute.js', 
    'commands/mod/warn.js', 'commands/mod/purge.js', 'commands/mod/nick.js', 'commands/mod/role.js', 
    'commands/mod/drag.js', 'commands/mod/vckick.js', 'commands/mod/vckickall.js', 'commands/mod/dump.js', 
    'commands/mod/cmdrole.js', 'commands/mod/rpc.js', 'commands/mod/status.js', 'commands/mod/noprefix.js', 
    'commands/mod/owner.js', 'commands/tickets/panel.js', 'commands/setup/setup.js', 'commands/setup/config.js', 
    'commands/setup/resetconfig.js', 'commands/util/av.js', 'commands/util/banner.js', 'commands/util/sicon.js', 
    'commands/util/sbanner.js', 'commands/util/serverinfo.js', 'commands/util/userinfo.js', 
    'commands/util/purgebots.js', 'commands/util/purgeuser.js', 'commands/util/afk.js', 
    'commands/util/help.js', 'commands/util/vcpanel.js', 'commands/fun/pp.js', 'commands/fun/gay.js'
];

const root = 'D:\\Coding AI Agents\\gemini\\my-bot';

for (const fileRel of files) {
    const filePath = path.join(root, fileRel);
    if (!fs.existsSync(filePath)) {
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Clean up previous failed attempts
    content = content.replace(/const ownerBypass = isOwner\(.*?\);\n?/g, '');
    content = content.replace(/if \(!ownerBypass\) \{\n?\s*/g, '');
    // This is hard to undo. I'll just try to fix it.
    // Actually, I'll just use a more surgical approach now.
    
    // Reset the file to a cleaner state (optional but helpful if I can)
    // For now I'll just try to fix the injections.

    // 1. Ensure Import
    const depth = fileRel.split('/').length - 1;
    const relPath = '../'.repeat(depth) + 'utils/isOwner';
    if (!content.includes(`const isOwner = require('${relPath}')`)) {
        content = content.replace(/const isOwner = require\(.*?\);\n?/g, ''); // Remove any existing
        content = content.replace(/(const .* = require\(.*\);)/, `$1\nconst isOwner = require('${relPath}');`);
    }

    // 2. Inject ownerBypass correctly
    const executorIdLine = `    const executorId = isSlash ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage.author ? interactionOrMessage.author.id : interactionOrMessage.user.id);`;
    const ownerBypassLine = `    const ownerBypass = isOwner(executorId);`;

    const executeRegex = /async execute\((interactionOrMessage|interaction), (argsOrClient|client), (clientOrUndefined)?\) \{/;
    
    // Remove any existing injections first to be safe
    content = content.replace(/const executorId = .*?;\n?/g, '');
    content = content.replace(/const ownerBypass = .*?;\n?/g, '');
    content = content.replace(/const isSlash = interactionOrMessage instanceof CommandInteraction;\n?/g, '');

    content = content.replace(executeRegex, `$&\n    const isSlash = interactionOrMessage instanceof CommandInteraction;\n${executorIdLine}\n${ownerBypassLine}`);

    // Remove old isOwner/ownerBypass definitions that might be lingering
    content = content.replace(/const isOwner = \(isSlash \? interactionOrMessage\.user\.id : interactionOrMessage\.author\.id\) === config\.ownerId;\n?/g, '');
    content = content.replace(/const isOwner = guildConfig\.isOwner\(closer\.user\.id\);\n?/g, '');
    content = content.replace(/const isOwner = guildConfig\.isOwner\(executorId\);\n?/g, '');

    // 3. Re-apply wrapping (carefully)
    // I'll first remove existing wraps to avoid double wrapping
    content = content.replace(/if \(!ownerBypass\) \{\n\s*/g, '');
    // Wait, I need to remove the CLOSING brace too. This is risky.

    // Better: regex that matches the wrapped block and keeps only the inside.
    content = content.replace(/if \(!ownerBypass\) \{\n\s*([\s\S]*?)\n\s*\}/g, '$1');

    // Now re-wrap
    // Cooldown
    content = content.replace(
        /(const remaining = cooldown\.check[\s\S]*?if \(remaining > 0\) \{[\s\S]*?\}\s*)/g,
        `if (!ownerBypass) {\n    $1}\n`
    );

    if (fileRel !== 'commands/mod/noprefix.js' && fileRel !== 'commands/mod/owner.js') {
        // Executor Permissions
        content = content.replace(
            /if \(!?(interaction|message|interactionOrMessage|interaction\.member|message\.member|closer)\.permissions\.has\([\s\S]*?\) \{[\s\S]*?\}\s*/g,
            (match) => {
                if (match.includes('botMember')) return match; // Skip bot perms here
                return `if (!ownerBypass) {\n    ${match}}\n`;
            }
        );

        // Bot Permissions
        content = content.replace(
            /if \(!botMember \|\| !botMember\.permissions\.has\([\s\S]*?\) \{[\s\S]*?\}\s*/g,
            `if (!ownerBypass) {\n    $1}\n`
        );

        // Role Hierarchy
        content = content.replace(
            /if \((!ownerBypass && )?member\.roles\.highest\.position >= (executorMember|botMember)\.roles\.highest\.position\) \{[\s\S]*?\}\s*/g,
            `if (!ownerBypass) {\n    $1}\n`
        );
        
        // Role Restrictions
        content = content.replace(
            /const canUse = guildConfig\.hasCommandRole\([\s\S]*?\);\s*if \(!canUse\) \{[\s\S]*?\}\s*/g,
            `if (!ownerBypass) {\n    $1}\n`
        );
    }

    // Clean up
    content = content.replace(/!isOwner && /g, '');
    content = content.replace(/!ownerBypass && /g, '');

    fs.writeFileSync(filePath, content);
}
