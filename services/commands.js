const fs = require('fs');
const config = require('../config.json');
const {StringUtils} = require('./strings.js');
const {Heroes} = require('./heroes.js');
const {Maps} = require('./maps.js');
const {Network} = require('./network-service.js');
const {SlashCommandBuilder} = require('@discordjs/builders');
const {App} = require('../app.js');
const commands = JSON.parse(fs.readFileSync('./data/constant/commands.json'), {encoding: 'utf8', flag: 'r'});

exports.Commands = {
    findCommand: function (commandName) {
        let commandNameToLowerCase = commandName.cleanVal();
        let commandEn = commands.find(command => (command.name.cleanVal() === commandNameToLowerCase));
        let commandBr = commands.find(command => (command.localizedName.cleanVal() === commandNameToLowerCase));

        let language = StringUtils.language;
        if (commandBr != null) {
            language = 'pt-br'
        } else if (commandEn != null) {
            language = 'en-us';
        }

        StringUtils.setLanguage(language);

        return commandEn || commandBr
    },

    getCommandHint: function (command) {
        return StringUtils.language === 'pt-br' ? command.localizedHint : command.hint;
    },

    getCommandName: function (command) {
        return StringUtils.language === 'pt-br' ? command.localizedName : command.name;
    },

    assembleSlashCommands: async function () {
        process.stdout.write('Started refreshing application (/) commands.\n');

        try {
            for (let it of commands) {
                let commandSlashBuilder = new SlashCommandBuilder()
                    .setName(it.name.toLowerCase())
                    .setDefaultPermission(it.defaultPermission)
                    .setDescription(it.hint.substring(0, 100));

                if (it.acceptParams) {

                    let argumentName = 'argument'
                    let descriptionArgument = 'some name'
                    let requiredParameter = false;

                    if (it.category === 'HEROES') {
                        argumentName = 'hero'
                        descriptionArgument = 'Hero name or part of it\'s name'
                    }

                    if (it.requiredParam) {
                        requiredParameter = true;
                    }

                    commandSlashBuilder.addStringOption(option =>
                        option.setName(argumentName)
                            .setDescription(descriptionArgument)
                            .setRequired(requiredParameter));
                }

                await Network.postSlashCommandsToAPI(commandSlashBuilder);
            }

            process.stdout.write('Successfully reloaded application (/) commands.\n');
        } catch (error) {
            process.stdout.write(`Error while reloading / commands ${error}`);
        }
    },

    handleCommand: async function (args, receivedCommand, msg, isInteraction) {
        let reply;
        let command = this.findCommand(receivedCommand);
        if (command != null && this.isCommandAllowed(msg, command)) {
            if (command.category === 'HEROES') {
                reply = Heroes.init(command, args);
            } else if (command.name === 'BotInfo') {
                reply = this.assembleBotInfosReturnMessage();
            } else if (command.name === 'Map') {
                reply = Maps.init(args);
            } else if (command.name === 'Help') {
                reply = this.assembleHelpReturnMessage(args);
            } else if (command.name === 'News') {
                reply = this.assembleNewsReturnMessage();
            } else if (command.name === 'Update') {
                if (Network.isUpdatingData) {
                    reply = StringUtils.get('hold.still.updating');
                } else {
                    App.setBotStatus('Updating', 'WATCHING');
                    Network.replyTo = msg;
                    let callBackMessage = null;
                    if (!isInteraction)
                        callBackMessage = this.assembleUpdateReturnMessage;

                    Network.updateData(callBackMessage);
                    reply = StringUtils.get('update.process.started');
                }
            } else {
                reply = StringUtils.get('command.not.exists', receivedCommand, config.prefix);
            }
        } else {
            reply = StringUtils.get('command.not.exists', receivedCommand, config.prefix);
        }
        return reply;
    },

    assembleUpdateReturnMessage: function (message) {
        Network.replyTo.reply(message);
        Network.replyTo = null;
    },

    assembleHelpReturnMessage: function (commandAsked) {
        let reply = '';
        let list = [];
        if (commandAsked != null && commandAsked !== 'null' && commandAsked !== '') {
            let command = this.findCommand(commandAsked);
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
                reply = StringUtils.get('command.not.exists', commandAsked, config.prefix);
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
    },

    assembleBotInfosReturnMessage: function () {
        // let reply = StringUtils.get('available.commands.are'); fixme
        let reply = 'Some infos about me';

        let totalSeconds = (App.bot.uptime / 1000);
        let days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        let hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = Math.floor(totalSeconds % 60);
        let uptime = `${days} day(s), ${hours} hour(s), ${minutes} minutes and ${seconds} seconds`;

        let list = [
            {
                name: 'I\'m on',
                value: App.bot.guilds._cache.size.toString() + ' server(s)',
                inline: true
            },
            {
                name: 'I\'m online for',
                value: uptime,
                inline: false
            },
            {
                name: 'Last time my database was updated',
                value: App.bot.updatedAt,
                inline: false
            },
            {
                name: 'My invitation link is',
                value: 'https://discord.com/oauth2/authorize?client_id=783467749258559509&permissions=534723951616&scope=bot',
                inline: false
            }
        ]


        return {
            data: {
                featureName: 'Bot general information', //fix me
                featureDescription: reply,
                list: list,
            },
            image: 'images/hots.png'
        }
    },

    assembleNewsReturnMessage() {
        return Network.gatherNews().then(
            returnedNews => {
                return {
                    data: {
                        featureName: StringUtils.get('news'),
                        news: returnedNews.map(it => {
                            return {
                                name: it.header,
                                value: it.link,
                                inline: false
                            };
                        })
                    }
                }
            }
        )
    },

    isCommandAllowed(msg, command) {
        if (command.defaultPermission) {
            return true
        } else {
            return (msg.author != null || msg.user != null) &&
                msg.member._roles.includes(
                    msg.member.guild.roles._cache.find(it => it.name.toLowerCase() === 'hots-bot-admin').id
                );
        }
    }
};
