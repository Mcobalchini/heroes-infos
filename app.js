require('dotenv').config({path: './variables.env'});
const {Client, Intents, MessageEmbed, MessageAttachment} = require('discord.js');
const bot = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});

exports.App = {
    setBotStatus: setBotStatus,
    bot: bot,
};

const {Commands} = require('./services/commands');
const {Network} = require('./services/network-service.js');
const {StringUtils} = require('./services/strings.js');

function setBotStatus(name, type) {
    bot.user.setActivity(name, {
        type: type,
        url: 'https://heroesofthestorm.com/'
    });
}

function fillAuthorAndFooter(attachment, embeds, reply) {

    if (attachment === null) {
        attachment = 'attachment://hots.png';
    }

    embeds.forEach(it => {
        let author = {
            name: it.author.name ? it.author.name : 'Heroes Infos',
            url: it.author.url,
            iconURL: attachment
        }

        if (reply.footer) {
            let footer = {
                text: StringUtils.get('data.from', reply.footer.source),
                iconURL: reply.footer.sourceImage
            }
            it.setFooter(footer)
        }
        it.setTimestamp()
        it.setAuthor(author);
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
            fillAuthorAndFooter(attachment, embeds, reply);
        }
    }

    if (Network.isUpdatingData) {
        let updatingWarningEmbed = createEmbeds({
            featureName: 'Note',
            message: StringUtils.get("hold.still.updating.data")
        }, 'Heroes Infos', null,'attachment://hots.png')[0];

        updatingWarningEmbed.setThumbnail('attachment://download.png');
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

function removePrefix(text) {
    return text.replace('attachment://', '');
}

function addToMap(fileMap, property) {
    if (property != null) {
        const thumb = removePrefix(property);
        if (thumb.length > 0 && !fileMap.has(thumb))
            fileMap.set(thumb, new MessageAttachment(`images/${thumb}`, thumb));
    }
}

async function handleResponse(args, receivedCommand, msg, isInteraction = false) {
    try {
        let reply = await Commands.handleCommand(args, receivedCommand, msg, isInteraction);
        let embeds = createResponse(reply);

        let replyObject = {
            embeds,
            files: fillAttachments(embeds)
        }

        if (msg.isCommand) {
            replyObject.ephemeral = true;
            msg.editReply(replyObject).catch(e => {
                process.stdout.write(`Error while responding ${e.message}\n`);
            })
        } else {
            msg.reply(replyObject);
        }
    } catch (e) {
        process.stdout.write(`Error while responding ${e.message}\n`);
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

function createEmbeds(object, heroName, heroLink, attachment) {
    let embedHeroName = heroName ? heroName : ''
    let embedHeroLink = heroLink ? heroLink : 'https://www.icy-veins.com/heroes/'
    let embedAttachment = attachment ? attachment : ''
    let embeds = [];

    Object.keys(object).forEach(function (key, _) {
        if (isObject(object, key)) {
            embeds.push(...createEmbeds(object[key], embedHeroName, embedHeroLink, embedAttachment))
        } else {
            if (isNotReservedKey(key)) {
                let featureDesc = object.featureDescription ? object.featureDescription : '';
                let image = object.image ? object.image.replace('images/', 'attachment://') : 'attachment://footer.png';

                let author = {
                    name: embedHeroName,
                    url: embedHeroLink,
                    iconURL: embedAttachment
                }

                const embed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(object.featureName)
                    .setAuthor(author)
                    .setImage(image);

                if (Array.isArray(object[key])) {
                    let array = addItemIntoListIfNeeded(object[key]);
                    embed.addFields(array)
                    embed.setDescription(featureDesc)
                } else {
                    let desc = object[key]
                    embed.setDescription(desc ? desc : featureDesc)
                }

                embeds.push(embed);
            }
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
        process.stdout.write(`Exception: ${e.stack}\n`);
    }
});

bot.once('ready', function () {
    StringUtils.setup();
    StringUtils.setLanguage(StringUtils.EN_US);
    bot.updatedAt = StringUtils.get('not.updated.yet');
    setBotStatus('Heroes of the Storm', 'PLAYING');
    periodicUpdateCheck(true);
    process.stdout.write(`Application ready! - ${new Date()}\n`);
    Commands.isUpdateSlashCommandsNeeded().then(needed => {
        if (needed) {
            Commands.assembleSlashCommands().then(() => {
                Commands.assembleSlashCommands(true)
            });
        } else {
            process.stdout.write(`Update not needed\n`);
        }
    });

});

bot.on("guildCreate", guild => {
    process.stdout.write(`Joined a new guild: ${guild.name}\n`);
});

bot.on("guildDelete", guild => {
    process.stdout.write(`Left a guild: ${guild.name}\n`);
});

bot.login(process.env.HEROES_INFOS_TOKEN);
