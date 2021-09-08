const translate = require('@vitalets/google-translate-api');

const fs = require('fs');
const { Client, MessageActionRow, MessageSelectMenu , Intents, Util: { splitMessage } } = require("discord.js");
const config = require("./config.json");
require('dotenv').config({ path: './variables.env' });
const Heroes = require('./heroes.js').Heroes;
const StringUtils = require('./strings.js').StringUtils;
const Maps = require('./maps.js').Maps;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const commands = JSON.parse(fs.readFileSync("./data/commands.json"));
const prefix = config.prefix;
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const clipboardy = require('clipboardy');
let msg = null;
let updatingData = false;

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
	interaction.reply({ content: build })
});

async function accessSite(browser) {

	const page = await createPage(browser);

	let result = ""

	await page.goto(`https://nexuscompendium.com/api/currently/RotationHero`);
	result = await page.evaluate(() => {		
		return JSON.parse(document.body.innerText).RotationHero.Heroes.map(it => it.ID)	
	});

	await browser.close();
	return result;
};

const accessHeroUrl = async (icyUrl, heroId, profileUrl, heroesMap, browser, cookie) => {

	const page = await createPage(browser);

	await page.setExtraHTTPHeaders({
		'Cookie': cookie,
	});

	await page.goto(icyUrl, {timeout: 0});

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

	await page.goto(profileUrl, {timeout: 0});

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
	await page.goto(`https://www.icy-veins.com/heroes/heroes-of-the-storm-general-tier-list`, { waitUntil: 'domcontentloaded' })

	result = await page.evaluate(() => {		
		return [...new Set(Array.from(document.querySelectorAll('.htl_ban_true')).map(nameElements => nameElements.nextElementSibling.innerText))];
	});

	await page.close();
	return result;
}

async function gatherPopularityAndWinRateListInfo(browser) {
	const page = await createPage(browser);

	let result = ""

	await page.goto(`https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2`);
	result = await page.evaluate(() => {
		return Array.from(document.querySelector('.rgMasterTable tbody').children).map((it) => {
			return {
				name: it.children[1].firstElementChild.innerText,
				winRate: parseFloat(it.children[3].innerText.replace(",", ".")),
				games: parseFloat(it.children[2].innerText.replace(",", ".")),
			}
		});
	});

	await page.close();
	return result;
}

async function gatherCompositionInfo(browser) {
	const page = await createPage(browser);

	let result = ""

	await page.goto(`https://www.hotslogs.com/Sitewide/TeamCompositions?Grouping=1`);
	result = await page.evaluate(() => {
		return Array.from(document.querySelector('.rgMasterTable tbody').children).map((it) => {         
			return {
			   games: it.children[0].innerText,
			   winRate: parseFloat(it.children[1].innerText.replace(",", ".")),
			   roles: Array.from(it.children).filter(it => it.style.display === "none").map(it => it.innerText)
		   }
		});
	});

	await page.close();
	return result;
}

async function updateData() {

	process.stdout.write(`Started updating data process at ${new Date().toLocaleTimeString()}\n`);
	updatingData = true;

	//const browser = await puppeteer.launch({devtools: true});
	const browser = await puppeteer.launch({
		headless: true,
		args: [
		  '--no-sandbox',
		  '--disable-setuid-sandbox',		
		],
	  });
	  
	const cookieValue = await createHeroesProfileSession(browser);	 
	const tierList = await gatherTierListInfo(browser);
	const popularityWinRate = await gatherPopularityAndWinRateListInfo(browser);
	const compositions = await gatherCompositionInfo(browser);
	
	process.stdout.write(`Cookie Value ${cookieValue}\n`);
	process.stdout.write(`Tier list = ${tierList.join(' ')}\n`);
	process.stdout.write(`PopWinRate\n ${popularityWinRate.map(it => `name=${it.name} winrate=${it.winRate} games=${it.games}\n`).join(' ')}\n`);
	process.stdout.write(`Compositions\n ${compositions.map(it => `winrate=${it.winRate} games=${it.games} roles=${it.roles.join(',')}\n`).join(' ')}\n`);

	//grava compositions
	compositions.sort(function (a, b) {
		return a.games - b.games;
	}).forEach((it, idx)=> {
		it.tierPosition = parseInt(idx+1);
	});

	compositions.sort(function (a, b) {
		return a.winRate - b.winRate;
	}).forEach((it, idx)=> {
		it.tierPosition = parseInt(it.tierPosition) + parseInt(idx+1);
	});
	
	let sortedComposition = compositions.sort(function (a, b) {return a.tierPosition - b.tierPosition}).reverse();
	Heroes.setCompositions(sortedComposition);
	writeFile('data/compositions.json', sortedComposition);

	let heroesMap = new Map();
	let heroesIdAndUrls = [];
	let heroesInfos = Heroes.findAllHeroes();

	for (hero of heroesInfos) {
		let normalizedName = hero.name.replace('/ /g', '+').replace('/\'/g', '%27');
		heroesIdAndUrls.push({
			heroId: hero.id,
			icyUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
			profileUrl: `https://www.heroesprofile.com/Global/Talents/getChartDataTalentBuilds.php?hero=${normalizedName}`
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

	const thread = new PromisePool(promiseProducer, 5);
		
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

			if (profileData.builds.length == 0){
				process.stdout.write(`No builds found for ${heroesInfos[index].name}\n`);
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
	
			let obj = popularityWinRate.find(it => { return it.name.cleanVal() == heroesInfos[index].name.cleanVal() });
			heroesInfos[index].infos.winRate = obj.winRate;
			heroesInfos[index].infos.games = obj.games;		
		}

		Heroes.setHeroesInfos(heroesInfos);
		
		let cacheBans = [];
		tierList.forEach(it => {						
			cacheBans.push(Heroes.getHeroName(Heroes.findHero(it)));
		});
		
		Heroes.setBanHeroes(cacheBans);
		writeFile('data/banlist.json', cacheBans);

		heroesInfos.sort(function (a, b) {
			return a.infos.games - b.infos.games;
		}).forEach((it, idx)=> {
			it.infos.tierPosition = parseInt(idx+1);
		});

		heroesInfos.sort(function (a, b) {
			return a.infos.winRate - b.infos.winRate;
		}).forEach((it, idx)=> {
			it.infos.tierPosition = parseInt(it.infos.tierPosition) + parseInt(idx+1);
		})
		
		accessSite(browser).then((value) => {

			let cacheFree = [];
			let freeHeroes = value;
	
			for (heroName of freeHeroes) {
				let freeHero = Heroes.findHero(heroName);
				cacheFree.push(Heroes.getHeroName(freeHero));
			}
			
			writeFile('data/freeweek.json', cacheFree);
			
			Heroes.setFreeHeroes(cacheFree);
			updatingData = false;

			translateTips(heroesInfos).then((heroesTranslated) => {
				msg.reply(assembleUpdateReturnMessage((finishedTime - startTime) / 1000));	
			});
		});
	}).catch((e) => {
		let replyMsg = StringUtils.get('could.not.update.data.check.logs');

		if (e.stack.includes("Navigation timeout of 30000 ms exceeded")	|| e.stack.includes("net::ERR_ABORTED")) {
			replyMsg += StringUtils.get('try.to.update.again');
			updateData();
		}

		process.stdout.write(e.stack);
		msg.reply(replyMsg);
		updatingData = false;
	});
}

async function translateTips(heroesInfos) {
	
	let heroesAux = JSON.parse(JSON.stringify(heroesInfos));
	let heroesCrawl = JSON.parse(JSON.stringify(heroesAux));
	let heroesMap = new Map();

	const translatePromiseProducer = () => {
		const heroCrawlInfo = heroesCrawl.pop();
		return heroCrawlInfo ? translate(heroCrawlInfo.infos.tips.substring(0, 5000), {to: 'pt'}).then(res => {
			heroesMap.set(heroCrawlInfo.id, res.text);
		}) : null;
	};
		
	const translateThread = new PromisePool(translatePromiseProducer, 20);
	translateThread.start().then(() => {
		for (let [heroKey, heroData] of heroesMap) {
			let index = heroesAux.findIndex(it => it.id == heroKey);
			heroesAux[index].infos.localizedTips = heroData
		}	
	})
	Heroes.setHeroesInfos(heroesAux);
	writeFile('data/heroes-infos.json', heroesAux);	
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
		if (command.category === "HEROES") {
			reply = Heroes.init(command, args);
		} else if (command.name === 'Map') {
			reply = Maps.init(args);
		} else if (command.name === 'Help') {
			reply = assembleHelpReturnMessage(args);
		} else if (command.name === 'Update') {
			if (updatingData) {
				reply = StringUtils.get('hold.still.updating');
			} else {
				updateData();
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
		if (reply.component != null){
			const row = new MessageActionRow()
			.addComponents(
				new MessageSelectMenu()
					.setCustomId('select')
					.setPlaceholder('Nothing selected')
					.setMinValues(1)
					.setMaxValues(1)
					.addOptions(reply.component),
			);
			returnObject.components = [row];
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

function assembleUpdateReturnMessage(seconds) {
	return StringUtils.get('process.update.finished.time', seconds);
}
//end return messages

function writeFile(path, obj) {
	fs.writeFile(path, JSON.stringify(obj), (e) => {
		if (e != null) {
			process.stdout.write('error: ' + e + "\n");
			msg.reply(StringUtils.get('could.not.update.data.check.logs'));
		}
	});
}

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
