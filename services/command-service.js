const config = require('../config.json');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Collection, InteractionContextType } = require('discord.js');
const { ExternalDataService } = require('./external-data-service.js');
const { logger } = require('./log-service.js');
const { StringUtils } = require('../utils/string-utils.js');
const { FileUtils } = require('../utils/file-utils.js');
const { HeroNotFoundException } = require('../utils/exception-utils.js');
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
            logger.debug(`attempting to load command ${commandName}`);
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
        logger.debug(`started refreshing application (/) commands.`);

        try {
            for (let cmd of this.commandsMap.values()) {
                const commandHelpObject = cmd.help;
                const name = commandHelpObject.name;
                const description = commandHelpObject.hint;

                let commandSlashBuilder = new SlashCommandBuilder()
                    .setName(name.toLowerCase())
                    .setContexts([InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel])
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

            logger.debug(`successfully reloaded application / commands.`);
        } catch (error) {
            logger.error(`error while reloading / commands`, error);
        }
    },

    handleCommand: async function (interaction) {
        let response = {};
        const command = this.findCommand(interaction);
        if (command) {
            const arguments = interaction.options?.data?.map(it => it.value).join(' ');
            logger.info(`command (${interaction.commandName}) with params ${arguments} was called by ${interaction.member?.user?.globalName} at server ${interaction.member?.guild?.name}`);

            try {
                response = await command.run(arguments, interaction);
            } catch (e) {
                if (e instanceof HeroNotFoundException) {
                    response.featureDescription = StringUtils.get('hero.not.found', e.message);
                } else {
                    throw e;
                }
            }

            if (response.featureName == null) {
                response.featureName = command.help?.displayName ?? ' ';
            }
            
            if (command.help?.source) {
                response.footer = {
                    source: command.help?.source,
                    sourceImage: command.help?.sourceImage
                }
            }
        } else {    
            response.featureDescription = StringUtils.get('command.not.exists', interaction.commandName.toString());
        }

        return response;
    },

    handleAutocomplete: async function (interaction) {
        const command = this.findCommand(interaction);
        const arguments = interaction?.options?.getFocused();
        if (command) {
            const reply = command.autoComplete(arguments, interaction) || [];
            await interaction.respond(reply);
        }
    },

    findCommand: function (interaction) {
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
    },

    isNotReservedKey: function (key) {
        return key !== 'featureName' && key !== 'featureDescription' && key !== 'footer' && key !== 'image';
    },
};
