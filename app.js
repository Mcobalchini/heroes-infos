require('dotenv').config({ path: './variables.env' });
const {
    Client,
    IntentsBitField,
    ActivityType
} = require('discord.js');
const myIntents = new IntentsBitField();
myIntents.add(IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages);
const bot = new Client({ intents: myIntents });

exports.App = {
    setBotStatus: setBotStatus,
    bot: bot,
    delay: delay = ms => new Promise(res => setTimeout(res, ms))
};

const { StringUtils } = require('./utils/string-utils.js');
StringUtils.setup();

const { CommandService } = require('./services/command-service.js');
const { logger } = require('./services/log-service.js');
const { ExternalDataService } = require('./services/external-data-service.js');
const { EmbedUtils } = require('./utils/embed-utils');

bot.commands = CommandService.assembleCommands();

function setBotStatus(name, type) {
    const enumType = type === 'WATCHING' ? ActivityType.Watching : ActivityType.Playing;
    bot.user.setPresence({
        activities: [{ name: name, type: enumType }],
        status: 'https://heroesofthestorm.com/'
    });
}

function createResponse(reply) {
    const embeds = [...EmbedUtils.createEmbeds(reply)];

    if (ExternalDataService.isUpdatingData) {
        let updatingWarningEmbed = EmbedUtils.createSingleEmbed({
            featureName: StringUtils.get('note'),
            featureDescription: StringUtils.get('hold.still.updating.data'),
            thumbnail: 'images/download.png'
        });
        embeds.push(updatingWarningEmbed);
    }
    return embeds;
}

async function handleResponse(interaction) {
    if (interaction.isAutocomplete()) {
        CommandService.handleAutocomplete(interaction);
    } else {
        const commandReply = await CommandService.handleCommand(interaction);
        const embeds = createResponse(commandReply);
        const response = EmbedUtils.assembleEmbedObject(embeds);
        response.ephemeral = true;
        interaction.editReply(response).catch(e => {
            logger.error(`error while responding`, e);
        });
    }
}

function assembleGuildData(guild) {
    return [
        {
            name: StringUtils.get('server.name'),
            value: guild?.name ?? `_ _`,
            inline: false
        },
        {
            name: StringUtils.get('server.id'),
            value: guild?.id?.toString() ?? '0',
            inline: true
        },
        {
            name: StringUtils.get('server.member.count'),
            value: guild?.memberCount?.toString() ?? '0',
            inline: true
        },
        {
            name: StringUtils.get('server.owner.id'),
            value: guild?.ownerId?.toString() ?? '_ _',
            inline: true
        }
    ]
}

bot.on('interactionCreate', async interaction => {
    if (isSupportedInteraction(interaction)) {
        await handleInteraction(interaction);
    }
});

function isSupportedInteraction(interaction) {
    return interaction.isCommand() || interaction.isAutocomplete();
}

async function handleInteraction(interaction) {
    try {
        if (interaction.isCommand()) {
            await interaction.deferReply();
        }
        await handleResponse(interaction);
    } catch (error) {
        logger.error('Error while handling response', error);
    }
}

bot.once('ready', function () {
    logger.info(`application ready!`);
    bot.updatedAt = StringUtils.get('not.updated.yet');
    setBotStatus('Heroes of the Storm', 'PLAYING');
    ExternalDataService.periodicUpdateCheck(true);
    CommandService.isUpdateSlashCommandsNeeded().then(needed => {
        if (needed) {
            CommandService.updateSlashCommands();
        } else {
            logger.info(`slash commands update not needed`);
        }
    });
});

bot.on('guildCreate', guild => {
    logger.info(`bot was added to server ${guild.name}`);
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.JOIN_SERVER_CHANNEL_ID);
    const embed = EmbedUtils.createSingleEmbed({
        featureName: StringUtils.get('joined.new.server'),
        data: {
            guildData: assembleGuildData(guild),
        },
        thumbnail: guild.iconURL()
    });
    channel?.send(EmbedUtils.assembleEmbedObject(embed));
});

bot.on('guildDelete', guild => {
    logger.info(`bot was removed from server ${guild.name}`);
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    if (guild?.name) {
        const embed = EmbedUtils.createSingleEmbed({
            featureName: StringUtils.get('left.server'),
            data: {
                guildData: assembleGuildData(guild),
            },
            thumbnail: guild.iconURL()
        });
        channel?.send(EmbedUtils.assembleEmbedObject(embed));
    }
});

bot.login(process.env.HEROES_INFOS_TOKEN).then(() =>
    logger.info('successfully logged in')
);
