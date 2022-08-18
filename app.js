require('dotenv').config({path: './variables.env'});
const {Client, EmbedBuilder, AttachmentBuilder, IntentsBitField} = require('discord.js');
const myIntents = new IntentsBitField();
myIntents.add(IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages);
const bot = new Client({ intents: myIntents });

exports.App = {
    setBotStatus: setBotStatus,
    bot: bot,
    log: log,
    writeFile: writeFile,
};
const {StringService} = require('./services/string-service.js');
const {CommandService} = require('./services/command-service.js');
const {Network} = require('./services/network-service.js');
const {FileService} = require("./services/file-service");
StringService.setup();

function setBotStatus(name, type) {
    bot.user.setActivity(name, {
        type: type,
        url: 'https://heroesofthestorm.com/'
    });
}

function log(text, error) {
    try {
        const date = new Date().toLocaleString("pt-BR");
        if (error) {
            process.stdout.write(`[${date}] - ${text} - [ERROR]: ${error} \n`);
            if (process.env.LOGS_CHANNEL_ID) {
                sendError(error)
            }
        } else {
            process.stdout.write(`[${date}] - ${text}\n`);
        }
    } catch (e) {
        process.stdout.write(`error while sending error ${e.message}\n`);
    }
}

function sendError(errorMessage){
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LOGS_CHANNEL_ID);
    const reply = {
        featureName: StringService.get('bot.error'),
        data: errorMessage.message,
    }
    const embed = createEmbed(reply, null, null, null, 'attachment://fire.png');
    embed.setColor('#FE4F60');
    channel?.send(assembleEmbedObject(embed));
}

function fillFooter(attachment, embeds, footerObj) {

    embeds.forEach(it => {
        if (footerObj) {
            let footer = {
                text: StringService.get('data.from', footerObj.source),
                iconURL: footerObj.sourceImage
            }
            it.setFooter(footer)
        }
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
            embeds.push(...createEmbeds(reply.data, reply.heroName, reply.heroLink, attachment));
            embeds[0].setThumbnail(attachment);
            fillFooter(attachment, embeds, reply.footer);
        }
    }

    if (Network.isUpdatingData) {
        let updatingWarningEmbed = createEmbed({
            featureName: StringService.get('note'),
            message: StringService.get('hold.still.updating.data')
        }, null, null,null, 'attachment://download.png');

        embeds.push(updatingWarningEmbed);
    }
    return embeds;
}

function fillAttachments(embeds) {
    const files = new Map();
    files.set('footer.png', new AttachmentBuilder('images/footer.png', 'attachment://footer.png'));
    embeds.forEach(it => {
        addToMap(files, it.data.image?.url);
        addToMap(files, it.data.thumbnail?.url);
        addToMap(files, it.data.author?.iconURL);
    });
    return Array.from(files.values());
}

function removeAttachmenPrefix(text) {
    return text.replace('attachment://', '');
}

function addToMap(fileMap, property) {
    if (property != null) {
        const fileName = removeAttachmenPrefix(property);
        if (!fileName.includes('http') && fileName.length > 0 && !fileMap.has(fileName))
            fileMap.set(fileName, new AttachmentBuilder(`images/${fileName}`, fileName));
    }
}

function assembleEmbedObject(embeds) {
    if (!Array.isArray(embeds)) {
        embeds = [embeds]
    }
    return {
        embeds,
        files: fillAttachments(embeds)
    };
}

async function handleResponse(args, receivedCommand, msg) {
    try {
        let reply = await CommandService.handleCommand(args, receivedCommand, msg);
        let replyObject = assembleEmbedObject(createResponse(reply));

        if (msg.isCommand) {
            replyObject.ephemeral = true;
            msg.editReply(replyObject).catch(e => {
                log(`Error while responding`, e)
            })
        } else {
            msg.reply(replyObject);
        }
    } catch (e) {
        log(`Error while responding`, e)
    }

}

function periodicUpdateCheck() {
    if (Network.isUpdateNeeded()) {
        setBotStatus('Updating', 'WATCHING')
        Network.updateData().then(() => setBotStatus('Heroes of the Storm', 'PLAYING'));
    }
}

function addItemIntoListIfNeeded(array) {
    if (array.length % 3 !== 0 && array.every(it => it.inline)) {
        array.push(
            {
                name: `_ _`,
                value: `|| ||`,
                inline: true
            }
        )
    }
    return array;
}

function createEmbed(replyObject, authorName, authorUrl, authorIcon, thumbnail) {
    authorName = authorName ? authorName : 'Heroes Infos Bot'
    authorUrl = authorUrl ? authorUrl : 'https://www.icy-veins.com/heroes/'
    authorIcon = authorIcon ? authorIcon : 'attachment://hots.png'

    const author = {
        name: authorName,
        url: authorUrl,
        iconURL: authorIcon
    }

    let featureDesc = replyObject.featureDescription ? replyObject.featureDescription : '_ _';
    let image = replyObject.image ? replyObject.image.replace('images/', 'attachment://') : 'attachment://footer.png';

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(replyObject.featureName)
        .setAuthor(author)
        .setImage(image)
        .setThumbnail(thumbnail)
        .setTimestamp();

    const attribute = Object.keys(replyObject).find(it => isNotReservedKey(it))

    if (Array.isArray(replyObject[attribute])) {
        let array = addItemIntoListIfNeeded(replyObject[attribute]);
        embed.addFields(array);
        embed.setDescription(featureDesc);
    } else {
        let desc = replyObject[attribute]
        embed.setDescription(desc ? desc : featureDesc)
    }

    return embed;
}

function createEmbeds(replyObject, authorName, authorUrl, authorIcon) {
    authorName = authorName ? authorName : 'Heroes Infos Bot'
    authorUrl = authorUrl ? authorUrl : 'https://www.icy-veins.com/heroes/'
    authorIcon = authorIcon ? authorIcon : 'attachment://hots.png'
    let embeds = [];

    Object.keys(replyObject).forEach(function (key, _) {
        const attribute = replyObject[key];
        if (isObject(replyObject, key)) {
            embeds.push(createEmbed(attribute, authorName, authorUrl, authorIcon))
        } else if (isNotReservedKey(key)) {
            embeds.push(createEmbed(replyObject, authorName, authorUrl, authorIcon));
        }
    });
    return embeds;
}

function isObject(object, key) {
    return object[key].toString() === '[object Object]'
        && !Array.isArray(object[key]) && key !== 'footer';
}

function isNotReservedKey(key) {
    return key !== 'featureName' && key !== 'featureDescription' && key !== 'footer' && key !== 'image';
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
        }
    ]
}

function writeFile (path, obj) {
    FileService.writeFile(path, JSON.stringify(obj), (e) => {
        if (e != null) {
            log(`error while writing file ${path}`, e);
        }
    });
}

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    try {
        await interaction.deferReply();
        await handleResponse(interaction.options?.data?.map(it => it.value).join(' '),
            interaction.commandName.toString(),
            interaction
        );
    } catch (e) {
       this.log(`Error while handling response`, e);
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
    const embed = createEmbed( {
            featureName: StringService.get('joined.new.server'),
            guildData: assembleGuildData(guild)
        }, null, null, null, guild.iconURL());
    channel?.send(assembleEmbedObject(embed));
});

bot.on('guildDelete', guild => {
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    if (guild?.name) {
        const embed = createEmbed({
            featureName: StringService.get('left.server'),
            guildData: assembleGuildData(guild)
        }, null, null, null, guild.iconURL());
        channel?.send(assembleEmbedObject(embed));
    }
});

bot.login(process.env.HEROES_INFOS_TOKEN);
