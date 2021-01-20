const fs = require('fs');
const puppeteer = require('puppeteer')
const heroes = JSON.parse(fs.readFileSync("./heroes.json"));
let msg = null;

const Network = {
	accessSite: async function(command, heroName) {

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
	}
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

	fs.writeFile('heroes.json', JSON.stringify(heroes), (e) => {
		if (e != null) {
			process.stdout.write('error: ' + e);
			msg.reply('KEKW, the bot is on fire');
		}
	});
	updatingData = false;
	assembleReturnMessage('update');
};

export default Network;