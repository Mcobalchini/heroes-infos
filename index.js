const fs = require('fs');
const Discord = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
const puppeteer = require('puppeteer')
const heroes = JSON.parse(fs.readFileSync("./heroes.json"));
const commands = JSON.parse(fs.readFileSync("./commands.json"));
const maps = JSON.parse(fs.readFileSync("./maps.json"));
const prefix = config.prefix;
const bot = new Discord.Client();
let msg = null;

let cacheBans = [];
let cacheFreeHeroes = [];

let updatingData = false;

bot.on("message", function (message) {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	msg = message;

	if (updatingData) {
		msg.reply('Hold still, i\'m updating the heroes data');
		return;
	}

	let receivedCommand = message.content.split(' ', 1)[0].substring(1);
	let commAux = receivedCommand.toLowerCase()
	let args = message.content.substring(commAux.length + 2);
	try {
		if (commAux === 'builds' || commAux === 'counters' ||
			commAux === 'synergies' || commAux === 'infos') {
			getHeroInfos(commAux, args);
		} else if (commAux === 'banlist') {
			getTopHeroesBan();
		} else if (commAux === 'freeweek') {
			getFreeHeroes();
		} else if (commAux === 'help') {
			help(args);
		} else if (commAux === 'map') {
			getMapInfos(args);
		} else if (commAux === 'update') {
			updateData(args);
		} else {
			msg.reply(`The command ${receivedCommand} does not exists!\nType ${config.prefix}help to know more about commands`);
		}
	} catch (e) {
		process.stdout.write(`Exception: ${e.stack}`);
		msg.reply('An exception occurred! ' + e)
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
	} else if (command === 'freeweek') {

		await page.goto(`http://heroesofthestorm.com/pt-br/heroes/`, { waitUntil: 'domcontentloaded' })

		result = await page.evaluate(() => {
			const freeHeroes = [];
			document.querySelectorAll('.HeroRotationIcon-container').forEach(nameElements =>
				freeHeroes.push(nameElements.previousElementSibling.innerText)
			);

			return freeHeroes;
		});
	} else {

		await page.goto(`http://www.icy-veins.com/heroes/${heroName}-build-guide`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {
			const names = [];
			const skills = [];
			const counters = [];
			const synergies = [];
			const strongerMaps = [];

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

			document.querySelectorAll('.heroes_maps_stronger .heroes_maps_content span img').forEach((i) => {
				strongerMaps.push(i.title);
			});

			let retorno = {
				names: names,
				skills: skills,
				counters: counters,
				synergies: synergies,
				strongerMaps: strongerMaps
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
			|| (command === 'synergies' && hero.synergies.length > 0)
			|| (command === 'builds' && hero.builds.length > 0
				|| (command === 'infos' && hero.counters.length > 0 && hero.synergies.length > 0 && hero.builds.length > 0))) {

			assembleReturnMessage(command, hero);
		} else {
			accessSite(command, hero.name).then((value) => {

				for (name in value.names) {
					let obj = {
						name: value.names[name],
						skills: value.skills[name]
					};

					heroBuilds.push(obj);
				}
				hero.builds = heroBuilds;
				hero.synergies = value.synergies;
				hero.counters = value.counters;
				hero.strongerMaps = value.strongerMaps;

				assembleReturnMessage(command, hero);
			});
		}

	} else {
		msg.reply(`The hero ${heroName} was not found`);
	}
}

function getMapInfos(mapName) {
	if (mapName != null && mapName.trim().length > 0) {
		let map = findMap(mapName);
		let bestHeroes = [];
		if (map != null) {
			for (i in heroes) {
				for (j in heroes[i].strongerMaps) {
					if (heroes[i].strongerMaps[j] === map.name) {
						bestHeroes.push(heroes[i].name)
					}
				}
			}
			assembleReturnMessage('map', bestHeroes);
		} else {
			msg.reply(`The specified map was not found\nType ${config.prefix}help map to get a list with the available maps`);
		}
	} else {
		assembleReturnMessage('map', maps.map(it => it.name + ' ( ' + it.localizedName + ' )'))
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

function getFreeHeroes() {
	if (cacheFreeHeroes.length > 0) {
		assembleReturnMessage('freeweek');
	} else {
		accessSite('freeweek').then((value) => {
			cacheFreeHeroes = value;
			assembleReturnMessage('freeweek');
		});
	}
}


function assembleBuildsReturnMessage(args) {
	let reply = `Available build(s) for ${args.name.split("-").join(" ")} \n`;
	for (i in args.builds) {
		reply += args.builds[i].name + ':\n' + args.builds[i].skills + '\n\n';
	}
	return reply
}

function assembleBanListReturnMessage() {
	let reply = `Suggested bans\n`;
	for (i in cacheBans) {
		reply += cacheBans[i] + '\n';
	}
	return reply;
}

function assembleFreeWeekHeroesReturnMessage(args) {
	let reply = `These are the free rotation heroes\n`;
	for (i in cacheFreeHeroes) {
		reply += cacheFreeHeroes[i] + '\n';
	}
	return reply;
}

function assembleCountersReturnMessage(args) {
	let reply = `${args.name.split("-").join(" ")} is countered by \n`;
	for (i in args.counters) {
		reply += args.counters[i] + '\n';
	}
	return reply;
}


function assembleHeroStrongerMapsReturnMessage(args) {
	let reply = `${args.name.split("-").join(" ")} is usually stronger on these maps \n`;
	for (i in args.strongerMaps) {
		reply += args.strongerMaps[i] + '\n';
	}
	return reply;
}

function assembleHelpReturnMessage(args) {
	let reply = "";
	if (args != null && args != "null" && args != "") {
		let command = findCommand(args);
		reply += command.hint;
		if (command.acceptParams) {
			reply += `\nExample: ${config.prefix}${command.name.toLowerCase()} [argument] `;
		}
	} else {
		reply = 'The available commands are:\n'
		reply += commands.map(it => it.name + "\n").join('');
		reply += '\nAll the commands above supports both english and portuguese names\n';
		reply += 'All the data shown here is gathered from https://www.icy-veins.com/heroes/\n';
		reply += `If you want to know more about an specific command type ${config.prefix}help [command]`;
		reply += `\nVersion: ${config.version}`;
	}
	return reply;
}

function assembleSynergiesReturnMessage(args) {
	let reply = `${args.name.split("-").join(" ")} synergizes with \n`;
	for (i in args.synergies) {
		reply += args.synergies[i] + '\n';
	}
	return reply;
}

function assembleMapReturnMessage(args) {
	let reply = "";
	if (args != null && args != "") {
		reply = `These are the heroes that are usually stronger on ${args}`;
	} else {
		reply = `These are the available maps`;
	}
	reply = "\n";
	for (i in args) {
		reply += args[i] + '\n';
	}
	return reply;
}

function assembleReturnMessage(command, args) {
	let commandObj = findCommand(command);
	let reply = "";
	if (commandObj.name === 'Builds') {
		reply = assembleBuildsReturnMessage(args);
	} else if (commandObj.name === 'Banlist') {
		reply = assembleBanListReturnMessage();
	} else if (commandObj.name === 'Counters') {
		reply = assembleCountersReturnMessage(args);
	} else if (commandObj.name === 'Help') {
		reply = assembleHelpReturnMessage(args);
	} else if (commandObj.name === 'Synergies') {
		reply = assembleSynergiesReturnMessage(args);
	} else if (commandObj.name === 'Map') {
		reply = assembleMapReturnMessage(args);
	} else if (commandObj.name === 'FreeWeek') {
		reply = assembleFreeWeekHeroesReturnMessage(args);
	} else if (commandObj.name === 'Infos') {
		reply = assembleBuildsReturnMessage(args);
		reply += assembleSynergiesReturnMessage(args);
		reply += "\n" + assembleCountersReturnMessage(args);
		reply += "\n" + assembleHeroStrongerMapsReturnMessage(args);

	} else if (commandObj.name === 'Update') {
		reply = "The update proccess has finished!";
	}
	msg.reply(reply);
}

function findHero(heroName) {
	if (heroes[heroName.toLowerCase()] != null) {
		process.stdout.write('Found hero by key ' + heroes[heroName.toLowerCase()].name);
		return heroes[heroName.toLowerCase()];
	} else {
		for (i in heroes) {
			if (heroes[i].name.toLowerCase().split("-").join(" ") === heroName.toLowerCase().split("-").join(" ")) {
				process.stdout.write('Found hero by value ' + heroes[i].name);
				return heroes[i];
			}
		}
	}
	process.stdout.write(`Hero ${heroName} not found`);
}

function findMap(mapName) {
	let mapLowerCase = mapName.toLowerCase().split("-").join(" ");
	return maps.find(map =>
	(map.name.toLowerCase().split("-").join(" ") === mapLowerCase ||
		map.localizedName.toLowerCase().split("-").join(" ") === mapLowerCase));
}

function findCommand(commandName) {
	let commandNameToLowerCase = commandName.toLowerCase().split("-").join(" ");
	return commands.find(command =>
		(command.name.toLowerCase().split("-").join(" ") === commandNameToLowerCase));
}

function help(command) {
	assembleReturnMessage('help', command);
}


async function updateData() {
	msg.reply('The update proccess has started...');
	updatingData = true;
	for (let i in heroes) {
		const browser = await puppeteer.launch()
		const page = await browser.newPage()
		await page.setRequestInterception(true)

		page.on('request', (request) => {
			if (request.resourceType() === 'image') request.abort()
			else request.continue()
		});

		let result = ""

		await page.goto(`http://www.icy-veins.com/heroes/${heroes[i].name}-build-guide`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {
			const names = [];
			const skills = [];
			const counters = [];
			const synergies = [];
			const strongerMaps = [];

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

			document.querySelectorAll('.heroes_maps_stronger .heroes_maps_content span img').forEach((i) => {
				strongerMaps.push(i.title);
			});

			let retorno = {
				names: names,
				skills: skills,
				counters: counters,
				synergies: synergies,
				strongerMaps: strongerMaps
			}

			return retorno;
		});


		await browser.close();
		let heroBuilds = [];
		for (name in result.names) {
			let obj = {
				name: result.names[name],
				skills: result.skills[name]
			};

			heroBuilds.push(obj);
		}

		heroes[i].builds = heroBuilds;
		heroes[i].synergies = result.synergies;
		heroes[i].counters = result.counters;
		heroes[i].strongerMaps = result.strongerMaps;
		process.stdout.write(`Finished proccess for ${heroes[i].name}\n`);
	}
	process.stdout.write(JSON.stringify(heroes));
	fs.writeFile('heroes.json', JSON.stringify(heroes), (e)=> {
		if(e != null){
			process.stdout.write('error: '+ e);
			msg.reply('KEKW, the bot is on fire');
		}
	});
	updatingData = false;
	assembleReturnMessage('update');
};


bot.on("ready", function () {
	process.stdout.write('Application ready!');
});

bot.login(process.env.HEROES_INFOS_TOKEN);