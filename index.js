const fs = require('fs');
const { Client, MessageEmbed } = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
const puppeteer = require('puppeteer');
const roles = JSON.parse(fs.readFileSync("./roles.json"));
const heroesBase = JSON.parse(fs.readFileSync("./heroes-base.json"));
const SEPARATOR = "------------------------------------------------------------------------"
let heroesInfos = [];

try {
	heroesInfos = JSON.parse(fs.readFileSync("./heroes-infos.json"))
} catch (e) { }

const commands = JSON.parse(fs.readFileSync("./commands.json"));
const maps = JSON.parse(fs.readFileSync("./maps.json"));
const prefix = config.prefix;
const bot = new Client();
let msg = null;

let cacheBans = [];
let cacheFreeHeroes = [];

let updatingData = false;

bot.on("message", function (message) {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	msg = message;

	if (updatingData) {
		msg.reply('Hold still, i\'m updating heroes data');
		return;
	}

	let receivedCommand = message.content.split(' ', 1)[0].substring(1);
	let commAux = receivedCommand.toLowerCase()
	let args = message.content.substring(commAux.length + 2);

	try {
		handleCommand(commAux, args, receivedCommand);
	} catch (e) {
		process.stdout.write(`Exception: ${e.stack}\n`);
		msg.reply('An exception occurred! ' + e)
	}
});

async function accessSite(command) {

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
			const builds = [];
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
				tips.push(i.innerText.trim().replaceAll('  ', ' '));
			});


			for (i in names) {
				let obj = {
					name: names[i],
					skills: skills[i]
				};
				builds.push(obj);
			}

			let retorno = {
				builds: builds,
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

		heroBuilds = result.builds;

		for (synergy in result.synergies) {
			let synergyHero = findHero(synergy);
			heroSynergies.push(getHeroName(synergyHero));
		}

		for (counter of result.counters) {
			let countHero = findHero(counter);
			heroCounters.push(getHeroName(countHero));
		}

		for (strongerMap of result.strongerMaps) {
			let heroMap = findMap(strongerMap);
			heroMaps.push(getHeroName(heroMap));
		}

		heroTips += result.tips.map(tip => `${tip}\n`).join('');

		if (heroesInfos[i] == null) {
			heroesInfos[i] = {};
		}

		let role = findRoleById(heroesBase[i].role);
		let roleName = `${role.name} (${role.localizedName})`;

		heroesInfos[i].id = heroesBase[i].id;
		heroesInfos[i].name = getHeroName(findHero(heroesBase[i].name));
		heroesInfos[i].role = roleName;
		heroesInfos[i].builds = heroBuilds;
		heroesInfos[i].synergies = heroSynergies;
		heroesInfos[i].counters = heroCounters;
		heroesInfos[i].strongerMaps = heroMaps;
		heroesInfos[i].tips = heroTips;
		process.stdout.write(`Finished process for ${heroesInfos[i].name} at ${new Date().toLocaleTimeString()}\n`);
	}

	fs.writeFile('heroes-infos.json', JSON.stringify(heroesInfos), (e) => {
		if (e != null) {
			process.stdout.write('error: ' + e + "\n");
			msg.reply('I couldn\'t update the heroes data due to an error, check the logs to see what\'s going on');
		}
	});
	updatingData = false;
	process.stdout.write(`Finished update process at ${new Date().toLocaleTimeString()}\n`);
	assembleReturnMessage('update');
};

function getHeroInfos(command, heroName) {
	let hero = findHero(heroName);

	if (hero != null) {
		let heroInfos = findHeroInfos(hero.id);

		if (heroInfos != null && (heroInfos.counters.length > 0 &&
			heroInfos.synergies.length > 0 &&
			heroInfos.builds.length > 0)) {
			assembleReturnMessage(command, heroInfos);
		} else {
			msg.reply(`There was not enough info found for the hero ${heroName} \nPlease, call the ${config.prefix}update command to search for them`);
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
			for (info of heroesInfos) {
				for (strongerMap of info.strongerMaps) {
					if (strongerMap === `${map.name} (${map.localizedName})`) {
						bestHeroes.push(info)
					}
				}
			}
			assembleReturnMessage('map', { map: map, heroes: bestHeroes });
		} else {
			msg.reply(`The specified map was not found\nType "${config.prefix}help map" to get a list with the available maps`);
		}
	} else {
		assembleReturnMessage('map', { map: maps.map(it => it.name + ' ( ' + it.localizedName + ' )'), heroes: [] })
	}
}

function getTopHeroesBan() {

	if (cacheBans.length > 0) {
		assembleReturnMessage('banlist');
	} else {
		accessSite('banlist').then((value) => {
			for (heroName of value) {
				let banHero = findHero(heroName);
				cacheBans.push(`${banHero.name} (${banHero.localizedName})`);
			}
			assembleReturnMessage('banlist');
		});
	}

}

function getFreeHeroes() {
	let reply = `All heroes are free now comrade! ☭`;
	msg.reply(reply, { split: true });
	/*
	if (cacheFreeHeroes.length > 0) {
		assembleReturnMessage('freeweek');
	} else {
		accessSite('freeweek').then((value) => {
			cacheFreeHeroes = value;
			assembleReturnMessage('freeweek');
		});
	}
	*/
}

function findHero(heroName) {
	let hero = heroesBase.find(hero => (hero.name.cleanVal() === heroName.cleanVal() ||
		hero.localizedName.cleanVal() === heroName.cleanVal() ||
		hero.accessLink.cleanVal() === heroName.cleanVal() ||
		hero.id.cleanVal() === heroName.cleanVal()));

	if (hero) {
		return hero;
	}
	process.stdout.write(`Hero ${heroName} not found\n`);
}

function findRoleById(roleId) {
	let role = roles.find(role => (role.id.toString().cleanVal() === roleId.toString().cleanVal()));
	if (role) {
		return role;
	}
}

function getHeroName(hero) {
	let heroName = `${hero.name} (${hero.localizedName})`;
	if (hero.name == hero.localizedName) {
		heroName = `${hero.name}`;
	}
	return heroName
}

function findHeroInfos(idParam) {
	return heroesInfos.find(hero => (hero.id === idParam));
}

function findMap(mapName) {
	let mapLowerCase = mapName.cleanVal();
	return maps.find(map =>
	(map.name.cleanVal() === mapLowerCase ||
		map.localizedName.cleanVal() === mapLowerCase));
}

function handleCommand(commAux, args, receivedCommand) {
	let command = findCommand(commAux);
	if (command != null) {
		if (command.name === 'Builds' || command.name === 'Counters' ||
			command.name === 'Synergies' || command.name === 'Infos' ||
			command.name === 'Tips') {
			getHeroInfos(command, args);
		} else if (command.name === 'Banlist') {
			getTopHeroesBan();
		} else if (command.name === 'FreeWeek') {
			getFreeHeroes();
		} else if (command.name === 'Help') {
			help(args);
		} else if (command.name === 'Map') {
			getMapInfos(args);
		} else if (command.name === 'Update') {
			updateData(args);
		} else {
			msg.reply(`The command ${receivedCommand} does not exists!\nType ${config.prefix}help to know more about commands`);
		}
	}

}

function findCommand(commandName) {
	let commandNameToLowerCase = commandName.cleanVal();
	return commands.find(command => (command.name.cleanVal() === commandNameToLowerCase));
}

function help(command) {
	assembleReturnMessage('help', command);
}

//Return messages
function assembleBuildsReturnMessage(hero) {
	let reply = `Available build(s) for ${hero.name}`;
	reply += hero.builds.map(build => `\n${build.name}:\n${build.skills}\n`).join('')
	return reply
}

function assembleRoleReturnMessage(hero) {
	let reply = `${hero.name} is a ${hero.role}`;
	return reply
}

function assembleBanListReturnMessage() {
	let reply = `Suggested bans\n`;
	reply += cacheBans.map(ban => ban + '\n').join('');
	return reply;
}

function assembleFreeWeekHeroesReturnMessage() {
	let reply = `There are no free heroes yet ¯\\_(ツ)_/¯`;

	if (cacheFreeHeroes.length > 0) {
		reply = "These are the free rotation heroes\n";
		reply += cacheFreeHeroes.map(freeHeroes => `${freeHeroes}\n`).join('');
	}
	return reply;
}

function assembleCountersReturnMessage(hero) {
	let reply = `${hero.name} is countered by \n`;
	reply += hero.counters.map(counter => `${counter}\n`).join('');
	return reply;
}

function assembleHeroStrongerMapsReturnMessage(hero) {
	let reply = `${hero.name} is usually stronger on these maps \n`;
	reply += hero.strongerMaps.map(hero => `${hero}\n`).join('');
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

function assembleSynergiesReturnMessage(hero) {
	let reply = `${hero.name} synergizes with \n`;
	reply += hero.synergies.map(it => it + '\n').join('')
	return reply;
}

function assembleTipsReturnMessage(hero) {
	let reply = `Here are some tips for ${hero.name}\n`;
	reply += hero.tips + '\n';
	return reply;
}

function assembleMapReturnMessage(args) {
	let reply = "";
	if (args.heroes.length > 0) {

		const map = new Map(Array.from(args.heroes, obj => [obj.role, []]));
		args.heroes.forEach(obj => map.get(obj.role).push(obj));

		reply = `These are the heroes that are usually stronger on ${args.map.name}`;
		reply += "\n";
		reply += Array.from(map).map(([key, value]) => `${key} \n- ${value.map(it => `${it.name}\n`).join('- ')}${SEPARATOR}\n`).join('');
	} else {
		reply = `These are the available maps`;
		reply += "\n";
		reply += args.map.map(map => `${map}\n`).join('')
	}

	return reply;
}

function assembleReturnMessage(commandObj, args) {
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
		reply = "\n" + assembleRoleReturnMessage(args);
		reply += "\n" + assembleBuildsReturnMessage(args);
		reply += SEPARATOR
		reply += "\n" + assembleSynergiesReturnMessage(args);
		reply += SEPARATOR
		reply += "\n" + assembleCountersReturnMessage(args);
		reply += SEPARATOR
		reply += "\n" + assembleHeroStrongerMapsReturnMessage(args);
		reply += SEPARATOR
		reply += "\n" + assembleTipsReturnMessage(args);

	} else if (commandObj.name === 'Update') {
		reply = "The update process has finished!";
	}

	msg.reply(reply, { split: true });
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

	process.stdout.write('Application ready!\n');
	bot.user.setActivity("Heroes of the Storm", {
		type: "PLAYING",
		url: "https://heroesofthestorm.com/"
	})
});

bot.login(process.env.HEROES_INFOS_TOKEN);
