const { CommandService } = require("../services/command-service");
const { App } = require('../app');
const { StringUtils } = require('../utils/string-utils');
const { SourceRepository } = require("../repositories/source-repository");

exports.run = (commandAsked, msg) => {
    let reply = '';
    let list = [];
    let commandInfos = '';
    const commands = App.bot.commands;

    if (commandAsked != null && commandAsked !== 'null' && commandAsked !== '') {
        let command = commands.get(commandAsked);
        if (command && CommandService.isCommandAllowed(msg, command)) {
            reply += command.help.hint;
            //TODO improve this
            if (command.help.acceptParams) {
                let example = '[argument]';

                if (command.help.paramOptions != null && command.help.paramOptions.length > 0) {
                    example = command.help.paramOptions[0]?.name;
                } else if (command.help.argumentName.toLowerCase() === 'hero') {
                    example = 'illidan'
                } else if (command.help.argumentName.toLowerCase() === 'heroes') {
                    example = 'aba,illidan'
                }

                list = [
                    {
                        name: StringUtils.get('accept.arguments'),
                        value: command.help.argumentDescription,
                        inline: false
                    },
                    {
                        name: StringUtils.get('example'),
                        value: StringUtils.get('command.example', '/', command.help.name.toLowerCase(), example),
                        inline: true
                    }
                ]
            }
        } else {
            reply = StringUtils.get('command.not.exists', commandAsked);
        }
    } else {

        reply = StringUtils.get('available.commands.are');
        list = Array.from(commands.values()).filter(it => CommandService.isCommandAllowed(msg, it)).map(it => {
            return {
                name: it.help.name,
                value: `|| ||`,
                inline: true
            };
        })
        
        commandInfos = StringUtils.get('all.commands.supported.both.languages');
        commandInfos += StringUtils.get('all.data.gathered.from');
        SourceRepository.listSources().forEach(source => {
            commandInfos += `[${source.name}](${source.site})\n`;
        });        
        commandInfos += StringUtils.get('if.want.to.know.more.about.specific.command');        
    }

    return {
        featureDescription: commandInfos?.length > 0 ? commandInfos : reply,
        data: {            
            list,
        },
        thumbnail: 'images/hots.png'
    }
}

exports.help = {
    name: "Help",
    displayName: StringUtils.get('help'),
    hint: "Shows how to use all commands",
    argumentName: 'Command',
    argumentDescription: 'Command name',
    acceptParams: true,
    requiredParam: false,
    defaultPermission: true,
    paramOptions: Array.from(CommandService.assembleCommands(true).values()).filter(it => it.help.defaultPermission).map(it => {
        return {
            name: it.help.name.toLowerCase(),
            description: it.help.name
        };
    }),
    category: "GENERAL"
}

