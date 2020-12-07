const fs = require('fs');
const Discord = require("discord.js");
const config = require("./config.json");
const heroesJson = fs.readFileSync("./heroes.json");
require('dotenv').config({path:'./variables.env'});
const puppeteer = require('puppeteer')
const heroes = JSON.parse(heroesJson);
const prefix = config.prefix;
const bot = new Discord.Client();


let msg = null;

let cacheBans = [];
const commands = new Map();

commands['Counters'] = 'Display who counters the specified hero! \nExample: <counters [hero name]';
commands['Synergies'] = 'Display who synergizes with the specified hero! \nExample: <synergies [hero name]';
commands['Builds'] = 'Display the known builds for the specified hero! \nExample: <builds [hero name]';
commands['Banlist'] = 'Display suggested heroes to ban on ranked\n Example: <banlist';

bot.on("message", function (message) {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	msg = message;
	let receivedCommand = message.content.split(' ', 1)[0].substring(1);
	let commAux = receivedCommand.toLowerCase()
	let args = message.content.substring(commAux.length + 2);
	try {
		if (commAux === 'builds' || commAux === 'counters' || commAux === 'synergies') {
			getHeroInfos(commAux, args);
		} else if (commAux === 'banlist') {
			getTopHeroesBan();
		} else if (commAux === 'help') {
			help(args);
		} else {
			msg.reply(`The command ${receivedCommand} does not exists!`);
		}
	} catch (e) {
		msg.reply('An exception ocurred! ' + e)
	}
});

async function accessSite(command, heroName) {

	const browser = await puppeteer.launch()
	const page = await browser.newPage()
	await page.setRequestInterception(true)
	page.on('request', (request) => {
		if (request.resourceType() === 'image') request.abort()
		else request.continue()
	});

	let result = ""

	if (command === 'banlist') {
		await page.goto(`http://www.icy-veins.com/heroes/heroes-of-the-storm-master-tier-list`, { waitUntil: 'domcontentloaded' })

		result = await page.evaluate(() => {
			const bans = [];

			document.querySelectorAll('.htl_ban_true').forEach(nameElements =>
				bans.push(nameElements.nextElementSibling.innerText)
			);

			return bans;
		});
	} else {

		await page.goto(`http://www.icy-veins.com/heroes/${heroName}-build-guide`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {
			const names = [];
			const skills = [];
			const counters = [];
			const synergies = [];

			document.querySelectorAll('.toc_no_parsing').forEach(nameElements =>
				names.push(nameElements.innerText)
			);

			document.querySelectorAll('.talent_build_copy_button > input').forEach(skillsElements =>
				skills.push(skillsElements.value)
			);

			document.querySelectorAll('.hero_portrait_bad').forEach(nameElements =>
				counters.push(nameElements.title)
			);

			document.querySelectorAll('.hero_portrait_good').forEach(nameElements =>
				synergies.push(nameElements.title)
			);

			let retorno = {
				names: names,
				skills: skills,
				counters: counters,
				synergies: synergies,
			}

			return retorno;
		});
	}

	await browser.close();
	return result;
};

function getHeroInfos(command, heroName) {
	let heroBuilds = []
	let hero = findHero(heroName);
	if (hero != null) {
		if ((command === 'counters' && hero.counters.length > 0)
			|| (command == 'synergies' && hero.synergies.length > 0)
			|| (command == 'builds' && hero.builds.length > 0)) {
			assembleReturnMessage(command, hero);
		} else {
			accessSite(command, hero.name).then((value) => {

				for (name in value.names) {
					let obj = {
						name: value.names[name],
						skills: value.skills[name],
						counters: value.counters[name],
						synergies: value.synergies[name],
					};

					heroBuilds.push(obj);
				}
				hero.builds = heroBuilds;
				hero.synergies = value.synergies;
				hero.counters = value.counters;			
				assembleReturnMessage(command, hero);
			});
		}

	} else {
		msg.reply('The specified hero was not found :v');
	}
}

function getTopHeroesBan() {

	if (cacheBans.length > 0) {
		assembleReturnMessage('banlist');
	} else {
		accessSite('banlist').then((value) => {
			cacheBans = value
			assembleReturnMessage('banlist');
		});
	}

}

function assembleReturnMessage(command, args) {
	let reply = "";

	if (command === 'builds') {
		reply = `Available build(s) for ${args.name.split("-").join(" ")} \n`;
		for (i in args.builds) {			
			reply += args.builds[i].name + ':\n' + args.builds[i].skills + '\n\n';
		}

	} else if (command === 'banlist') {
		reply = `Suggested bans\n`;
		for (i in cacheBans) {
			reply += cacheBans[i] + '\n';
		}
	} else if (command === 'counters') {
		reply = `${args.name.split("-").join(" ")} is countered by \n`;
		for (i in args.counters) {
			reply += args.counters[i] + '\n';
		}

	} else if (command === 'help') {
		if (args != null) {
			reply = args;
		} else {
			reply = 'The available commands are:\n'
			for (let key in commands) {
				reply += key+"\n";
			}
			reply += '\nAll the commands above supports both english and portuguese names\n';
			reply += 'All the data shown here is gathered from https://www.icy-veins.com/heroes/\n';
			reply += 'If you want to know more about an specific command type <help [command]';
			reply += `\nVersion: ${config.version}`;
		}

	} else if (command === 'synergies') {

		reply = `${args.name.split("-").join(" ")} synergizes with \n`;
		for (i in args.synergies) {
			reply += args.synergies[i] + '\n';
		}

	}

	msg.reply(reply);
}

function findHero(heroName) {
	if (heroes[heroName.toLowerCase()] != null) {
		console.log('Found hero by key ' + heroes[heroName.toLowerCase()].name);
		return heroes[heroName.toLowerCase()];
	} else {
		for (i in heroes) {
			if (heroes[i].name.toLowerCase().split("-").join(" ") === heroName.toLowerCase().split("-").join(" ")) {
				console.log('Found hero by value ' + heroes[i].name);
				return heroes[i];
			}
		}
	}
	console.log(`Hero ${heroName} not found`);
}

function help(command) {
	let comando = commands[command];
	assembleReturnMessage('help', comando);
}

bot.on("ready", function () {
	console.log('Application ready!');
	var channel = bot.channels.cache.get('745502745934561342');
	channel.send(`Father is on (version ${config.version})`);
});

bot.login(process.env.HEROES_INFOS_TOKEN);