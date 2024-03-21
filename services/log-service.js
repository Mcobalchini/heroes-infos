const { EmbedService } = require("./embed-service");
const { StringService } = require("./string-service");

exports.LogService = {
    logChannel: null,
    errorChannel: null,

    setUp: function(logChannel, errorChannel) {    
        this.logChannel = logChannel;
        this.errorChannel = errorChannel;
    },
    
    log: function (text, error) {
        try {
            const date = new Date().toLocaleString("pt-BR");
            if (error) {
                process.stdout.write(`[${date}] - ${text} - [ERROR]: ${error} \n`);
                if (this.errorChannel) {
                    this.sendError(error);
                }
            } else {
                const log = `[${date}] - ${text}\n`;
                process.stdout.write(log);
                if (this.logChannel) {
                    this.sendLog(log);
                }
            }
        } catch (e) {
            process.stdout.write(`error while sending error ${e.message}\n`);
        }
    },

    //TODO fix log stream
    sendLog: function (logMessage) {
        this.logChannel?.send(logMessage);
    },

    sendError: function (errorMessage) {    
        const reply = {
            featureName: StringService.get('bot.error'),
            data: errorMessage.message,
        }
        const embed = EmbedService.createEmbed(reply, null, null, null, 'attachment://fire.png');
        embed.setColor('#FE4F60');
        this.errorChannel?.send(EmbedService.assembleEmbedObject(embed));
    }
};
