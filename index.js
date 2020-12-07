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

commands['counters'] = 'Display who can counter the specified hero!';
commands['synergies'] = 'Display who synergizes the specified hero!';
commands['builds'] = 'Display the known builds for the specified hero!';
commands['banlist'] = 'Display suggested heroes to ban on ranked';

bot.on("message", function (message) {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	msg = message;
	let command = message.content.split(' ', 1)[0].substring(1);
	let args = message.content.substring(command.length + 2);
	try {
		if (command === 'builds' || command === 'counters' || command === 'synergies') {
			getHeroInfos(command, args);
		} else if (command === 'banlist') {
			getTopHeroesBan();
		} else if (command === 'help') {
			help(args);
		} else {
			msg.reply(`The command ${command} does not exists!`);
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
	} else if (command === 'builds' || command === 'counters' || command === 'synergies') {

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
		reply = `Available build(s) for ${args.name} \n`;
		for (i in args.builds) {			
			reply += args.builds[i].name + ':\n' + args.builds[i].skills + '\n\n';
		}

	} else if (command === 'banlist') {
		reply = `Suggested bans\n`;
		for (i in cacheBans) {
			reply += cacheBans[i] + '\n';
		}
	} else if (command === 'counters') {
		reply = `${args.name} is countered by \n`;
		for (i in args.counters) {
			reply += args.counters[i] + '\n';
		}

	} else if (command === 'help') {
		if (args != null) {
			reply = args;
		} else {
			reply = 'The possible commands are:\n'
			for (let key in commands) {
				reply += key+"\n";
			}
			reply += 'If you want to know more about a specific command type <help command';
		}

	} else if (command === 'synergies') {

		reply = `${args.name} synergizes with \n`;
		for (i in args.synergies) {
			reply += args.synergies[i] + '\n';
		}

	}

	msg.reply('\n' + reply);
}

function findHero(heroName) {
	if (heroes[heroName.toLowerCase()] != null) {
		console.log('Found hero by key ' + heroes[heroName.toLowerCase()].name);
		return heroes[heroName.toLowerCase()];
	} else {
		for (i in heroes) {
			if (heroes[i].name === heroName) {
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

bot.on("ready", function (message) {
	console.log('Application ready!');
	var channel = bot.channels.cache.get('745502745934561342');
	channel.send("Father is on");
});

bot.login(process.env.HEROES_INFOS_TOKEN);