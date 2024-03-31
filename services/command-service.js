const config = require('../config.json');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Collection } = require('discord.js');
const { ExternalDataService } = require('./external-data-service.js');
const { LogService } = require('./log-service.js');
const { StringUtils } = require('../utils/string-utils.js');
const { FileUtils } = require('../utils/file-utils.js');
const COMMAND_FOLDER = './commands'

exports.CommandService = {
    commandsMap: null,
    assembleCommands: function (ignoreHelp) {
        const commands = FileUtils.openDir(COMMAND_FOLDER).map(it => {
            if (it.endsWith('.js')) {
                return it
            } else {
                const dir = FileUtils.openDir(`${COMMAND_FOLDER}/${it}`)
                return dir.filter(filter => filter.endsWith('.js')).map(cmd => `${it}/${cmd}`)
            }
        }).flat()


        const commandsMap = new Collection();
        for (const file of commands) {
            const commandName = file.split('.')[0];
            if (commandName === 'Help' && ignoreHelp) {
                continue;
            }
            const command = require(`.${COMMAND_FOLDER}/${file}`);
            console.log(`Attempting to load command ${commandName}`);
            commandsMap.set(command.help.name.toLowerCase(), command);
        }
        this.commandsMap = commandsMap;
        return commandsMap
    },

    isUpdateSlashCommandsNeeded: async function () {
        const apiCommandsSize = await ExternalDataService.getApiCommandsSize();
        return process.env.UPDATE_COMMANDS === 'true' || (this.commandsMap.size !== apiCommandsSize);
    },

    updateSlashCommands: async function () {
        if (process.env.RENEW_COMMANDS === 'true') {
            await App.bot.application.commands.set([]);
        }
        await this.assembleSlashCommands();
    },

    assembleSlashCommands: async function () {
        LogService.log(`Started refreshing application (/) commands.`);

        try {
            for (let cmd of this.commandsMap.values()) {
                const it = cmd.help;
                const name = it.name;
                const description = it.hint;

                let commandSlashBuilder = new SlashCommandBuilder()
                    .setName(name.toLowerCase())
                    .setDMPermission(true)
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
                        commandSlashBuilder.addStringOption(option =>
                            option.setName(it.argumentName.toLowerCase())
                                .setDescription(it.argumentDescription.toLowerCase())
                                .setRequired(it.requiredParam));
                    }
                }
                await ExternalDataService.postSlashCommandsToAPI(commandSlashBuilder);
            }

            LogService.log(`Successfully reloaded application / commands.`);
        } catch (error) {
            LogService.log(`Error while reloading / commands`, error);
        }
    },

    handleCommand: async function (interaction) {
        const receivedCommand = interaction.commandName.toString();
        const command = this.commandsMap.get(receivedCommand);
        const args = interaction.options?.data?.map(it => it.value).join(' ');
        let reply;
        if (this.isCommandAllowed(interaction, command)) {
            LogService.log(`Command (${receivedCommand}) with params ${args} was called by ${interaction.member?.guild?.name}`);
            reply = await command.run(args, interaction);
        } else {
            reply = StringUtils.get('command.not.exists', receivedCommand);
        }
        if (command && command.help?.source) {
            reply.footer = {
                source: command.help?.source,
                sourceImage: command.help?.sourceImage
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

    isCommandAllowed(msg, command) {
        if (command.help.defaultPermission) {
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
