const { logger } = require('./services/log-service.js');

exports.run = (bot, guild) => {
    logger.info(`bot was removed from server ${guild.name}`);
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    if (guild?.name) {
        const embed = EmbedUtils.createEmbed({
            featureName: StringUtils.get('left.server'),
            guildData: assembleGuildData(guild)
        }, null, null, null, guild.iconURL());
        channel?.send(EmbedUtils.assembleEmbedObject(embed));
    }
};

exports.name = 'guildDelete';