const config = require('../config.json');
const {StringService} = require('./string-service.js');
const {HeroService} = require('./hero-service.js');
const {MapService} = require('./map-service.js');
const {Network} = require('./network-service.js');
const {SlashCommandBuilder} = require('@discordjs/builders');
const {App} = require('../app.js');
const {FileService} = require("./file-service");
const commands = FileService.openJsonSync('./data/constant/commands.json').commands;

exports.CommandService = {

    findCommand: function (commandName) {
        let clearName = commandName.unaccentClean();
        return commands.find(command => (command.name.unaccentClean() === clearName));
    },

    getCommandHint: function (command) {
        return command.hint;
    },

    getCommandName: function (command) {
        return command.name;
    },

    isUpdateSlashCommandsNeeded: async function () {
        const apiCommandsSize = await Network.getApiCommandsSize();
        return process.env.UPDATE_COMMANDS === 'true' || (commands.length !== apiCommandsSize);
    },

    updateSlashCommands: async function () {
        if (process.env.RENEW_COMMANDS === 'true') {
            await App.bot.application.commands.set([]);
        }
        await this.assembleSlashCommands();
    },

    assembleSlashCommands: async function () {
        App.log(`Started refreshing application (/) commands.`);

        try {
            for (let it of commands) {
                let name = it.name;
                let description = it.hint;

                let commandSlashBuilder = new SlashCommandBuilder()
                    .setName(name.toLowerCase())
                    .setDMPermission(true)
                    .setDescription(description.substring(0, 100));

                if (it.acceptParams) {
                    if (it.paramOptions) {
                        const options = it.paramOptions.map(param => {
                            return {
                                name: StringService.getWithoutNewLine(param.description).toLowerCase(),
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
                        let argumentName = StringService.getWithoutNewLine('argument').toLowerCase();
                        let descriptionArgument = StringService.getWithoutNewLine('some.name');
                        let requiredParameter = false;

                        if (it.category === 'HEROES') {
                            argumentName = StringService.getWithoutNewLine('hero').toLowerCase();
                            descriptionArgument = StringService.getWithoutNewLine('hero.name.or.part.of.name');

                            if (it.name === 'Suggest') {
                                argumentName = StringService.getWithoutNewLine('role').toLowerCase();
                                descriptionArgument = StringService.getWithoutNewLine('role');
                            }
                        } else if (it.category === 'MAP') {
                            argumentName = StringService.getWithoutNewLine('map').toLowerCase();
                            descriptionArgument = StringService.getWithoutNewLine('map.name.or.part.of.name');
                        } else if (it.name === 'Help') {
                            argumentName = StringService.getWithoutNewLine('command').toLowerCase();
                            descriptionArgument = StringService.getWithoutNewLine('command');
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

            App.log(`Successfully reloaded application (/) commands.`);
        } catch (error) {
            App.log(`Error while reloading / commands`, error);
        }
    },

    handleCommand: async function (args, receivedCommand, msg) {
        let reply;
        let command = this.findCommand(receivedCommand);
        if (command != null && this.isCommandAllowed(msg, command)) {
            if (command.category === 'HEROES') {
                reply = HeroService.init(command, args);
            } else if (command.name === 'BotInfo') {
                reply = this.assembleBotInfosReturnMessage();
            } else if (command.name === 'Map') {
                reply = MapService.init(args);
            } else if (command.name === 'Help') {
                reply = this.assembleHelpReturnMessage(msg, args);
            } else if (command.name === 'News') {
                reply = await this.assembleNewsReturnMessage();
            } else if (command.name === 'Update') {
                if (Network.isUpdatingData) {
                    reply = StringService.get('hold.still.updating');
                } else {
                    App.setBotStatus('Updating', 'WATCHING');
                    Network.updateData(args);
                    reply = StringService.get('update.process.started');
                }
            } else {
                reply = StringService.get('command.not.exists', receivedCommand);
            }
        } else {
            reply = StringService.get('command.not.exists', receivedCommand);
        }

        if (command && command.source) {
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
                        name: StringService.get('example'),
                        value: StringService.get('command.example', '/', this.getCommandName(command).toLowerCase()),
                        inline: true
                    }]
                }
            } else {
                reply = StringService.get('command.not.exists', commandAsked);
            }
        } else {

            reply = StringService.get('available.commands.are');
            list = commands.filter(command => this.isCommandAllowed(msg, command)).map(it => {
                const name = this.getCommandName(it);
                return {
                    name: name,
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
    },

    assembleBotInfosReturnMessage: function () {
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
    },

    assembleNewsReturnMessage() {
        return Network.gatherNews().then(
            returnedNews => {
                return {
                    data: {
                        featureName: StringService.get('news'),
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
