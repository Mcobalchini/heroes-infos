const {StringService} = require('../services/string-service');
const {App} = require('../app');
const config = require("../config.json");
const {CommandService} = require("../services/command-service");

exports.run = (commandAsked, msg) => {
    let reply = '';
    let list = [];
    let commandInfos = '';
    const commands = App.bot.commands;

    if (commandAsked != null && commandAsked !== 'null' && commandAsked !== '') {
        let command = commands.get(commandAsked);
        if (command && CommandService.isCommandAllowed(msg, command)) {
            reply += command.help.hint;
            if (command.help.acceptParams) {
                list = [
                    {
                        name: StringService.get('accept.arguments'),
                        value: command.help.argumentDescription,
                        inline: false
                    },
                    {
                        name: StringService.get('example'),
                        value: StringService.get('command.example', '/', command.help.name.toLowerCase()),
                        inline: true
                    }
                ]
            }
        } else {
            reply = StringService.get('command.not.exists', commandAsked);
        }
    } else {

        reply = StringService.get('available.commands.are');
        list = Array.from(commands.values()).filter(it => CommandService.isCommandAllowed(msg, it)).map(it => {
            return {
                name: it.help.name,
                value: `|| ||`,
                inline: true
            };
        })

        commandInfos = StringService.get('all.commands.supported.both.languages');
        commandInfos += StringService.get('all.data.gathered.from');
        commandInfos += 'https://www.icy-veins.com/heroes/\n';
        commandInfos += 'https://www.heroesprofile.com\n';
        commandInfos += 'https://nexuscompendium.com\n';
        commandInfos += 'https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2\n';
        commandInfos += StringService.get('if.want.to.know.more.about.specific.command');
        commandInfos += StringService.get('version', config.version);
    }

    const responseData = {
        featureName: StringService.get('help'),
        featureDescription: reply,
        list: list
    };

    if (commandInfos?.length) {
        responseData.commandInfos = {
            featureName: StringService.get('help'),
            featureDescription: commandInfos,
        };
    }

    return {
        data: responseData,
        authorImage: 'images/hots.png'
    }
}

exports.help = {
    name: "Help",
    hint: "Display useful hints for all commands",
    argumentName: 'Command',
    argumentDescription: 'Command name',
    acceptParams: true,
    requiredParam: false,
    defaultPermission: true,
    category: "GENERAL"
}

