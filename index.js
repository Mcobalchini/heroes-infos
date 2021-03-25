const fs = require('fs');
const { Client } = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
let Heroes = require('./heroes.js').Heroes;
let Maps = require('./maps.js').Maps;
const puppeteer = require('puppeteer');
const heroesBase = JSON.parse(fs.readFileSync("./heroes-base.json"));
const PromisePool = require('es6-promise-pool');
let heroesInfos = [];

try {
	heroesInfos = JSON.parse(fs.readFileSync("./heroes-infos.json"))
} catch (e) { }

const commands = JSON.parse(fs.readFileSync("./commands.json"));
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


const accessHeroUrl = async (url, heroId, heroRole, heroesMap, browser) => {

	const page = await browser.newPage()
	page.on('request', (request) => {
		if (request.resourceType() === 'image') request.abort()
		else request.continue()
	});
	await page.setRequestInterception(true)
	await page.goto(url);
	
	// Evaluate code in a context of page and get your data.
	const result = await page.evaluate((heroRole) => {
		const names = Array.from(document.querySelectorAll('.toc_no_parsing')).map(it => it.innerText);
		const skills = Array.from(document.querySelectorAll('.talent_build_copy_button > input')).map(skillsElements => skillsElements.value);
		const counters = Array.from(document.querySelectorAll('.hero_portrait_bad')).map(nameElements => nameElements.title);
		const synergies = Array.from(document.querySelectorAll('.hero_portrait_good')).map(nameElements => nameElements.title);
		const strongerMaps = Array.from(document.querySelectorAll('.heroes_maps_stronger .heroes_maps_content span img')).map(i => i.title);
		const tips = Array.from(document.querySelectorAll('.heroes_tips li')).map(i => i.innerText.trim().replaceAll('  ', ' '));

		const builds = [];
		for (i in names) {
			builds.push({
				name: names[i],
				skills: skills[i]
			});
		}

		return {
			builds: builds,
			counters: counters,
			synergies: synergies,
			strongerMaps: strongerMaps,
			tips: tips,
			roleId: heroRole
		};

	}, heroRole);
	heroesMap.set(heroId, result);
	await page.close();
};

async function updateData() {
	const browser = await puppeteer.launch();
	
	updatingData = true;
	let heroesMap = new Map();
	let heroesIdRolesAndUrls = [];

	for (hero of heroesBase) {
		heroesIdRolesAndUrls.push({ heroId: hero.id, url: `http://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`, roleId: hero.role })
	}

	const promiseProducer = () => {
		const heroCrawlInfo = heroesIdRolesAndUrls.pop();
		return heroCrawlInfo ? accessHeroUrl(heroCrawlInfo.url, heroCrawlInfo.heroId, heroCrawlInfo.roleId, heroesMap, browser) : null;
	};
	
	let startTime = new Date();
	process.stdout.write(`Started gathering process at ${startTime.toLocaleTimeString()}\n`);

	const thread = new PromisePool(promiseProducer, 5);

	thread.start().then(() => {
		let finishedTime = new Date();

		process.stdout.write(`Finished gathering process at ${finishedTime.toLocaleTimeString()}\n`);
		process.stdout.write(`${(finishedTime - startTime) / 1000} seconds has passed\n`);

		for (let [heroKey, heroData] of heroesMap) {

			let heroBuilds = [];
			let heroCounters = [];
			let heroSynergies = [];
			let heroMaps = [];
			let heroTips = "";

			heroBuilds = heroData.builds;

			for (synergy of heroData.synergies) {
				let synergyHero = Heroes.findHero(synergy);
				heroSynergies.push(Heroes.getHeroName(synergyHero));
			}

			for (counter of heroData.counters) {
				let countHero = Heroes.findHero(counter);
				heroCounters.push(Heroes.getHeroName(countHero));
			}

			for (strongerMap of heroData.strongerMaps) {
				let heroMap = Maps.findMap(strongerMap);
				heroMaps.push(`${heroMap.name} (${heroMap.localizedName})`);
			}

			heroTips += heroData.tips.map(tip => `${tip}\n`).join('');

			if (heroesInfos[heroKey] == null) {
				heroesInfos[heroKey] = {};
			}

			let role = Heroes.findRoleById(heroData.roleId);
			let roleName = `${role.name} (${role.localizedName})`;

			heroesInfos[heroKey].id = heroKey;
			heroesInfos[heroKey].name = Heroes.getHeroName(Heroes.findHero(heroKey));
			heroesInfos[heroKey].role = roleName;
			heroesInfos[heroKey].builds = heroBuilds;
			heroesInfos[heroKey].synergies = heroSynergies;
			heroesInfos[heroKey].counters = heroCounters;
			heroesInfos[heroKey].strongerMaps = heroMaps;
			heroesInfos[heroKey].tips = heroTips;			
		}

		fs.writeFile('heroes-infos.json', JSON.stringify(heroesInfos), (e) => {
			if (e != null) {
				process.stdout.write('error: ' + e + "\n");
				msg.reply('I couldn\'t update the heroes data due to an error, check the logs to see what\'s going on');
			}
		});
		updatingData = false;
		
		msg.reply(assembleUpdateReturnMessage());
	}).catch(()=>msg.reply('I couldn\'t update the heroes data due to an error, check the logs to see what\'s going on'));
}

function getTopHeroesBan() {

	if (cacheBans.length > 0) {
		return assembleBanListReturnMessage();
	} else {
		accessSite('banlist').then((value) => {
			for (heroName of value) {
				let banHero = Heroes.findHero(heroName);
				cacheBans.push(Heroes.getHeroName(banHero));
			}
			return assembleBanListReturnMessage();
		});
	}

}

function getFreeHeroes() {
	return `All heroes are free now comrade! ☭`;
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

function handleCommand(commAux, args, receivedCommand) {
	let reply = "";
	let command = findCommand(commAux);
	if (command != null) {
		if (command.name === 'Builds' || command.name === 'Counters' ||
			command.name === 'Synergies' || command.name === 'Infos' ||
			command.name === 'Tips') {
			reply = Heroes.init(command, args);
		} else if (command.name === 'Banlist') {
			reply = getTopHeroesBan();
		} else if (command.name === 'Map') {
			reply = Maps.init(args);
		} else if (command.name === 'FreeWeek') {
			reply = getFreeHeroes();
		} else if (command.name === 'Help') {
			reply = help(args);
		} else if (command.name === 'Update') {
			updateData(command);
			reply = "The update process has started..."
		}
	} else {
		reply = `The command ${receivedCommand} does not exists!\nType ${config.prefix}help to know more about commands`;
	}
	msg.reply(reply, { split: true })
}

function findCommand(commandName) {
	let commandNameToLowerCase = commandName.cleanVal();
	return commands.find(command => (command.name.cleanVal() === commandNameToLowerCase));
}

function help(command) {
	return assembleHelpReturnMessage(command);
}

//Return messages
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

function assembleUpdateReturnMessage() {
	return "The update process has finished!";
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
