const fs = require('fs');
const { Client } = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
const Heroes = require('./heroes.js').Heroes;
const Maps = require('./maps.js').Maps;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const commands = JSON.parse(fs.readFileSync("./data/commands.json"));
const prefix = config.prefix;
const bot = new Client();
let msg = null;
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

async function accessSite(browser) {

	const page = await createPage(browser);

	let result = ""

	await page.goto(`https://www.icy-veins.com/heroes/heroes-of-the-storm-master-tier-list`);
	result = await page.evaluate(() => {
		return {
			freeHeroes: Array.from(document.querySelectorAll('.free_heroes_list  span.free_hero_name')).map(it => it.innerText),
			banHeroes: Array.from(document.querySelectorAll('.htl_ban_true')).map(nameElements => nameElements.nextElementSibling.innerText)
		}
	});

	await browser.close();
	return result;
};

const accessHeroUrl = async (icyUrl, heroId, profileUrl, heroesMap, browser, cookie) => {

	const page = await createPage(browser);

	await page.setExtraHTTPHeaders({
		'Cookie': cookie,
	});

	await page.goto(icyUrl);

	const icyData = await page.evaluate(() => {
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
			tips: tips
		};

	});

	await page.goto(profileUrl);

	const profileData = await page.evaluate(() => {
		const names = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .win_rate_cell')).map(it => `Popular build (${it.innerText}% win rate)`)
		const skills = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .build-code')).map(it => it.innerText)		
		const builds = [];
		for (i in names) {
			builds.push({
				name: names[i],
				skills: skills[i]
			});
		}

		return {
			builds: builds,
		};

	});

	returnObject = {
		icyData: icyData,
		profileData: profileData
	}

	heroesMap.set(heroId, returnObject);
	await page.close();
};

async function createHeroesProfileSession(browser) {
	const page = await createPage(browser);
	const response = await page.goto('https://www.heroesprofile.com/Global/Talents/');
	return response._headers["set-cookie"];
}

async function gatherTierListInfo(browser) {
	const page = await createPage(browser);
	
	let result = ""

	await page.goto(`http://robogrub.com/silvertierlist_api`);
	result = await page.evaluate(() => {
		let documentBody = JSON.parse(document.body.innerText);
		return documentBody.s.concat(documentBody.t1, documentBody.t2, documentBody.t3, documentBody.t4, documentBody.t5).map((it, idx) => {
			return { name: it.name, position: idx+1 }
	   });
	});

	await page.close();
	return result;
}

async function updateData() {
	updatingData = true;

	//const browser = await puppeteer.launch({devtools: true});
	const browser = await puppeteer.launch();
	const cookieValue = await createHeroesProfileSession(browser);
	const tierList = await gatherTierListInfo(browser);
	
	let heroesMap = new Map();
	let heroesIdAndUrls = [];
	let heroesInfos = Heroes.findAllHeroes();

	for (hero of heroesInfos) {
		heroesIdAndUrls.push({
			heroId: hero.id,
			icyUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
			profileUrl: `https://www.heroesprofile.com/Global/Talents/getChartDataTalentBuilds.php?hero=${hero.name.replace('/ /g', '+').replace('/\'/g', '%27')}`
		});
	}

	const promiseProducer = () => {
		const heroCrawlInfo = heroesIdAndUrls.pop();
		return heroCrawlInfo ? accessHeroUrl(heroCrawlInfo.icyUrl,
			heroCrawlInfo.heroId,
			heroCrawlInfo.profileUrl,
			heroesMap,
			browser,
			cookieValue) : null;
	};

	let startTime = new Date();
	process.stdout.write(`Started gathering process at ${startTime.toLocaleTimeString()}\n`);

	const thread = new PromisePool(promiseProducer, 15);

	thread.start().then(() => {

		let finishedTime = new Date();

		process.stdout.write(`Finished gathering process at ${finishedTime.toLocaleTimeString()}\n`);
		process.stdout.write(`${(finishedTime - startTime) / 1000} seconds has passed\n`);

		for (let [heroKey, heroData] of heroesMap) {
			let index = heroesInfos.findIndex(it => it.id == heroKey);
			let icyData = heroData.icyData
			let profileData = heroData.profileData
			let heroCounters = [];
			let heroSynergies = [];
			let heroMaps = [];
			let heroTips = "";

			for (synergy of icyData.synergies) {
				let synergyHero = Heroes.findHero(synergy);
				if (synergyHero)
					heroSynergies.push(Heroes.getHeroName(synergyHero));
			}

			for (counter of icyData.counters) {
				let counterHero = Heroes.findHero(counter);
				if (counterHero)
					heroCounters.push(Heroes.getHeroName(counterHero));
			}

			for (strongerMap of icyData.strongerMaps) {
				let heroMap = Maps.findMap(strongerMap);
				if (heroMap)
					heroMaps.push(`${heroMap.name} (${heroMap.localizedName})`);
			}

			heroTips += icyData.tips.map(tip => `${tip}\n`).join('');

			if (heroesInfos[index] == null) {
				heroesInfos[index] = {};
			}

			//Recupera os itens iguais
			let repeatedBuilds = profileData.builds.filter(item => (icyData.builds.map(it => it.skills).includes(item.skills)));

			//aplica o winrate no nome das builds conhecidas
			icyData.builds.forEach(it => {
				for (item of repeatedBuilds) {
					if (item.skills == it.skills) {
						it.name = `${it.name} (${item.name.match(/([0-9.]%*)/g, '').join('')} win rate)`
					}
				}
			});

			//remove os itens duplicados
			profileData.builds = profileData.builds.filter(item => !repeatedBuilds.includes(item))
			let heroBuilds = icyData.builds.concat(profileData.builds);

			heroesInfos[index].infos = {};
			heroesInfos[index].id = heroKey;
			heroesInfos[index].name = Heroes.findHero(heroKey).name;
			heroesInfos[index].infos.builds = heroBuilds;
			heroesInfos[index].infos.synergies = heroSynergies;
			heroesInfos[index].infos.counters = heroCounters;
			heroesInfos[index].infos.strongerMaps = heroMaps;
			heroesInfos[index].infos.tips = heroTips;	
			heroesInfos[index].infos.tierPosition = tierList.find(it => { return it.name.cleanVal() == heroesInfos[index].name.cleanVal()})?.position;
		}

		writeFile('data/heroes-infos.json', heroesInfos);
		Heroes.setHeroesInfos(heroesInfos);

		accessSite(browser).then((value) => {

			let cacheBans = [];
			let cacheFree = [];
			let freeHeroes = value.freeHeroes;
			let banHeroes = value.banHeroes;

			for (heroName of banHeroes) {
				let banHero = Heroes.findHero(heroName);
				cacheBans.push(Heroes.getHeroName(banHero));
			}

			for (heroName of freeHeroes) {
				let freeHero = Heroes.findHero(heroName);
				cacheFree.push(Heroes.getHeroName(freeHero));
			}

			writeFile('data/banlist.json', cacheBans);
			writeFile('data/freeweek.json', cacheFree);

			Heroes.setBanHeroes(cacheBans);
			Heroes.setFreeHeroes(cacheFree);
			updatingData = false;

			msg.reply(assembleUpdateReturnMessage((finishedTime - startTime) / 1000));
		});
	}).catch((e) => {
		process.stdout.write(e.stack);
		msg.reply('I couldn\'t update the heroes data due to an error, check the logs to see what\'s going on');
		updatingData = false;
	});
}

async function createPage(browser) {

	const page = await browser.newPage();
	await page.setRequestInterception(true);

	page.on('request', (request) => {
		if (['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
			request.abort();
		} else {
			request.continue();
		}
	});
	return page;
}

function handleCommand(args, receivedCommand) {
	let reply = "";
	let command = findCommand(receivedCommand);
	if (command != null) {
		if (command.name === 'Builds' || command.name === 'Counters' ||
			command.name === 'Synergies' || command.name === 'Infos' ||
			command.name === 'Tips' || command.name === 'FreeWeek' ||
			command.name === 'Suggest' ||
			command.name === 'Banlist') {
			reply = Heroes.init(command, args);
		} else if (command.name === 'Map') {
			reply = Maps.init(args);
		} else if (command.name === 'Help') {
			reply = assembleHelpReturnMessage(args);
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
	return commands.find(command => (command.name.cleanVal() === commandNameToLowerCase || command.localizedName.cleanVal() === commandNameToLowerCase));
}

//Return messages
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
		reply += commands.map(it => `${it.name} (${it.localizedName}) \n`).join('');
		reply += '\nAll the commands above supports both english and portuguese names\n';
		reply += 'All the data shown here is gathered from\n';
		reply += 'https://www.icy-veins.com/heroes/\n';
		reply += 'https://www.heroesprofile.com\n';
		reply += 'http://robogrub.com/silvertierlist_api\n';
		reply += `If you want to know more about an specific command, type ${config.prefix}help [command]`;
		reply += `\nVersion: ${config.version}`;
	}
	return reply;
}

function assembleUpdateReturnMessage(seconds) {
	return `The update process has finished in ${seconds} seconds`;
}
//end return messages

function writeFile(path, obj) {
	fs.writeFile(path, JSON.stringify(obj), (e) => {
		if (e != null) {
			process.stdout.write('error: ' + e + "\n");
			msg.reply('I couldn\'t write the heroes data due to an error, check the logs to see what\'s going on');
		}
	});
}

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
