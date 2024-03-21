const { StringService } = require('../services/string-service');
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const config = require('../config.json');
const { LogService } = require('../services/log-service');
const { App } = require('../app');

exports.run = async (feedback, msg) => {
    const owners = Array.from(App.bot.guilds._cache.map(it => it.ownerId)).filter(a => a !== config.adminId);

    if (msg.author || msg.user) {
        const id = (msg.author?.id != null ? msg.author?.id : (msg.user?.id ?? 0));
        let reply = StringService.get('command.not.exists', 'Feedback');
        let count = 0;
        if (id === config.adminId) {
            owners.forEach(element => {
                App.bot.users.fetch(element, false)
                    .then(async (user) => {
                        try {
                            await user.send('Hey, would like to give me a feedback? If that is the case, you can call the command `/feedback` and send me one');
                            count++;
                        } catch (error) {
                            LogService.log("Could not send message to: " + element, error);
                        }
                    })
                    .catch(function (error) {
                        LogService.log("Could not send message to: " + element, error);
                    });
            });
            reply = StringService.get('feedback.request.number.of.users', count);
        } else {
            if (owners.includes(msg.user.id)) {
                reply = StringService.get('thanks.for.feedback')
                App.bot.users.fetch(config.adminId, false).then((user) => {
                    if (msg.user?.id && msg.user?.avatar) {
                        iconURL = `https://cdn.discordapp.com/avatars/${msg.user.id}/${msg.user.avatar}.png`;
                    } else {
                        iconURL = msg.user.defaultAvatarURL;
                    }
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('Just sent a feedback')
                        .setAuthor(
                            {
                                name: msg.user?.username ?? msg.author?.username ?? 'undefined',
                                url: 'https://www.icy-veins.com/heroes/',
                                iconURL
                            }
                        )
                        .setDescription(msg.toString().replace('/feedback feedback:', ''))
                        .setTimestamp();
                    user.send({ embeds: [embed] });
                });
            }
        }
        return {
            data: {
                featureName: 'Feedback',
                description: reply,
            },
            authorImage: 'images/hots.png'
        }
    }
}

exports.help = {
    name: 'Feedback',
    hint: 'Send me a feedback',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    argumentName: 'Feedback',
    argumentDescription: 'Feel free to share your thoughts about me',
    category: 'GENERAL'
}
