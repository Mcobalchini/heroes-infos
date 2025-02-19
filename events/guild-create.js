const { logger } = require('./services/log-service.js');

exports.execute = async (bot, guild) => {
    logger.info(`bot was added to server ${guild.name}`);
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.JOIN_SERVER_CHANNEL_ID);
    const embed = EmbedUtils.createEmbed({
        featureName: StringUtils.get('joined.new.server'),
        guildData: assembleGuildData(guild)
    }, null, null, null, guild.iconURL());
    channel?.send(EmbedUtils.assembleEmbedObject(embed));
};

exports.name = 'guildCreate';
