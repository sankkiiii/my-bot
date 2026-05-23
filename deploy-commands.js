const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter((f) => f.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(path.join(folderPath, file));
      if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`[Deploy] Queued: ${command.data.name}`);
      }
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log(`[Deploy] Registering ${commands.length} slash command(s) to guild ${config.guildId}...`);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log('[Deploy] Successfully registered all slash commands.');
  } catch (err) {
    console.error('[Deploy] Error:', err);
  }
}

deployCommands();
