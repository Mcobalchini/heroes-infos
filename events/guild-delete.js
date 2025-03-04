const { EmbedUtils } = require('../utils/embed-utils.js');
const { logger } = require('../services/log-service.js');
const { StringUtils } = require('../utils/string-utils.js');

exports.run = (app, guild) => {
    logger.info(`bot was removed from server ${guild.name}`);
    const channel = app.bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    if (guild?.name) {
        const embed = EmbedUtils.createSingleEmbed({
            featureName: StringUtils.get('left.server'),
            data: { guildInfo: assembleGuildData(guild) },
            thumbnail: guild.iconURL()
        });
        channel?.send(EmbedUtils.assembleEmbedObject(embed));
    }
};

//TODO centralize
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
exports.name = 'guildDelete';