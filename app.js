const fs = require('fs');
const { Client, MessageActionRow, MessageSelectMenu , Intents, Util: { splitMessage }, MessageEmbed  } = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
const Heroes = require('./heroes.js').Heroes;
const Network = require('./network-service.js').Network;
const StringUtils = require('./strings.js').StringUtils;
const Maps = require('./maps.js').Maps;

const commands = JSON.parse(fs.readFileSync("./data/commands.json"));
const prefix = config.prefix;
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const clipboardy = require('clipboardy');
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

bot.on('interactionCreate', interaction => {
	if (!interaction.isSelectMenu()) return;
	let build = interaction.values[0]	
	clipboardy.writeSync(build);
	//interaction.reply({ content: build })
});


function handleCommand(args, receivedCommand) {
	let reply = "";
	let command = findCommand(receivedCommand);
	if (command != null) {
		if (command.category === "HEROES") {
			reply = Heroes.init(command, args);
		} else if (command.name === 'Map') {
			reply = Maps.init(args);
		} else if (command.name === 'Help') {
			reply = assembleHelpReturnMessage(args);
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

	if (reply.image != null) {
		returnObject = {		
			content: customSplitMessage(reply.text)[0],				
			split: true,
			files: [reply.image] 
		}
		 //will be used in the future, for now, there's no usage for that
		if (reply.embedReply != null) {
			let attachment = 'attachment://'+reply.image.replace('images/','');
			const embedBuilds = new MessageEmbed()			
			.setColor('#0099ff')
			.setTitle('Builds')	
			.setAuthor(reply.embedReply.data.hero, attachment, 'https://www.icy-veins.com/heroes/')
			.setDescription(StringUtils.get('available.builds', reply.embedReply.data.hero))
			.addFields(reply.embedReply.data.builds)
			.setThumbnail(attachment)
			.setFooter("-".repeat(115))			
			embedBuilds.type = 'image'
			returnObject.embeds = [embedBuilds];
		}

		msg.reply(returnObject);

	} else {
		msg.reply(reply, { split: true })
	}
}

function findCommand(commandName) {
	let commandNameToLowerCase = commandName.cleanVal();
	let commandEn = commands.find(command => (command.name.cleanVal() === commandNameToLowerCase));
	let commandBr = commands.find(command => (command.localizedName.cleanVal() === commandNameToLowerCase));
	
	let language = StringUtils.language;
	if(commandBr != null) {
		language = "pt-br"
	} else if (commandEn != null){
		language = "en-us";
	}

	StringUtils.setLanguage(language);

	return commandEn || commandBr
}

function findCommandHint(command) {
	return StringUtils.language === "pt-br" ? command.localizedHint : command.hint
}

function findCommandName(command) {
	return StringUtils.language === "pt-br" ? command.localizedName : command.name
}

//Return messages
function assembleHelpReturnMessage(commandName) {
	let reply = "";
	if (commandName != null && commandName != "null" && commandName != "") {
		let command = findCommand(commandName);
		if(command != null) {
			reply += `${findCommandHint(command)}\n`;
			if (command.acceptParams) {		
				reply += StringUtils.get('command.example', config.prefix, findCommandName(command).toLowerCase());
			}
		} else {
			reply = StringUtils.get('command.not.exists', commandName, config.prefix);
		}
	} else {
	
		reply = StringUtils.get('available.commands.are');
		reply += commands.map(it => `${it.name} (${it.localizedName}) \n`).join('');
		reply += StringUtils.get('all.commands.supported.both.languages');

		reply += StringUtils.get('all.data.gathered.from');
		reply += 'https://www.icy-veins.com/heroes/\n';
		reply += 'https://www.heroesprofile.com\n';
		reply += 'http://robogrub.com/silvertierlist_api\n';
		reply += 'https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2\n';
		reply += StringUtils.get('if.want.to.know.more.about.specific.command', config.prefix);	
		reply += StringUtils.get('version', config.version);
	}
	return reply;
}

function assembleUpdateReturnMessage(message) {
	Network.replyTo.reply(message);	
	Network.replyTo = null;
}

//end return messages

const customSplitMessage = (text) => [
	text.substring(0, 2000),
	text.substring(2000, text.length),
];

bot.on("ready", function () {

	Object.defineProperty(String.prototype, "cleanVal", {
		value: function cleanVal() {
			return this.split("\'").join("").split(".").join("").toLowerCase().split("-").join(" ");
		},
		writable: true,
		configurable: true
	});

	process.stdout.write('Application ready!\n');
	bot.user.setActivity("Heroes of the Storm", {
		type: "PLAYING",
		url: "https://heroesofthestorm.com/"
	})
});

bot.login(process.env.HEROES_INFOS_TOKEN);
