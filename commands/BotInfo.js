const { StringService } = require('../services/string-service');
const { App } = require('../app');

exports.run = () => {
    let reply = StringService.get('some.infos.about.me');

    let totalSeconds = (App.bot.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const uptime = StringService.get('uptime.string', days, hours, minutes, seconds);
    const servers = App.bot.guilds._cache;
    App.log(`Servers. ${servers.map(it => it.name)}`);
    let list = [
        {
            name: StringService.get('im.on'),
            value: StringService.get('number.of.servers', servers.size.toString()),
            inline: true
        },
        {
            name: StringService.get('used.by'),
            value: StringService.get('number.of.users', App.bot.users.cache.filter(user => !user.bot).size),
            inline: true
        },
        {
            name: StringService.get('online.for'),
            value: uptime,
            inline: false
        },
        {
            name: StringService.get('last.time.database.updated'),
            value: App.bot.updatedAt,
            inline: false
        },
        {
            name: StringService.get('my.invitation.link.is'),
            value: `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=277025508352&scope=applications.commands%20bot`,
            inline: false
        }
    ]

    return {
        data: {
            featureName: StringService.get('bot.general.information'),
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

