const fs = require('fs');
const { Client } = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
let Heroes = require('./heroes.js').Heroes;
let Maps = require('./maps.js').Maps;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const commands = JSON.parse(fs.readFileSync("./data/commands.json"));
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
	let args = message.content.substring(receivedCommand.toLowerCase().length + 2);

	try {
		handleCommand(args, receivedCommand);
	} catch (e) {
		process.stdout.write(`Exception: ${e.stack}\n`);
		msg.reply('An exception occurred! ' + e)
	}
});

async function accessSite(command) {

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.setRequestInterception(true);
	page.on('request', (request) => {
		if (request.resourceType() === 'image') request.abort()
		else request.continue()
	});

	let result = ""

	if (command === 'banlist') {
		await page.goto(`http://www.icy-veins.com/heroes/heroes-of-the-storm-master-tier-list`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {
			return Array.from(document.querySelectorAll('.htl_ban_true')).map(nameElements => nameElements.nextElementSibling.innerText);
		});


	} else if (command === 'freeweek') {
		await page.goto(`http://heroesofthestorm.com/pt-br/heroes/`, { waitUntil: 'domcontentloaded' })
		result = await page.evaluate(() => {			
			return Array.from(document.querySelectorAll('.HeroRotationIcon-container')).map(nameElements => nameElements.previousElementSibling.innerText);
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
	let heroesInfos = Heroes.findAllHeroes();

	for (hero of heroesInfos) {
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
			let index = heroesInfos.findIndex(it=> it.id == heroKey);

			let heroCounters = [];
			let heroSynergies = [];
			let heroMaps = [];
			let heroTips = "";

			for (synergy of heroData.synergies) {
				let synergyHero = Heroes.findHero(synergy);		
				if (synergyHero)	
					heroSynergies.push(Heroes.getHeroName(synergyHero));
			}

			for (counter of heroData.counters) {
				let counterHero = Heroes.findHero(counter);
				if (counterHero)
					heroCounters.push(Heroes.getHeroName(counterHero));
			}

			for (strongerMap of heroData.strongerMaps) {
				let heroMap = Maps.findMap(strongerMap);
				if (heroMap)
					heroMaps.push(`${heroMap.name} (${heroMap.localizedName})`);
			}

			heroTips += heroData.tips.map(tip => `${tip}\n`).join('');

			if (heroesInfos[index] == null) {
				heroesInfos[index] = {};
			}

			let role = Heroes.findRoleById(heroData.roleId);
			let roleName = `${role.name} (${role.localizedName})`;

			heroesInfos[index].id = heroKey;
			heroesInfos[index].name = Heroes.getHeroName(Heroes.findHero(heroKey));
			heroesInfos[index].role = roleName;
			heroesInfos[index].builds = heroData.builds;
			heroesInfos[index].synergies = heroSynergies;
			heroesInfos[index].counters = heroCounters;
			heroesInfos[index].strongerMaps = heroMaps;
			heroesInfos[index].tips = heroTips;			
		}

		writeFile('data/heroes-infos.json', heroesInfos);
		Heroes.setHeroesInfos(heroesInfos);
		
		accessSite('freeweek').then((value)=> {
			Heroes.setFreeHeroes(value);			
			writeFile('data/banlist.json', value);
		});
	
		accessSite('banlist').then((value)=> {
			let cacheBans = [];
			for (heroName of value) {						
				let banHero = Heroes.findHero(heroName);
				cacheBans.push(Heroes.getHeroName(banHero));					
			}
			writeFile('data/banlist.json', cacheBans);		
			Heroes.setBanHeroes(cacheBans);
			updatingData = false;			
			msg.reply(assembleUpdateReturnMessage());
		});				
	}).catch((e)=> {
		process.stdout.write(e.stack);
		msg.reply('I couldn\'t update the heroes data due to an error, check the logs to see what\'s going on')
	}	
	);
}

function handleCommand(args, receivedCommand) {
	let reply = "";
	let command = findCommand(receivedCommand);
	if (command != null) {
		if (command.name === 'Builds' || command.name === 'Counters' ||
			command.name === 'Synergies' || command.name === 'Infos' ||
			command.name === 'Tips' || command.name === 'FreeWeek' ||
			command.name === 'Banlist') {
			reply = Heroes.init(command, args);	
		} else if (command.name === 'Map') {
			reply = Maps.init(args);
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

function writeFile(path, obj) {
	fs.writeFile(path, JSON.stringify(obj), (e) => {
		if (e != null) {
			process.stdout.write('error: ' + e + "\n");
			msg.reply('I couldn\'t write the heroes data due to an error, check the logs to see what\'s going on');
		}
	});
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
