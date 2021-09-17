const fs = require('fs');
const config = require("../config.json");
const {StringUtils} = require("./strings.js");
const commands = JSON.parse(fs.readFileSync("./data/commands.json"), {encoding: 'utf8', flag: 'r'});

exports.Commands = {

    findCommand: function (commandName) {
        let commandNameToLowerCase = commandName.cleanVal();
        let commandEn = commands.find(command => (command.name.cleanVal() === commandNameToLowerCase));
        let commandBr = commands.find(command => (command.localizedName.cleanVal() === commandNameToLowerCase));

        let language = StringUtils.language;
        if (commandBr != null) {
            language = "pt-br"
        } else if (commandEn != null) {
            language = "en-us";
        }

        StringUtils.setLanguage(language);

        return commandEn || commandBr
    },

    getCommandHint: function (command) {
        return StringUtils.language === "pt-br" ? command.localizedHint : command.hint
    },

    getCommandName: function (command) {
        return StringUtils.language === "pt-br" ? command.localizedName : command.name
    },

    assembleHelpReturnMessage: function (commandName) {
        let reply = "";
        let list = [];
        if (commandName != null && commandName !== "null" && commandName !== "") {
            let command = this.findCommand(commandName);
            if (command != null) {
                reply += `${this.getCommandHint(command)}\n`;
                if (command.acceptParams) {
                    list = [{
                        name: StringUtils.get('example'),
                        value: StringUtils.get('command.example', this.getCommandName(command).toLowerCase(), config.prefix),
                        inline: true
                    }]
                }
            } else {
                reply = StringUtils.get('command.not.exists', commandName, config.prefix);
            }
        } else {

            reply = StringUtils.get('available.commands.are');
            list = commands.map(it => {
                return {
                    name: it.name,
                    value: it.localizedName,
                    inline: true
                };
            })
        }

        let commandInfos = StringUtils.get('all.commands.supported.both.languages');
        commandInfos += StringUtils.get('all.data.gathered.from');
        commandInfos += 'https://www.icy-veins.com/heroes/\n';
        commandInfos += 'https://www.heroesprofile.com\n';
        commandInfos += 'http://robogrub.com/silvertierlist_api\n';
        commandInfos += 'https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2\n';
        commandInfos += StringUtils.get('if.want.to.know.more.about.specific.command', config.prefix);
        commandInfos += StringUtils.get('version', config.version);

        return {
            data: {
                featureName: StringUtils.get('help'),
                featureDescription: reply,
                list: list,
                commandInfos: commandInfos
            },
            image: 'images/hots.png'
        }
    }
};
