const fs = require('fs');
const path = require('path');

/**
 * Loads all command files from commands/ subfolders into client.commands Collection.
 * Also registers prefix aliases.
 * @param {import('discord.js').Client} client
 */
function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter((f) => f.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
        console.log(`[Commands] Loaded: ${command.data.name}`);

        // Register prefix aliases
        if (command.aliases && Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            client.commands.set(alias, command);
          }
          console.log(`[Commands]   └─ Aliases: ${command.aliases.join(', ')}`);
        }
      } else {
        console.warn(`[Commands] Skipping ${filePath} — missing "data.name".`);
      }
    }
  }
}

module.exports = { loadCommands };
