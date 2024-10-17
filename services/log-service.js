const { App } = require('../app');
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = process.env?.LOG_LEVEL ?? 'info';

log4js.configuration = {
    appenders: {
        out: { type: 'stdout' },
        console: { type: 'console', layout: { "type": "pattern", "pattern": "%d - [%p] %m" } },
        fileLog: { type: 'file', filename: '/logs/application.log' },
        consoleFilter: {
			type: 'logLevelFilter', appender: 'console', level: process.env.LOG_LEVEL || 'all'
		},
        discordWebhookAppender: {
            type: 'discord-log-appender',
            webhookId: process.env.LOGS_WEBHOOK_ID ?? '',
            webhookToken: process.env.LOGS_WEBHOOK_TOKEN ?? '',
            layout: { "type": "pattern", "pattern": "%d - [%p] ```%m```" }
        },
        discordFilter: {
            type: 'logLevelFilter', appender: 'discordWebhookAppender', level: process.env.WEBHOOK_LOG_LEVEL || 'warn'
        }
    },
    categories: {
        default: { appenders: ['consoleFilter', 'fileLog', 'discordFilter'], level: process.env.LOG_LEVEL || 'info' },
    }
}
log4js.configure(log4js.configuration);

module.exports = { logger };
