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
                const commandHelpObject = cmd.help;
                const name = commandHelpObject.name;
                const description = commandHelpObject.hint;

                let commandSlashBuilder = new SlashCommandBuilder()
                    .setName(name.toLowerCase())
                    .setDMPermission(true)
                    .setDescription(description.substring(0, 100));

                commandHelpObject.subCommands?.forEach(subcommand => {
                    const currCommand =
                        commandSlashBuilder.addSubcommand(it =>
                            it.setName(subcommand.name)
                                .setDescription(StringUtils.getWithoutNewLine(subcommand.description).toLowerCase()
                                )
                        );
                    if (subcommand.paramOptions) {
                        const options = subcommand.paramOptions.map(param => {
                            return {
                                name: StringUtils.getWithoutNewLine(param.description).toLowerCase(),
                                value: param.name
                            }
                        });
                        currCommand.addStringOption(option =>
                            option.setName('option')
                                .setDescription('select one')
                                .setRequired(subcommand.requiredParam)
                                .addChoices(...options)
                        );
                    } else {
                        currCommand.addStringOption(option =>
                            option.setName(subcommand.argumentName.toLowerCase())
                                .setDescription(subcommand.argumentDescription.toLowerCase())
                                .setRequired(subcommand.requiredParam)
                        );
                    }
                });

                if (commandHelpObject.acceptParams) {
                    if (commandHelpObject.paramOptions) {
                        const options = commandHelpObject.paramOptions.map(param => {
                            return {
                                name: StringUtils.getWithoutNewLine(param.description).toLowerCase(),
                                value: param.name
                            }
                        });
                        commandSlashBuilder.addStringOption(option =>
                            option.setName('option')
                                .setDescription('select one')
                                .setRequired(commandHelpObject.requiredParam)
                                .addChoices(...options)
                        );
                    } else {
                        commandSlashBuilder.addStringOption(option =>
                            option.setName(commandHelpObject.argumentName.toLowerCase())
                                .setDescription(commandHelpObject.argumentDescription.toLowerCase())
                                .setRequired(commandHelpObject.requiredParam)
                                .setAutocomplete(cmd.autoComplete != null));
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
        let reply;
        const command = this.findCommand(interaction)
        if (command) {
            const arguments = interaction.options?.data?.map(it => it.value).join(' ');
            LogService.log(`Command (${interaction.commandName}) with params ${arguments} was called by ${interaction.member?.user?.globalName} at server ${interaction.member?.guild?.name}`);
            reply = await command.run(arguments, interaction);
        } else {
            reply = StringUtils.get('command.not.exists', interaction.commandName.toString());
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

    handleAutocomplete: async function (interaction) {
        const command = this.findCommand(interaction);
        const arguments = interaction?.options?.getFocused();
        if (command) {
            const reply = command.autoComplete(arguments, interaction) || [];
            await interaction.respond(reply);
        }
    },

    findCommand: function(interaction) {
        const receivedCommand = interaction.commandName.toString();
        const command = this.commandsMap.get(receivedCommand);
        if (this.isCommandAllowed(interaction, command)) {
            return command;
        } else {
            return null;
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
