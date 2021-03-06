const fs = require('fs');
const config = require("./config.json");
const roles = JSON.parse(fs.readFileSync("./data/roles.json"), { encoding: 'utf8', flag: 'r' });
const StringUtils = require('./strings.js').StringUtils;
const heroesBase = JSON.parse(fs.readFileSync("./data/heroes-base.json"), { encoding: 'utf8', flag: 'r' });
const SEPARATOR = "------------------------------------------------------------------------"
let heroesInfos = [];
let freeHeroes = [];
let mustBanHeroes = [];
let compositions = [];

try {
	heroesInfos = JSON.parse(fs.readFileSync("./data/heroes-infos.json"));
	mustBanHeroes = JSON.parse(fs.readFileSync("./data/banlist.json"));
	compositions = JSON.parse(fs.readFileSync("./data/compositions.json"));
	freeHeroes = JSON.parse(fs.readFileSync("./data/freeweek.json"));
} catch (e) {
	process.stdout.write('error: ' + e + "\n");
}

exports.Heroes = {

	hero: null,
	mustBanHeroes: mustBanHeroes,
	freeHeroes: freeHeroes,
	heroesInfos: heroesInfos,
	compositions: compositions,

	init: function (command, heroName) {
		return this.assembleReturnMessage(command, heroName);
	},

	findAllHeroes: function (searchInfos) {
		if (searchInfos) {
			return heroesBase.map(hero => this.findHeroInfos(hero.id));
		}
		return heroesBase;
	},

	findHero: function (heroName, searchInfos) {
		let hero = heroesBase.find(hero => (hero.name.cleanVal() === heroName.cleanVal() ||
			hero.localizedName.cleanVal() === heroName.cleanVal() ||
			hero.accessLink.cleanVal() === heroName.cleanVal() ||
			hero.id.cleanVal() === heroName.cleanVal() ||
			(hero.name.cleanVal() + " (" + hero.localizedName.cleanVal() + ")" === heroName.cleanVal())));

		this.hero = hero;

		if (hero != null && searchInfos)
			this.hero = this.findHeroInfos(this.hero.id);

		return this.hero;
	},

	findHeroInfos: function (idParam) {
		return this.heroesInfos.find(hero => (hero.id === idParam));
	},

	findRoleById: function (roleId) {
		let role = roles.find(role => (role.id.toString().cleanVal() === roleId.toString().cleanVal()));
		if (role) {
			return role;
		}
	},

	findRoleByName: function (roleName) {
		let role = roles.find(role => (role.name.cleanVal() === roleName.cleanVal() ||
			role.localizedName.cleanVal() === roleName.cleanVal()));
		if (role) {
			return role;
		}
	},

	findHeroesByScore: function (roleId) {

		let list = this.heroesInfos.sort(function (a, b) {
			return a.infos.tierPosition - b.infos.tierPosition;
		});

		if (roleId != null) {
			list = list.filter(hero => (hero.role === roleId))
		}

		return list.sort(function (a, b) {
			return a.infos.tierPosition - b.infos.tierPosition;
		}).reverse().map(it => StringUtils.get('hero.score', this.getHeroName(it), it.infos.tierPosition)).splice(0,10).join('')
	},

	getRoleName: function (roleParam) {
		return `${roleParam.name} (${roleParam.localizedName})`;
	},

	getHeroName: function (heroParam) {
		let heroName = `${heroParam.name} (${heroParam.localizedName})`;
		if (heroParam.name == heroParam.localizedName) {
			heroName = `${heroParam.name}`;
		}
		return heroName
	},

	getHeroBuilds: function () {
		let reply = StringUtils.get('available.builds', this.getHeroName(this.hero));
		reply += this.hero.infos.builds.map(build => `\n${build.name}\n${build.skills}\n`).join('')
		return reply
	},

	getHeroRole: function () {
		return StringUtils.get('is.a', this.getHeroName(this.hero), this.getRoleName(this.findRoleById(this.hero.role)))		
	},

	getHeroUniverse: function () {
		return StringUtils.get('from.universe', this.hero.universe);
	},

	getHeroTierPosition: function () {
		return StringUtils.get('currently.on.tier', this.hero.infos.tierPosition);
	},

	getHeroCounters: function () {	
		let reply = StringUtils.get('countered.by', this.getHeroName(this.hero));
		reply += this.hero.infos.counters.map(counter => `${counter}\n`).join('');
		return reply;
	},

	getHeroStrongerMaps: function () {
		let reply = StringUtils.get('usually.stronger.on.maps', this.getHeroName(this.hero));	
		reply += this.hero.infos.strongerMaps.map(strongerMap => `${strongerMap}\n`).join('');
		return reply;
	},

	getHeroSynergies: function () {
		let reply = StringUtils.get('synergizes.with', this.getHeroName(this.hero));	
		reply += this.hero.infos.synergies.map(synergy => synergy + '\n').join('')
		return reply;
	},

	getHeroTips: function () {
		let tips = ""
		if (StringUtils.language === "pt-br") {
			tips = this.hero.infos.localizedTips;
		} else {
			tips = this.hero.infos.tips;
		}

		let reply = StringUtils.get('tips.for', this.getHeroName(this.hero));		
		reply += tips + '\n';
		return reply;
	},

	getHeroInfos: function () {
		let reply = "\n" + this.getHeroRole() +
			this.getHeroUniverse() +
			this.getHeroTierPosition() +		
			"\n" + this.getHeroBuilds() +
			SEPARATOR +
			"\n" + this.getHeroSynergies() +
			SEPARATOR +
			"\n" + this.getHeroCounters() +
			SEPARATOR +
			"\n" + this.getHeroStrongerMaps() +
			SEPARATOR +
			"\n" + this.getHeroTips();
		return reply
	},

	setHeroesInfos: function (heroesParam) {
		this.heroesInfos = heroesParam;
	},

	setBanHeroes: function (heroesParam) {
		this.mustBanHeroes = heroesParam;
	},

	setCompositions: function (compositionsParam) {
		this.compositions = compositionsParam;
	},

	setFreeHeroes: function (heroesParam) {
		this.freeHeroes = heroesParam;
	},

	assembleBanListReturnMessage: function () {
		let reply = StringUtils.get('suggested.bans');
		reply += this.mustBanHeroes.map(ban => ban + '\n').join('');
		return reply;
	},

	assembleFreeWeekHeroesReturnMessage: function () {
		let reply = StringUtils.get('no.free.heroes');

		if (this.freeHeroes.length > 0) {
			reply = StringUtils.get('free.heroes');
			reply += this.freeHeroes.map(freeHero => `${freeHero}\n`).join('');
		}
		return reply;
	},

	assembleSuggestHeroesReturnMessage: function (roleName) {
		let reply = StringUtils.get('suggested.heroes');
		if (roleName != null && roleName != "") {
			let role = this.findRoleByName(roleName)
			if (role != null) {
				reply += this.findHeroesByScore(parseInt(role.id))
			} else {
				reply = StringUtils.get('role.not.found', roleName);
			}
		} else {
			reply += this.findHeroesByScore()
		}
		return reply;
	},

	assembleTeamReturnMessage: function (heroes) {

		let reply = "";

		let heroesFiltered = JSON.parse(JSON.stringify(this.heroesInfos.sort(function (a, b) {
			return a.infos.tierPosition - b.infos.tierPosition;
		})));
	
		let currentCompRoles = [];
		let possibleComps = [];		
		let heroesArray = heroes.split(' ');
		let currentCompHeroes = new Map();
		const remainingHeroes = 5 - currentCompHeroes.size;
		let suggested = [];
				
		for (it of heroesArray) {
			let hero = this.findHero(it, true);
			 if (hero != null) {
				if (currentCompHeroes.size >= 5) {
					break;
				}
				currentCompHeroes.set(hero.id, hero);
			}	
		}
		
		if (currentCompHeroes.size > 0) {

			const missingRolesMap = new Map()

			for (currentCompHero of currentCompHeroes.values()) {
				heroesFiltered = heroesFiltered.filter(item => item.id !== currentCompHero.id);
				currentCompRoles.push(this.findRoleById(currentCompHero.role).name);
			}
			currentCompRoles = currentCompRoles.sort();

			for (currentCompHero of currentCompHeroes.values()) {
				let synergies = currentCompHero.infos.synergies.map(it => this.findHero(it));
				synergies.forEach((synergy) => {			
					let hero = heroesFiltered.find(it => it.id == synergy.id)
					if (hero != null)
						hero.infos.tierPosition = hero.infos.tierPosition * 2;
				});	
			}

			//sorted filtered heroes
			heroesFiltered = heroesFiltered.sort(function (a, b) {
				return a.infos.tierPosition - b.infos.tierPosition;
			}).reverse();

			let metaCompsRoles = this.compositions.map(it => it.roles.sort());
			
			for (role of currentCompRoles) {
				let index = currentCompRoles.indexOf(role);
				if (index !== -1) {
					if (currentCompRoles[index + 1] === role){
						//is a duplicate
						metaCompsRoles = metaCompsRoles.filter(it => it.toString().includes(role + ',' + role));
					}
				}
				metaCompsRoles = metaCompsRoles.filter(it => it.includes(role));
			}

			metaCompsRoles = metaCompsRoles.splice(0,3);
			if (metaCompsRoles.length > 0) {

				for (comp of metaCompsRoles) {
					let missingRoles = JSON.parse(JSON.stringify(comp));
										
					for (currentRole of currentCompRoles) {
						let index = missingRoles.indexOf(currentRole);
						if (index != -1)
							missingRoles.splice(missingRoles.indexOf(currentRole), 1);
					}			

					missingRolesMap.set(comp, missingRoles);					
				}
			}

			//filter missing role heroes only
			for (let [key, value] of missingRolesMap.entries()) {	
				for (missingRole of value) {
					let role = this.findRoleByName(missingRole);
					let hero = heroesFiltered.filter(heroToShift => heroToShift.role == role.id).shift();
					heroesFiltered = heroesFiltered.filter(heroFiltered => heroFiltered.id != hero.id);
			
					suggested.push(hero);
				}						
				missingRolesMap.set(key, suggested);
				suggested = [];
			}

			reply = `${StringUtils.get('current.team', Array.from(currentCompHeroes).map(([key, value]) => `${this.getHeroName(value)}`).join(', '))}`
			reply += Array.from(missingRolesMap).map(([key, value]) => `${key.join(', ')} \n- ${value.map(it => `${this.getHeroName(it)} - ${this.getRoleName(this.findRoleById(it.role))}\n`).join('- ')}${SEPARATOR}\n`).join('');
			reply += possibleComps.join(' ')	
		}
	
		return reply;
	},

	assembleReturnMessage: function (commandObj, argument) {
		let reply = "";

		if (commandObj.name === 'Banlist') {
			reply = this.assembleBanListReturnMessage();
		} else if (commandObj.name === 'FreeWeek') {
			reply = this.assembleFreeWeekHeroesReturnMessage();
		} else if (commandObj.name === 'Suggest') {
			reply = this.assembleSuggestHeroesReturnMessage(argument);
		} else if (commandObj.name === 'Team') {
			reply = this.assembleTeamReturnMessage(argument);
		} else {
			this.findHero(argument, true);
			if (this.hero != null) {
				if (this.hero.infos != null && (this.hero.infos.counters.length > 0 &&
					this.hero.infos.synergies.length > 0 &&
					this.hero.infos.builds.length > 0)) {
					reply = {
						text: eval(`this.getHero${commandObj.name}()`),
						image: `images/${this.hero.name.cleanVal()}.png`
					};
				} else {
					reply = `There was not enough info found for the hero ${argument} \nPlease, call the ${config.prefix}update command to search for them`;
				}

			} else {
				reply = StringUtils.get('hero.not.found', argument);			
			}
		}

		return reply;
	}
};
