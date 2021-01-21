const fs = require('fs');
const Discord = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
const puppeteer = require('puppeteer');
const heroesBase = JSON.parse(fs.readFileSync("./heroes-base.json"));
const heroesInfos = JSON.parse(fs.readFileSync("./heroes-infos.json"));
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
			commAux === 'synergies' || commAux === 'infos' ||
			 commAux === 'tips') {
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
		process.stdout.write(`Exception: ${e.stack}\n`);
		msg.reply('An exception occurred! ' + e)
	}
});

async function accessSite(command, heroLink) {

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

		await page.goto(`http://www.icy-veins.com/heroes/${heroLink}-build-guide`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {
			const names = [];
			const skills = [];
			const counters = [];
			const synergies = [];
			const strongerMaps = [];
			const tips = [];

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

			document.querySelectorAll('.heroes_tips li').forEach((i) => {
				tips.push(i.innerText.trim().replaceAll('  ',' '));
			});

			let retorno = {
				names: names,
				skills: skills,
				counters: counters,
				synergies: synergies,
				strongerMaps: strongerMaps,
				tips: tips
			}

			return retorno;
		});
	}

	await browser.close();
	return result;
};

async function updateData() {
	msg.reply('The update process has started...');
	updatingData = true;
	for (let i in heroesBase) {

		const browser = await puppeteer.launch()
		const page = await browser.newPage()
		await page.setRequestInterception(true)

		page.on('request', (request) => {
			if (request.resourceType() === 'image') request.abort()
			else request.continue()
		});

		let result = ""

		await page.goto(`http://www.icy-veins.com/heroes/${heroesBase[i].accessLink}-build-guide`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {
			const names = [];
			const skills = [];
			const counters = [];
			const synergies = [];
			const strongerMaps = [];
			const tips = [];

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

			document.querySelectorAll('.heroes_tips li').forEach((i) => {
				tips.push(i.innerText.trim().replaceAll('  ',' '));
			});

			let retorno = {
				names: names,
				skills: skills,
				counters: counters,
				synergies: synergies,
				strongerMaps: strongerMaps,
				tips: tips
			}

			return retorno;
		});


		await browser.close();
		let heroBuilds = [];
		let heroCounters = [];
		let heroSynergies = [];
		let heroMaps = [];
		let heroTips = "";

		for (name in result.names) {
			let obj = {
				name: result.names[name],
				skills: result.skills[name]
			};

			heroBuilds.push(obj);
		}

		for (index in result.synergies) {
			let synergyHero = findHero(result.synergies[index]);
			heroSynergies.push(`${synergyHero.name} (${synergyHero.localizedName})`);
		}
	
		for (index in result.counters) {
			let countHero = findHero(result.counters[index]);
			heroCounters.push(`${countHero.name} (${countHero.localizedName})`);
		}
			
		for (index in result.strongerMaps) {
			let heroMap = findMap(result.strongerMaps[index]);
			heroMaps.push(`${heroMap.name} (${heroMap.localizedName})`);
		}

		for (index in result.tips) {
			heroTips += result.tips[index] + "\n";
		}

		if (heroesInfos[i] == null) {
			heroesInfos[i] = {};
		}
		
		heroesInfos[i].id = heroesBase[i].id;
		heroesInfos[i].name = `${heroesBase[i].name} (${heroesBase[i].localizedName})`;
		heroesInfos[i].builds = heroBuilds;
		heroesInfos[i].synergies = heroSynergies;
		heroesInfos[i].counters = heroCounters;
		heroesInfos[i].strongerMaps = heroMaps;
		heroesInfos[i].tips = heroTips;
		process.stdout.write(`Finished process for ${heroesInfos[i].name} at ${new Date().toLocaleTimeString()}\n`);
	}

	fs.writeFile('heroes-infos.json', JSON.stringify(heroesInfos), (e) => {
		if (e != null) {
			process.stdout.write('error: ' + e+"\n");
			msg.reply('KEKW, the bot is on fire');
		}
	});
	updatingData = false;
	process.stdout.write(`Finished update process at ${new Date().toLocaleTimeString()}\n`);
	assembleReturnMessage('update');
};

function getHeroInfos(command, heroName) {
	let heroBuilds = []
	let hero = findHero(heroName);

	if (hero != null) {
		let heroInfos = findHeroInfos(hero.id);

		if (heroInfos != null && ((command === 'counters' && heroInfos.counters.length > 0)
			|| (command === 'synergies' && heroInfos.synergies.length > 0)
			|| (command === 'builds' && heroInfos.builds.length > 0
				|| (command === 'infos' && heroInfos.counters.length > 0 && heroInfos.synergies.length > 0 && heroInfos.builds.length > 0)))) {

			assembleReturnMessage(command, heroInfos);
		} else {
			accessSite(command, hero.acessLink).then((value) => {

				for (name in value.names) {
					let obj = {
						name: value.names[name],
						skills: value.skills[name]
					};

					heroBuilds.push(obj);
				}

				if(heroInfos == null) {
					heroInfos = {}
				}

				heroInfos.id = hero.id;
				heroInfos.name = `${hero.name} (${hero.localizedName})`;
				heroInfos.builds = heroBuilds;
				heroInfos.synergies = value.synergies;
				heroInfos.counters = value.counters;
				heroInfos.strongerMaps = value.strongerMaps;
				heroesInfos.push(heroInfos);

				assembleReturnMessage(command, heroInfos);
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
			for (i in heroesInfos) {
				for (j in heroesInfos[i].strongerMaps) {
					if (heroesInfos[i].strongerMaps[j] === map.name) {
						bestHeroes.push(heroesInfos[i].name)
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

function findHero(heroName) {
	let hero = heroesBase.find(hero => (hero.name.cleanVal() === heroName.cleanVal() || 
		hero.localizedName.cleanVal() === heroName.cleanVal() ||
		hero.id.cleanVal() === heroName.cleanVal()));

	if (hero != null) {		
		return hero;
	} 
	process.stdout.write(`Hero ${heroName} not found\n`);
}

function findHeroInfos(idParam){
	return heroesInfos.find(hero => (hero.id === idParam));
}

function findMap(mapName) {
	let mapLowerCase = mapName.cleanVal();
	return maps.find(map =>
	(map.name.cleanVal() === mapLowerCase ||
		map.localizedName.cleanVal() === mapLowerCase));
}

function findCommand(commandName) {
	let commandNameToLowerCase = commandName.cleanVal();
	return commands.find(command =>
		(command.name.cleanVal() === commandNameToLowerCase));
}

function help(command) {
	assembleReturnMessage('help', command);
}


//Return messages
function assembleBuildsReturnMessage(hero) {
	let reply = `Available build(s) for ${hero.name} \n`;
	for (i in hero.builds) {
		reply += hero.builds[i].name + ':\n' + hero.builds[i].skills + '\n\n';
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

function assembleFreeWeekHeroesReturnMessage() {
	let reply = `There are no free heroes yet ¯\\_(ツ)_/¯`;

	if (cacheFreeHeroes.length > 0) {
		reply = "These are the free rotation heroes\n";
		for (i in cacheFreeHeroes) {
			reply += cacheFreeHeroes[i] + '\n';
		}
	}
	return reply;
}

function assembleCountersReturnMessage(hero) {
	let reply = `${hero.name} is countered by \n`;
	for (i in hero.counters) {
		reply += hero.counters[i] + '\n';
	}
	return reply;
}

function assembleHeroStrongerMapsReturnMessage(hero) {
	let reply = `${hero.name} is usually stronger on these maps \n`;
	for (i in hero.strongerMaps) {
		reply += hero.strongerMaps[i] + '\n';
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
		reply += `If you want to know more about an specific command, type ${config.prefix}help [command]`;
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

function assembleTipsReturnMessage(args) {
	let reply = `Take thoses tips for ${args.name.split("-").join(" ")}\n`;
	reply += args.tips + '\n';
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
	} else if (commandObj.name === 'Tips') {
		reply = assembleTipsReturnMessage(args);
	} else if (commandObj.name === 'Infos') {
		reply = assembleBuildsReturnMessage(args);
		reply += assembleSynergiesReturnMessage(args);
		reply += "\n" + assembleCountersReturnMessage(args);
		reply += "\n" + assembleHeroStrongerMapsReturnMessage(args);
		reply += "\n" + assembleTipsReturnMessage(args);
	
	} else if (commandObj.name === 'Update') {
		reply = "The update process has finished!";
	}
	msg.reply(reply);
}
//end return messages

bot.on("ready", function () {
	
	Object.defineProperty(String.prototype, "cleanVal", {
		value: function cleanVal() {
			return this.toLowerCase().split("-").join(" ");
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