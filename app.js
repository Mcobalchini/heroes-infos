const fs = require('fs');
const { Client, Intents, MessageEmbed } = require("discord.js");
const config = require("./config.json");
const {Commands} = require("./services/commands");
require('dotenv').config({ path: './variables.env' });
const {Heroes} = require('./services/heroes.js');
const {Network} = require('./services/network-service.js');
const {StringUtils} = require('./services/strings.js');
const {Maps} = require('./services/maps.js');
const prefix = config.prefix;
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
let msg = null;

bot.on("messageCreate", message => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	msg = message;

	let receivedCommand = message.content.split(' ', 1)[0].substring(1);
	let args = message.content.substring(receivedCommand.toLowerCase().length + 2);

	try {
		handleCommand(args, receivedCommand);
	} catch (e) {
		process.stdout.write(`Exception: ${e.stack}\n`);
		msg.reply(StringUtils.get('exception.occurred', e))
	}
});


function handleCommand(args, receivedCommand) {
	let reply = "";
	let command = Commands.findCommand(receivedCommand);
	if (command != null) {
		if (command.category === "HEROES") {
			reply = Heroes.init(command, args);
		} else if (command.name === 'Map') {
			reply = Maps.init(args);
		} else if (command.name === 'Help') {
			reply = Commands.assembleHelpReturnMessage(args);
		} else if (command.name === 'Update') {
			if (Network.updatingData) {
				reply = StringUtils.get('hold.still.updating');
			} else {
				Network.replyTo = msg;
				Network.updateData(assembleUpdateReturnMessage);
				reply = StringUtils.get('update.process.started');
			}
		}
	} else {
		reply = StringUtils.get('command.not.exists', receivedCommand, config.prefix);
	}

	if (reply.image != null || reply.data != null) {
		let attachment = null;
		let returnObject = {}

		returnObject.files = ['images/footer.png']
		if (reply.image != null) {
			attachment = 'attachment://' + reply.image.replace('images/', '');
			returnObject.files.push(reply.image);
		}

		if (reply.data != null) {
			let embeds = createEmbeds(reply.data, reply.heroName, attachment);
			embeds[0].setThumbnail(attachment)
			if (attachment === null) {
				attachment = 'attachment://hots.png';
				returnObject.files.push('images/hots.png');
			}
			embeds.forEach(it => it.setAuthor(it.author.name ? it.author.name : "Heroes Infos", attachment, it.author.url))
			returnObject.embeds = embeds;
		}

		msg.reply(returnObject);
	} else {
		msg.reply(reply, { split: true })
	}
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

//Return messages

function assembleUpdateReturnMessage(message) {
	Network.replyTo.reply(message);
	Network.replyTo = null;
}
//end return messages

bot.on("ready", function () {

	Object.defineProperty(String.prototype, "cleanVal", {
		value: function cleanVal() {
			return this.split("\'").join("").split(".").join("").toLowerCase().split("-").join(" ");
		},
		writable: true,
		configurable: true
	});

	process.stdout.write(`Application ready! - ${new Date()}\n`);
	bot.user.setActivity("Heroes of the Storm", {
		type: "PLAYING",
		url: "https://heroesofthestorm.com/"
	})
});

bot.login(process.env.HEROES_INFOS_TOKEN);
