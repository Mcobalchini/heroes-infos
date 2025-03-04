const { EmbedUtils } = require('../utils/embed-utils.js');
const { StringUtils } = require('../utils/string-utils.js');
const { logger } = require('../services/log-service.js');

exports.run = async (app, guild) => {
    logger.info(`bot was added to server ${guild.name}`);
    const channel = app.bot.channels?.cache?.find(channel => channel.id === process.env.JOIN_SERVER_CHANNEL_ID);
    const embed = EmbedUtils.createSingleEmbed({
        featureName: StringUtils.get('joined.new.server'),
        data: { guildInfo: assembleGuildData(guild) },
        thumbnail: guild.iconURL()
    });
    channel?.send(EmbedUtils.assembleEmbedObject(embed));
};

function assembleGuildData(guild) {
    return [
        {
            name: StringUtils.get('server.name'),
            value: guild?.name ?? `_ _`,
            inline: false
        },
        {
            name: StringUtils.get('server.id'),
            value: guild?.id?.toString() ?? '0',
            inline: true
        },
        {
            name: StringUtils.get('server.member.count'),
            value: guild?.memberCount?.toString() ?? '0',
            inline: false
        },
        {
            name: StringUtils.get('server.owner.id'),
            value: guild?.ownerId?.toString() ?? '_ _',
            inline: true
        }
    ]
}
exports.once = false;
exports.name = 'guildCreate';
