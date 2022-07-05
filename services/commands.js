const fs = require('fs');
const config = require('../config.json');
const {StringUtils} = require('./strings.js');
const {Heroes} = require('./heroes.js');
const {Maps} = require('./maps.js');
const {Network} = require('./network-service.js');
const {SlashCommandBuilder} = require('@discordjs/builders');
const {App} = require('../app.js');
const commands = JSON.parse(fs.readFileSync('./data/constant/commands.json'),
    {encoding: 'utf8', flag: 'r'}).commands;

exports.Commands = {

    findCommand: function (commandName) {
        let clearName = commandName.unaccentClean();
        let commandEn = commands.find(command => (command.name.unaccentClean() === clearName));
        let commandBr = commands.find(command => (command.localizedName.unaccentClean() === clearName));

        let language = StringUtils.language;
        if (commandBr != null) {
            language = StringUtils.PT_BR;
        } else if (commandEn != null) {
            language = StringUtils.EN_US;
        }

        StringUtils.setLanguage(language);

        return commandEn || commandBr
    },

    getCommandHint: function (command) {
        return StringUtils.language === 'pt-br' ? command.localizedHint : command.hint;
    },

    getCommandName: function (command) {
        return StringUtils.isEn() ? command.name : command.localizedName;
    },

    isUpdateSlashCommandsNeeded: async function () {
        const apiCommands = await Network.getApiCommandsSize();
        return process.env.UPDATE_COMMANDS === 'true' || ((commands.length * 2) !== apiCommands);
    },

    assembleSlashCommands: async function (localized = false) {
        App.log(`Started refreshing application (/) commands. ${localized}`);
        let language = localized ? StringUtils.PT_BR : StringUtils.EN_US;
        StringUtils.setLanguage(language);

        try {
            for (let it of commands) {
                let name = localized ? it.localizedName.unaccent() : it.name;
                let description = localized ? it.localizedHint : it.hint;

                let commandSlashBuilder = new SlashCommandBuilder()
                    .setName(name.toLowerCase())
                    .setDefaultPermission(it.defaultPermission)
                    .setDescription(description.substring(0, 100));

                if (it.acceptParams) {
                    if (it.paramOptions) {
                        const options = it.paramOptions.map(param => {
                            return {
                                name: StringUtils.getWithoutNewLine(param.description).toLowerCase(),
                                value: param.name
                            }
                        });
                        commandSlashBuilder.addStringOption(option =>
                            option.setName('option')
                                .setDescription('select one')
                                .setRequired(it.requiredParam)
                                .addChoices(...options)
                        );
                    } else {
                        let argumentName = StringUtils.getWithoutNewLine('argument').toLowerCase();
                        let descriptionArgument = StringUtils.getWithoutNewLine('some.name');
                        let requiredParameter = false;

                        if (it.category === 'HEROES') {
                            argumentName = StringUtils.getWithoutNewLine('hero').toLowerCase();
                            descriptionArgument = StringUtils.getWithoutNewLine('hero.name.or.part.of.name');

                            if (it.name === 'Suggest') {
                                argumentName = StringUtils.getWithoutNewLine('role').toLowerCase();
                                descriptionArgument = StringUtils.getWithoutNewLine('role');
                            }
                        } else if (it.category === 'MAP') {
                            argumentName = StringUtils.getWithoutNewLine('map').toLowerCase();
                            descriptionArgument = StringUtils.getWithoutNewLine('map.name.or.part.of.name');
                        } else if (it.name === 'Help') {
                            argumentName = StringUtils.getWithoutNewLine('command').toLowerCase();
                            descriptionArgument = StringUtils.getWithoutNewLine('command');
                        }

                        if (it.requiredParam) {
                            requiredParameter = true;
                        }

                        commandSlashBuilder.addStringOption(option =>
                            option.setName(argumentName)
                                .setDescription(descriptionArgument)
                                .setRequired(requiredParameter));
                    }
                }

                await Network.postSlashCommandsToAPI(commandSlashBuilder);
            }

            App.log(`Successfully reloaded application (/) commands. ${localized}`);
        } catch (error) {
            App.log(`Error while reloading / commands ${localized}`, error);
        }
    },

    handleCommand: async function (args, receivedCommand, msg) {
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
                reply = this.assembleHelpReturnMessage(msg, args);
            } else if (command.name === 'News') {
                reply = await this.assembleNewsReturnMessage();
            } else if (command.name === 'Update') {
                if (Network.isUpdatingData) {
                    reply = StringUtils.get('hold.still.updating');
                } else {
                    App.setBotStatus('Updating', 'WATCHING');
                    Network.updateData(args);
                    reply = StringUtils.get('update.process.started');
                }
            } else {
                reply = StringUtils.get('command.not.exists', receivedCommand);
            }
        } else {
            reply = StringUtils.get('command.not.exists', receivedCommand);
        }

        if (command && command.source){
            reply.footer = {
                source: command.source,
                sourceImage: command.sourceImage
            }
        }

        if (reply.toString() === '[object Object]') {
            return reply;
        } else {
            return {
                data: {
                    featureName: ' ',
                    message: reply,
                }
            };
        }
    },

    assembleHelpReturnMessage: function (msg, commandAsked) {
        let reply = '';
        let list = [];
        let commandInfos = '';

        if (commandAsked != null && commandAsked !== 'null' && commandAsked !== '') {
            let command = this.findCommand(commandAsked);
            if (command != null && this.isCommandAllowed(msg, command)) {
                reply += `${this.getCommandHint(command)}`;
                if (command.acceptParams) {
                    list = [{
                        name: StringUtils.get('example'),
                        value: StringUtils.get('command.example', '/', this.getCommandName(command).toLowerCase()),
                        inline: true
                    }]
                }
            } else {
                reply = StringUtils.get('command.not.exists', commandAsked);
            }
        } else {

            reply = StringUtils.get('available.commands.are');
            list = commands.filter(command => this.isCommandAllowed(msg, command)).map(it => {
                const name = this.getCommandName(it);
                return {
                    name: name,
                    value: `|| ||`,
                    inline: true
                };
            })

            commandInfos = StringUtils.get('all.commands.supported.both.languages');
            commandInfos += StringUtils.get('all.data.gathered.from');
            commandInfos += 'https://www.icy-veins.com/heroes/\n';
            commandInfos += 'https://www.heroesprofile.com\n';
            commandInfos += 'https://nexuscompendium.com\n';
            commandInfos += 'https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2\n';
            commandInfos += StringUtils.get('if.want.to.know.more.about.specific.command');
            commandInfos += StringUtils.get('version', config.version);
        }

        const responseData = {
            featureName: StringUtils.get('help'),
            featureDescription: reply,
            list: list
        };

        if (commandInfos?.length) {
            responseData.commandInfos = {
                featureName: StringUtils.get('help'),
                featureDescription: commandInfos,
            };
        }

        return {
            data: responseData,
            authorImage: 'images/hots.png'
        }
    },

    assembleBotInfosReturnMessage: function () {
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
        App.log(`Servers. ${servers.map(it => it.name )}`);
        let list = [
            {
                name: StringUtils.get('im.on'),
                value: StringUtils.get('number.of.servers', servers.size.toString()),
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
            if (msg.author != null || msg.user != null) {
                const id = (msg.author != null ? msg.author.id : (msg.user != null ? msg.user.id : 0));
                return (id === config.adminId) ||
                    msg.member?._roles?.includes(
                        msg.member?.guild?.roles?._cache.find(it => it.name.toLowerCase() === 'hots-bot-admin')?.id
                    );
            }
        }
    }
};
