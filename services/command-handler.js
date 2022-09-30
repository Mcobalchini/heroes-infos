const {Collection} = require("discord.js");
const {FileService} = require("./file-service");

exports.assembleCommands = () => {
    const commands = FileService.openDir("./commands").filter(file => file.endsWith(".js"));
    const commandsMap = new Collection();
    for (const file of commands) {
        const commandName = file.split(".")[0];
        const command = require(`./commands/${file}`);
        console.log(`Attempting to load command ${commandName}`);
        commandsMap.set(commandName, command);
    }
    return commandsMap
}
