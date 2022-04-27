require('dotenv').config({path: './variables.env'});
const {Client, Intents, MessageEmbed} = require('discord.js');
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

function createResponse(reply) {
    const embeds = [];

    if (reply.authorImage != null || reply.data != null) {
        let attachment = null;

        if (reply.authorImage != null) {
            attachment = 'attachment://' + reply.authorImage.replace('images/', '');
        }

        if (reply.data != null) {
            embeds.push(...createEmbeds(reply.data, reply.heroName, reply.heroLink, attachment));
            embeds[0].setThumbnail(attachment)
            if (attachment === null) {
                attachment = 'attachment://hots.png';
            }
            embeds.forEach(it => {
                if (reply.footer) {
                    it.setFooter(StringUtils.get('data.from', reply.footer.source), reply.footer.sourceImage)
                }
                it.setTimestamp()
                it.setAuthor(it.author.name ? it.author.name : 'Heroes Infos', attachment, it.author.url);
            })
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
    const files = new Set();
    files.add('images/footer.png');
    embeds.forEach(it => {
        if (it.image?.url != null) {
            files.add(it.image.url.replace('attachment://', 'images/'));
        }
        if (it.thumbnail?.url != null) {
            files.add(it.thumbnail.url.replace('attachment://', 'images/'));
        }
        if (it.author?.iconURL != null) {
            files.add(it.author.iconURL.replace('attachment://', 'images/'));
        }
    })
    return Array.from(files).filter(it => it.length > 0);
}

async function handleResponse(args, receivedCommand, msg, isInteraction = false) {
    let reply = await Commands.handleCommand(args, receivedCommand, msg, isInteraction);
    let embeds = createResponse(reply);

    let replyObject = {
        embeds,
        files: fillAttachments(embeds)
    }

    if (msg.isCommand) {
        replyObject.ephemeral = true;
        msg.editReply(replyObject);
    } else {
        msg.reply(replyObject);
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
                let image = object.image ? object.image.replace('images/','attachment://') : 'attachment://footer.png';

                const embed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(object.featureName)
                    .setAuthor(embedHeroName, embedAttachment, embedHeroLink)
                    .setImage(image);

                if (Array.isArray(object[key])) {
                    embed.addFields(object[key])
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
    bot.updatedAt = StringUtils.get('not.updated.yet');
    setBotStatus('Heroes of the Storm', 'PLAYING');
    periodicUpdateCheck(true);
    process.stdout.write(`Application ready! - ${new Date()}\n`);
    Commands.assembleSlashCommands().then(() => {
        Commands.assembleSlashCommands(true).then(
            // Network.updateCommandsPermissions()
            //     .then(() => process.stdout.write('Updated commands permissions\n'))
            //     .catch(e =>  process.stdout.write(`Error while updating commands permissions\n`, e))
        )
    });
});

bot.login(process.env.HEROES_INFOS_TOKEN);
