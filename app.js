require('dotenv').config({path: './variables.env'});
const {Client, Intents, MessageEmbed} = require('discord.js');
const bot = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
const config = require('./config.json');
const prefix = config.prefix;

exports.App = {
    setBotStatus: setBotStatus,
    bot: bot,
};

const {Commands} = require('./services/commands');
const {Network} = require('./services/network-service.js');
const {StringUtils} = require('./services/strings.js');
let msg = null;

function setBotStatus(name, type) {
    bot.user.setActivity(name, {
        type: type,
        url: 'https://heroesofthestorm.com/'
    });
}

function createResponse(reply, replyObject) {
    const embeds = [];

    if (reply.image != null || reply.data != null) {
        let attachment = null;

        replyObject.files = ['images/footer.png']
        if (reply.image != null) {
            attachment = 'attachment://' + reply.image.replace('images/', '');
            replyObject.files.push(reply.image);
        }

        if (reply.data != null) {
            embeds.push(...createEmbeds(reply.data, reply.heroName, reply.heroLink, attachment));
            embeds[0].setThumbnail(attachment)
            if (attachment === null) {
                attachment = 'attachment://hots.png';
                replyObject.files.push('images/hots.png');
            }
            embeds.forEach(it => {
                    it.setTimestamp()
                    it.setAuthor(it.author.name ? it.author.name : 'Heroes Infos', attachment, it.author.url);
                }
            )
        }
    } else {
        replyObject.content = reply;
    }

    if (Network.isUpdatingData) {
        let updatingWarningEmbed = createEmbeds({
            featureName: 'Note',
            test: StringUtils.get("hold.still.updating.data")
        }, 'Heroes Infos', 'attachment://hots.png')[0];

        updatingWarningEmbed.setThumbnail('attachment://download.png');
        embeds.push(updatingWarningEmbed);
        if (replyObject.files != null) {
            replyObject.files.push('images/hots.png', 'images/download.png');
        } else {
            replyObject.files = ['images/footer.png', 'images/hots.png', 'images/download.png'];
        }
    }
    return embeds;
}

async function handleResponse(args, receivedCommand, msg, isInteraction = false) {
    let reply = await Commands.handleCommand(args, receivedCommand, msg, isInteraction);
    let replyObject = {}

    replyObject.embeds = createResponse(reply, replyObject);

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
        if (object[key].toString() === '[object Object]' && !Array.isArray(object[key])) {
            embeds.push(...createEmbeds(object[key], embedHeroName, embedHeroLink, embedAttachment))
        } else {
            if (key !== 'featureName' && key !== 'featureDescription' && key !== 'footer') {
                let featureDesc = object.featureDescription ? object.featureDescription : '';
                const embed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(object.featureName)
                    .setAuthor(embedHeroName, embedAttachment, embedHeroLink)
                    .setImage('attachment://footer.png');

                if (Array.isArray(object[key])) {
                    embed.addFields(object[key])
                    embed.setDescription(featureDesc)
                } else {
                    let desc = object[key]
                    embed.setDescription(desc ? desc : featureDesc)
                }

                if(object['footer']) {
                    embed.setFooter(StringUtils.get('data.from.icy.veins'),
                        'https://static.icy-veins.com/images/common/favicon-high-resolution.png');
                }
                embeds.push(embed);
            }
        }
    });
    return embeds;
}

bot.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content.startsWith(prefix) || message.mentions.has(bot.user.id)) {
        msg = message;

        if (message.mentions.has(bot.user.id)) {
            msg.reply(StringUtils.get("mention.me", config.prefix));
            return;
        }

        let receivedCommand = message.content.split(' ', 1)[0].substring(1);
        let args = message.content.substring(receivedCommand.toLowerCase().length + 2);

        try {
            handleResponse(args, receivedCommand, msg);
        } catch (e) {
            process.stdout.write(`Exception: ${e.stack}\n`);
            msg.reply(StringUtils.get('exception.occurred', e))
        }
    }
});

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
    bot.updatedAt = StringUtils.get('not.updated.yet');
    StringUtils.setup();
    setBotStatus('Heroes of the Storm', 'PLAYING');
    periodicUpdateCheck(true);
    process.stdout.write(`Application ready! - ${new Date()}\n`);
    Commands.assembleSlashCommands().then(() => {
        Commands.assembleSlashCommands(true).then(Network.updateCommandsPermissions())
    });
});

bot.login(process.env.HEROES_INFOS_TOKEN);
