const { WebhookClient } = require("discord.js");

function configure(config, layouts) {
    const layout = config.layout ? layouts.layout(config.layout.type, config.layout) :
        layouts.patternLayout('%m');
    if (config.webhookId && config.webhookToken) {
        config.webhook = new WebhookClient({ id: config.webhookId, token: config.webhookToken });
    } else {
        console.warn('webhook for discord logs appender not configured');
    }
    return discordLogAppender(config, layout);
}

function discordLogAppender(config, layout) {
    const appender = (loggingEvent) => {
        config.webhook?.send(layout(loggingEvent)).catch((err) => {
            console.error(`Error sending log4js discord webhook message: ${JSON.stringify(embedContent)}\n` + err);
        });

    };
    return appender;
}

module.exports.configure = configure;