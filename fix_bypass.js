const fs = require('fs');

function findFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const p = dir + '/' + file;
    if (fs.statSync(p).isDirectory()) {
      findFiles(p, files);
    } else if (p.endsWith('.js')) {
      files.push(p);
    }
  }
  return files;
}

const files = findFiles('./commands');
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('const isOwner = require(')) {
    content = content.replace(/const isOwner = require\((['`].+?isOwner['`])\);/g, 'const checkOwnerBypass = require($1);');
    changed = true;
  }

  if (content.includes('const ownerBypass = isOwner(')) {
    // If the file uses `executor.id`, the replace string might not have `isSlash` available depending on where it's placed. 
    // Wait, the generalist agent inserted it inside `execute(interactionOrMessage, ...)`
    content = content.replace(/const ownerBypass = isOwner\([^)]+\);/g, `const bypassExecutorId = (typeof isSlash !== 'undefined' && isSlash) ? (interactionOrMessage.user ? interactionOrMessage.user.id : interactionOrMessage.author.id) : (interactionOrMessage && interactionOrMessage.author ? interactionOrMessage.author.id : (interactionOrMessage && interactionOrMessage.user ? interactionOrMessage.user.id : (typeof executorId !== 'undefined' ? executorId : (typeof executor !== 'undefined' ? executor.id : ''))));\n    const ownerBypass = checkOwnerBypass(bypassExecutorId);`);
    changed = true;
  }

  if (file.includes('cmdrole.js')) {
      content = content.replace(/const isOwner = guildConfig\.isOwner\(executorId\);/, 'const isOwnerCheckLocal = guildConfig.isOwner(executorId);');
      content = content.replace(/if \(\!isOwner && !isAdmin\)/, 'if (!isOwnerCheckLocal && !isAdmin)');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
  }
}
console.log('Fixed ' + count + ' files.');
