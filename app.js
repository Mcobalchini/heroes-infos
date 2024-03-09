require('dotenv').config({path: './variables.env'});
const HOUR = 1000 * 60 * 60;
const PERIOD = HOUR * 4;
const {
    Client,
    IntentsBitField,
    ActivityType
} = require('discord.js');
const myIntents = new IntentsBitField();
myIntents.add(IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages);
const bot = new Client({intents: myIntents});

exports.App = {
    setBotStatus: setBotStatus,
    bot: bot,
    log: log,
    delay: delay = ms => new Promise(res => setTimeout(res, ms))
};
const {StringService} = require('./services/string-service.js');
StringService.setup();

const {CommandService} = require('./services/command-service.js');
const {Network} = require('./services/network-service.js');
const {EmbedService} = require('./services/embed-service');
const {App} = require("./app");
bot.commands = CommandService.assembleCommands();

function setBotStatus(name, type) {
    const enumType = type === 'WATCHING' ? ActivityType.Watching : ActivityType.Playing;
    bot.user.setPresence({
        activities: [{name: name, type: enumType}],
        status: 'https://heroesofthestorm.com/'
    });
}

function log(text, error) {
    try {
        const date = new Date().toLocaleString("pt-BR");
        if (error) {
            process.stdout.write(`[${date}] - ${text} - [ERROR]: ${error} \n`);
            if (process.env.ERRORS_CHANNEL_ID) {
                sendError(error);
            }
        } else {
            const log = `[${date}] - ${text}\n`;
            process.stdout.write(log);
            if (process.env.LOGS_CHANNEL_ID) {
                sendLog(log);
            }
        }
    } catch (e) {
        process.stdout.write(`error while sending error ${e.message}\n`);
    }
}

function sendLog(logMessage) {
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LOGS_CHANNEL_ID);
    channel?.send(logMessage);
}

function sendError(errorMessage) {
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.ERRORS_CHANNEL_ID);
    const reply = {
        featureName: StringService.get('bot.error'),
        data: errorMessage.message,
    }
    const embed = EmbedService.createEmbed(reply, null, null, null, 'attachment://fire.png');
    embed.setColor('#FE4F60');
    channel?.send(EmbedService.assembleEmbedObject(embed));
}

function createResponse(reply) {
    const embeds = [];

    if (reply.authorImage != null || reply.data != null) {
        let attachment = null;

        if (reply.authorImage != null) {
            attachment = 'attachment://' + reply.authorImage.replace('images/', '');
        }

        if (reply.data != null) {
            embeds.push(...EmbedService.createEmbeds(reply.data, reply.authorName, reply.authorUrl, attachment));
            embeds[0].setThumbnail(attachment);
            EmbedService.fillFooter(attachment, embeds, reply.footer);
        }
    }

    if (Network.isUpdatingData) {
        let updatingWarningEmbed = EmbedService.createEmbed({
            featureName: StringService.get('note'),
            message: StringService.get('hold.still.updating.data')
        }, null, null, null, 'attachment://download.png');

        embeds.push(updatingWarningEmbed);
    }
    return embeds;
}

async function handleResponse(interaction) {
    try {
        const reply = await CommandService.handleCommand(interaction);
        const embeds = createResponse(reply);
        const replyObject = EmbedService.assembleEmbedObject(embeds);
        replyObject.ephemeral = true;
        interaction.editReply(replyObject).catch(e => {
            log(`Error while responding`, e);
        });
    } catch (e) {
        log(`Error while responding`, e);
    }
}

function periodicUpdateCheck(interval) {
    log('checking if update needed');
    if (Network.isUpdateNeeded() || Network.isRotationUpdateNeeded()) {
        const updateType = Network.isRotationUpdateNeeded() ? 'rotation' : '';
        setBotStatus(`Updating ${updateType}`, 'WATCHING');
        Network.updateData(updateType).then(() => setBotStatus('Heroes of the Storm', 'PLAYING'));
    }
    if (interval)
        setInterval(periodicUpdateCheck, PERIOD, false);
}

function assembleGuildData(guild) {
    return [
        {
            name: StringService.get('server.name'),
            value: guild?.name ?? `_ _`,
            inline: false
        },
        {
            name: StringService.get('server.id'),
            value: guild?.id?.toString() ?? '0',
            inline: true
        },
        {
            name: StringService.get('server.member.count'),
            value: guild?.memberCount?.toString() ?? '0',
            inline: true
        },        
        {
            name: StringService.get('server.owner.id'),
            value: guild?.ownerId?.toString() ?? '_ _',
            inline: true
        }
    ]
}

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    try {
        await interaction.deferReply();
        await handleResponse(interaction);
    } catch (e) {
        log(`Error while handling response`, e);
    }
});

bot.once('ready', function () {
    bot.updatedAt = StringService.get('not.updated.yet');
    setBotStatus('Heroes of the Storm', 'PLAYING');
    periodicUpdateCheck(true);
    log(`Application ready!`);
    CommandService.isUpdateSlashCommandsNeeded().then(needed => {
        if (needed) {
            CommandService.updateSlashCommands();
        } else {
            log(`Slash commands update not needed`);
        }
    });
});

bot.on('guildCreate', guild => {
    log(`Owner id ${guild.ownerId}`);
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.JOIN_SERVER_CHANNEL_ID);
    const embed = EmbedService.createEmbed({
        featureName: StringService.get('joined.new.server'),
        guildData: assembleGuildData(guild)
    }, null, null, null, guild.iconURL());
    channel?.send(EmbedService.assembleEmbedObject(embed));
});

bot.on('guildDelete', guild => {
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    if (guild?.name) {
        const embed = EmbedService.createEmbed({
            featureName: StringService.get('left.server'),
            guildData: assembleGuildData(guild)
        }, null, null, null, guild.iconURL());
        channel?.send(EmbedService.assembleEmbedObject(embed));
    }
});

bot.login(process.env.HEROES_INFOS_TOKEN).then(() =>
    App.log("Successfully logged in")
);
