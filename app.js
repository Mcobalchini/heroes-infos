const {Client, Intents, MessageEmbed} = require("discord.js");
const config = require("./config.json");
const {Commands} = require("./services/commands");
require('dotenv').config({path: './variables.env'});
const {Network} = require('./services/network-service.js');
const {StringUtils} = require('./services/strings.js');
const prefix = config.prefix;
const bot = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
let msg = null;

bot.on("messageCreate", message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    msg = message;

    let receivedCommand = message.content.split(' ', 1)[0].substring(1);
    let args = message.content.substring(receivedCommand.toLowerCase().length + 2);

    try {
        handleResponse(args, receivedCommand);
    } catch (e) {
        process.stdout.write(`Exception: ${e.stack}\n`);
        msg.reply(StringUtils.get('exception.occurred', e))
    }
});

function handleResponse(args, receivedCommand) {
    let reply = Commands.handleCommand(args, receivedCommand, msg);
    let replyObject = {}
    let embeds = [];

    if (reply.image != null || reply.data != null) {
        let attachment = null;

        replyObject.files = ['images/footer.png']
        if (reply.image != null) {
            attachment = 'attachment://' + reply.image.replace('images/', '');
            replyObject.files.push(reply.image);
        }

        if (reply.data != null) {
            embeds.push(...createEmbeds(reply.data, reply.heroName, attachment));
            embeds[0].setThumbnail(attachment)
            if (attachment === null) {
                attachment = 'attachment://hots.png';
                replyObject.files.push('images/hots.png');
            }
            embeds.forEach(it => it.setAuthor(it.author.name ? it.author.name : "Heroes Infos", attachment, it.author.url))
        }
    } else {
        replyObject.content = reply;
    }

    if (Network.isUpdatingData) {
        let updatingWarningEmbed = createEmbeds({
            featureName: "Note",
            test: "i'm updating heroes data"
        }, "Heroes Infos", 'attachment://hots.png')[0];

        updatingWarningEmbed.setThumbnail('attachment://download.png');
        embeds.push(updatingWarningEmbed);
        if (replyObject.files != null) {
            replyObject.files.push('images/hots.png', 'images/download.png');
        } else {
            replyObject.files = ['images/footer.png', 'images/hots.png', 'images/download.png'];
        }
    }
    replyObject.embeds = embeds;
    msg.reply(replyObject);
}


function createEmbeds(object, heroName, attachment) {
    let embedHeroName = heroName ? heroName : ""
    let embedAttachment = attachment ? attachment : ""
    let embeds = [];

    Object.keys(object).forEach(function (key, _) {
        if (object[key].toString() === '[object Object]' && !Array.isArray(object[key])) {
            embeds.push(...createEmbeds(object[key], embedHeroName, embedAttachment))
        } else {
            if (key !== 'featureName' && key !== 'featureDescription') {
                let featureDesc = object.featureDescription ? object.featureDescription : "";
                const embed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(object.featureName)
                    .setAuthor(embedHeroName, embedAttachment, 'https://www.icy-veins.com/heroes/')
                    .setImage('attachment://footer.png');

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

function setBotStatus(name, type) {
    bot.user.setActivity(name, {
        type: type,
        url: "https://heroesofthestorm.com/"
    });
}

function periodicCheck() {
    if (Network.isUpdateNeeded()) {
        setBotStatus("Updating", "WATCHING")
        Network.updateData(() => setBotStatus("Heroes of the Storm", "PLAYING"));
    }
}

bot.on("ready", function () {
    StringUtils.defineCleanVal();
    periodicCheck();
    setInterval(periodicCheck, 100000);
    setBotStatus("Heroes of the Storm", "PLAYING");
    process.stdout.write(`Application ready! - ${new Date()}\n`);
});

bot.login(process.env.HEROES_INFOS_TOKEN);
