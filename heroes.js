const fs = require('fs');

const roles = JSON.parse(fs.readFileSync("./roles.json"), { encoding: 'utf8', flag: 'r' });
const heroesBase = JSON.parse(fs.readFileSync("./heroes-base.json"), { encoding: 'utf8', flag: 'r' });
const SEPARATOR = "------------------------------------------------------------------------"
let heroesInfos = [];

try {
	heroesInfos = JSON.parse(fs.readFileSync("./heroes-infos.json"))
} catch (e) { }


exports.Heroes = {

	hero : null,

	init: function (command, heroName) {
		
		this.findHero(heroName);
		if (this.hero != null) {
			
			if (this.hero.infos != null && (this.hero.infos.counters.length > 0 &&
				this.hero.infos.synergies.length > 0 &&
				this.hero.infos.builds.length > 0)) {
				return this.assembleReturnMessage(command, this.hero.infos);
			} else {
				return `There was not enough info found for the hero ${heroName} \nPlease, call the ${config.prefix}update command to search for them`;
			}

		} else {
			return `The hero ${heroName} was not found`;
		}
	},


	findAllHeroes: function () {
		heroesBase.map(hero => hero.infos = this.findHeroInfos(hero.id));
		return heroesBase;
	},

	findHero: function (heroName) {
		let hero = heroesBase.find(hero => (hero.name.cleanVal() === heroName.cleanVal() ||
			hero.localizedName.cleanVal() === heroName.cleanVal() ||
			hero.accessLink.cleanVal() === heroName.cleanVal() ||
			hero.id.cleanVal() === heroName.cleanVal()));

			this.hero = hero;
	
		return this.hero;
	},

	findHeroInfos: function (idParam) {
		return heroesInfos.find(hero => (hero.id === idParam));
	},

	findRoleById: function (roleId) {
		let role = roles.find(role => (role.id.toString().cleanVal() === roleId.toString().cleanVal()));
		if (role) {
			return role;
		}
	},

	getHeroName: function () {
		let heroName = `${this.hero.name} (${this.hero.localizedName})`;
		if (this.hero.name == this.hero.localizedName) {
			heroName = `${this.hero.name}`;
		}
		return heroName
	},

	getHeroBuilds: function () {
		let reply = `Available build(s) for ${this.hero.name}`;
		reply += this.hero.infos.builds.map(build => `\n${build.name}:\n${build.skills}\n`).join('')
		return reply
	},

	getHeroRole: function () {
		return `${this.hero.name} is a ${this.hero.infos.role}`;	
	},

	getHeroCounters: function () {
		let reply = `${this.hero.name} is countered by \n`;
		reply += this.hero.infos.counters.map(counter => `${counter}\n`).join('');
		return reply;
	},

	getHeroStrongerMaps: function () {
		let reply = `${this.hero.name} is usually stronger on these maps \n`;
		reply += this.hero.infos.strongerMaps.map(strongerMap => `${strongerMap}\n`).join('');
		return reply;
	},

	getHeroSynergies: function () {
		let reply = `${this.hero.name} synergizes with \n`;
		reply += this.hero.infos.synergies.map(synergy => synergy + '\n').join('')
		return reply;
	},

	getHeroTips: function () {
		let reply = `Here are some tips for ${this.hero.name}\n`;
		reply += this.hero.infos.tips + '\n';
		return reply;
	},

	getHeroInfos: function () {
		let reply = "\n" + this.getHeroRole() +
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

	assembleBanListReturnMessage: function () {
		let reply = `Suggested bans\n`;
		reply += cacheBans.map(ban => ban + '\n').join('');
		return reply;
	},

	assembleFreeWeekHeroesReturnMessage: function () {
		let reply = `There are no free heroes yet ¯\\_(ツ)_/¯`;

		if (cacheFreeHeroes.length > 0) {
			reply = "These are the free rotation heroes\n";
			reply += cacheFreeHeroes.map(freeHeroes => `${freeHeroes}\n`).join('');
		}
		return reply;
	},


	assembleReturnMessage: function (commandObj, args) {
		let reply = "";
	
		if (commandObj.name === 'Banlist') {
			reply = this.assembleBanListReturnMessage();
		} else if (commandObj.name === 'Map') {
			reply = this.assembleMapReturnMessage(args);
		} else if (commandObj.name === 'FreeWeek') {
			reply = this.assembleFreeWeekHeroesReturnMessage(args);
		} else {

			reply = eval(`this.getHero${commandObj.name}()`);
		}

		return reply;
	}
};
