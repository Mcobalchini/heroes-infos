require('dotenv').config({path: './variables.env'});
const {Client, Intents, MessageEmbed, MessageAttachment} = require('discord.js');
const bot = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});

exports.App = {
    setBotStatus: setBotStatus,
    bot: bot,
    log: log,
};
StringUtils.setup();
const {Commands} = require('./services/commands');
const {Network} = require('./services/network-service.js');
const {StringUtils} = require('./services/strings.js');

function setBotStatus(name, type) {
    bot.user.setActivity(name, {
        type: type,
        url: 'https://heroesofthestorm.com/'
    });
}

function log(text, error) {
    if (error) {
        process.stdout.write(text, 'utf-8', error);
        if (process.env.LOGS_CHANNEL_ID) {
            sendError(error)
        }
    } else {
        process.stdout.write(`${text}\n`);
    }
}

function sendError(errorMessage){
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LOGS_CHANNEL_ID);
    const reply = {
        featureName: StringUtils.get('bot.error'),
        data: errorMessage.message,
    }
    const embeds = []
    const embed = createEmbed(reply, null, null, null, 'attachment://fire.png');
    embed.setColor('#FE4F60');
    embeds.push(embed);
    channel?.send(assembleEmbedObject(embeds));
}

function fillFooter(attachment, embeds, footerObj) {

    embeds.forEach(it => {
        if (footerObj) {
            let footer = {
                text: StringUtils.get('data.from', footerObj.source),
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
            featureName: StringUtils.get("note"),
            message: StringUtils.get("hold.still.updating.data")
        }, null, null,null, 'attachment://download.png');

        embeds.push(updatingWarningEmbed);
    }
    return embeds;
}

function fillAttachments(embeds) {
    const files = new Map();
    files.set('footer.png', new MessageAttachment('images/footer.png', 'attachment://footer.png'));
    embeds.forEach(it => {
        addToMap(files, it.image?.url);
        addToMap(files, it.thumbnail?.url);
        addToMap(files, it.author?.iconURL);
    });
    return Array.from(files.values());
}

function removeAttachmenPrefix(text) {
    return text.replace('attachment://', '');
}

function addToMap(fileMap, property) {
    if (property != null) {
        const fileName = removeAttachmenPrefix(property);
        if (fileName.length > 0 && !fileMap.has(fileName))
            fileMap.set(fileName, new MessageAttachment(`images/${fileName}`, fileName));
    }
}

function assembleEmbedObject(embeds) {
    return {
        embeds,
        files: fillAttachments(embeds)
    };
}

async function handleResponse(args, receivedCommand, msg, isInteraction = false) {
    try {
        let reply = await Commands.handleCommand(args, receivedCommand, msg, isInteraction);
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

function periodicUpdateCheck(interval) {
    if (Network.isUpdateNeeded()) {
        setBotStatus('Updating', 'WATCHING')
        Network.updateData(() => setBotStatus('Heroes of the Storm', 'PLAYING'));
    }

    if (interval)
        setInterval(periodicUpdateCheck, 100000, false);

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

    let featureDesc = replyObject.featureDescription ? replyObject.featureDescription : '';
    let image = replyObject.image ? replyObject.image.replace('images/', 'attachment://') : 'attachment://footer.png';

    const embed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(replyObject.featureName)
        .setAuthor(author)
        .setImage(image)
        .setThumbnail(thumbnail)
        .setTimestamp();

        const attribute = Object.keys(replyObject).find(it => isNotReservedKey(it))

        if (Array.isArray(replyObject[attribute])) {
        let array = addItemIntoListIfNeeded(replyObject[attribute]);
        embed.addFields(array)
        embed.setDescription(featureDesc)
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

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    try {
        await interaction.deferReply();
        await handleResponse(interaction.options?.data?.map(it => it.value).join(' '),
            interaction.commandName.toString(),
            interaction,
            true
        )
    } catch (e) {
        log(`Error while handling response`, e);
    }
});

bot.once('ready', function () {
    StringUtils.setLanguage(StringUtils.EN_US);
    bot.updatedAt = StringUtils.get('not.updated.yet');
    setBotStatus('Heroes of the Storm', 'PLAYING');
    periodicUpdateCheck(true);
    log(`Application ready! - ${new Date()}\n`);
    Commands.isUpdateSlashCommandsNeeded().then(needed => {
        if (needed) {
            Commands.assembleSlashCommands().then(() => {
                Commands.assembleSlashCommands(true)
            });
        } else {
            log(`Update not needed\n`);
        }
    });

});

bot.on("guildCreate", guild => {
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.JOIN_SERVER_CHANNEL_ID);
    channel?.send(`Joined a new guild: ${guild.name}\n`);
});

bot.on("guildDelete", guild => {
    const channel = bot.channels?.cache?.find(channel => channel.id === process.env.LEAVE_SERVER_CHANNEL_ID);
    channel?.send(`Left a guild: ${guild.name}\n`);
});

bot.login(process.env.HEROES_INFOS_TOKEN);
