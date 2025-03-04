const { CommandService } = require('../services/command-service.js');
const { ExternalDataService } = require('../services/external-data-service.js');
const { StringUtils } = require('../utils/string-utils.js');
const { logger } = require('../services/log-service.js');

exports.run = (app) => {
 logger.info(`application ready!`);
    app.bot.updatedAt = StringUtils.get('not.updated.yet');
    app.setStatus('Use /help to see commands');
    ExternalDataService.periodicUpdateCheck(true);
    CommandService.isUpdateSlashCommandsNeeded().then(needed => {
        if (needed) {
            CommandService.updateSlashCommands();
        } else {
            logger.info(`slash commands update not needed`);
        }
    });
};
exports.once = true;
exports.name = 'ready';