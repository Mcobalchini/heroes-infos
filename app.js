require('dotenv').config({ path: './variables.env' });
const {
    Client,
    IntentsBitField,
    ActivityType
} = require('discord.js');
const myIntents = new IntentsBitField();
myIntents.add(IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages);
const bot = new Client({ intents: myIntents });
const App = {
    setStatus: setStatus,
    bot: bot
};
exports.App = App;

const { StringUtils } = require('./utils/string-utils.js');
const { CommandService } = require('./services/command-service.js');
const { logger } = require('./services/log-service.js');
const { FileUtils } = require('./utils/file-utils.js');
const EVENTS_FOLDER = './events';

function setStatus(name) {
    bot.user.setPresence({
        activities: [{ name: name, type: ActivityType.Custom, state: name }],
        status: 'https://heroesofthestorm.com/'
    });
}

function assembleEvents() {
    const events = FileUtils.listAllJsFilesInFolder(EVENTS_FOLDER);
    for (const file of events) {
        const eventName = file.split('.')[0];
        const event = require(`${EVENTS_FOLDER}/${file}`);
        logger.debug(`attempting to load event ${eventName}`);
        if (event.once) {
            bot.once(event.name, (...args) => event.run(App, ...args));
        } else {
            bot.on(event.name, (...args) => event.run(App, ...args));
        }
    }
}

bot.login(process.env.HEROES_INFOS_TOKEN).then(() => {
    StringUtils.setup();
    logger.info('successfully logged in')
    assembleEvents();
    bot.commands = CommandService.assembleCommands();
});

