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
    const embeds = [];

    if (reply.authorImage != null || reply.data != null) {
        let attachment = null;

        if (reply.authorImage != null) {
            attachment = 'attachment://' + reply.authorImage.replace('images/', '');
        }

        if (reply.data != null) {
            embeds.push(...EmbedUtils.createEmbeds(reply.data, reply.authorName, reply.authorUrl, attachment));
            embeds[0].setThumbnail(attachment);
            EmbedUtils.fillFooter(attachment, embeds, reply.footer);
        }
    }

    if (ExternalDataService.isUpdatingData) {
        let updatingWarningEmbed = EmbedUtils.createEmbed({
            featureName: StringUtils.get('note'),
            message: StringUtils.get('hold.still.updating.data')
        }, null, null, null, 'attachment://download.png');

        embeds.push(updatingWarningEmbed);
    }
    return embeds;
}

async function handleResponse(interaction) {
    try {
        if (interaction.isAutocomplete()) {
            CommandService.handleAutocomplete(interaction);
        } else {
            const reply = await CommandService.handleCommand(interaction);
            const embeds = createResponse(reply);
            const replyObject = EmbedUtils.assembleEmbedObject(embeds);
            replyObject.ephemeral = true;
            interaction.editReply(replyObject).catch(e => {
                logger.error(`error while responding`, e);
            });
        }
    } catch (e) {
        logger.error(`error while responding`, e);
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
        logError('Error while handling response', error);
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
    const embed = EmbedUtils.createEmbed({
        featureName: StringUtils.get('joined.new.server'),
        guildData: assembleGuildData(guild)
    }, null, null, null, guild.iconURL());
    channel?.send(EmbedUtils.assembleEmbedObject(embed));
});

bot.on('guildDelete', guild => {
    logger.info(`bot was removed from server ${guild.name}`);
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    if (guild?.name) {
        const embed = EmbedUtils.createEmbed({
            featureName: StringUtils.get('left.server'),
            guildData: assembleGuildData(guild)
        }, null, null, null, guild.iconURL());
        channel?.send(EmbedUtils.assembleEmbedObject(embed));
    }
});

bot.login(process.env.HEROES_INFOS_TOKEN).then(() =>
    logger.info('successfully logged in')
);
