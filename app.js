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
const { StringService } = require('./services/string-service.js');
StringService.setup();

const { CommandService } = require('./services/command-service.js');
const { LogService } = require('./services/log-service.js');
const { ExternalDataService } = require('./services/external-data-service.js');
const { EmbedService } = require('./services/embed-service');
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
            embeds.push(...EmbedService.createEmbeds(reply.data, reply.authorName, reply.authorUrl, attachment));
            embeds[0].setThumbnail(attachment);
            EmbedService.fillFooter(attachment, embeds, reply.footer);
        }
    }

    if (ExternalDataService.isUpdatingData) {
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
            LogService.log(`Error while responding`, e);
        });
    } catch (e) {
        LogService.log(`Error while responding`, e);
    }
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
        LogService.log(`Error while handling response`, e);
    }
});

bot.once('ready', function () {
    LogService.setUp(
        bot.channels?.cache?.find(channel => channel.id === process.env.LOGS_CHANNEL_ID),
        bot.channels?.cache?.find(channel => channel.id === process.env.ERRORS_CHANNEL_ID)
    );
    LogService.log(`Application ready!`);
    bot.updatedAt = StringService.get('not.updated.yet');
    setBotStatus('Heroes of the Storm', 'PLAYING');
    ExternalDataService.periodicUpdateCheck(true);    
    CommandService.isUpdateSlashCommandsNeeded().then(needed => {
        if (needed) {
            CommandService.updateSlashCommands();
        } else {
            LogService.log(`Slash commands update not needed`);
        }
    });
});

bot.on('guildCreate', guild => {
    LogService.log(`Owner id ${guild.ownerId}`);
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
    LogService.log("Successfully logged in")
);
