const fs = require('fs');
const puppeteer = require('puppeteer');
const heroesBase = JSON.parse(fs.readFileSync("./heroes-base.json"));


function findHero(heroName) {
	let hero = heroesBase.find(hero => (hero.name.cleanVal() === heroName.cleanVal() || 
		hero.localizedName.cleanVal() === heroName.cleanVal() ||
		hero.accessLink.cleanVal() === heroName.cleanVal() ||
		hero.id.cleanVal() === heroName.cleanVal()));

	if (hero != null) {		
		return hero;
	} 
	process.stdout.write(`Hero ${heroName} not found\n`);
}

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
}

let updatingData = false;

async function updateData(msg) {

	if (updatingData) {
		msg.reply('Hold still, i\'m updating the heroes data');
		return;
	} else {

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
					tips.push(i.innerText.trim().replaceAll('  ', ' '));
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
				process.stdout.write('error: ' + e + "\n");
				msg.reply('KEKW, the bot is on fire');
			}
		});
		updatingData = false;
		process.stdout.write(`Finished update process at ${new Date().toLocaleTimeString()}\n`);
	}
	msg.reply = "The update process has finished!";
}

exports.accessSite = (command) => {
	accessSite(command)
};

exports.updateData = (msg) => {
	updateData(msg)
};