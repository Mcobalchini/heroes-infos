const { App } = require('../app');
const { LogService } = require('../services/log-service');
const { StringUtils } = require('../utils/string-utils');

exports.run = () => {
    let reply = StringUtils.get('some.infos.about.me');

    let totalSeconds = (App.bot.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const uptime = StringUtils.get('uptime.string', days, hours, minutes, seconds);
    const servers = App.bot.guilds._cache;
    LogService.log(`Servers. ${servers.map(it => it.name)}`);
    let list = [
        {
            name: StringUtils.get('im.on'),
            value: StringUtils.get('number.of.servers', servers.size.toString()),
            inline: true
        },
        {
            name: StringUtils.get('used.by'),
            value: StringUtils.get('number.of.users', App.bot.users.cache.filter(user => !user.bot).size),
            inline: true
        },
        {
            name: StringUtils.get('online.for'),
            value: uptime,
            inline: false
        },
        {
            name: StringUtils.get('last.time.database.updated'),
            value: App.bot.updatedAt,
            inline: false
        },
        {
            name: StringUtils.get('my.invitation.link.is'),
            value: `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=277025508352&scope=applications.commands%20bot`,
            inline: false
        }
    ]

    return {
        data: {
            featureName: StringUtils.get('bot.general.information'),
            featureDescription: reply,
            list: list,
        },
        authorImage: 'images/hots.png'
    }
}

exports.help = {
    name: 'BotInfo',
    hint: 'Fetch bot infos',
    acceptParams: false,
    defaultPermission: false,
    category: 'GENERAL'
}

