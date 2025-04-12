const { CommandService } = require('../services/command-service.js');
const { ExternalDataService } = require('../services/external-data-service.js');
const { StringUtils } = require('../utils/string-utils.js');
const { logger } = require('../services/log-service.js');
const { EmojiRepository } = require('../repositories/emoji-repository.js');
const { EmojiService } = require('../services/emoji-service.js');

exports.run = (app) => {
    logger.info(`application ready!`);
    app.bot.updatedAt = StringUtils.get('not.updated.yet');
    app.setStatus('Use /help to see commands');
    ExternalDataService.periodicUpdateCheck(true);

    Promise.all([
        EmojiService.updateEmojisIfNeeded(),
        CommandService.isUpdateSlashCommandsNeeded(),
    ]).then(([emojiUpdateResult, slashUpdateNeeded]) => {
        if (slashUpdateNeeded) {
            CommandService.updateSlashCommands();
        } else {
            logger.info(`slash commands update not needed`);
        }
    }).catch(err => {
        logger.error(`error during startup: ${err}`);
    });
};

exports.once = true;
exports.name = 'ready';