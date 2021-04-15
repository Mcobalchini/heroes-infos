const fs = require('fs');
const config = require("./config.json");
const roles = JSON.parse(fs.readFileSync("./data/roles.json"), { encoding: 'utf8', flag: 'r' });
const heroesBase = JSON.parse(fs.readFileSync("./data/heroes-base.json"), { encoding: 'utf8', flag: 'r' });
const SEPARATOR = "------------------------------------------------------------------------"
let heroesInfos = [];
let freeHeroes = [];
let mustBanHeroes = [];

try {
	heroesInfos = JSON.parse(fs.readFileSync("./data/heroes-infos.json"));
	mustBanHeroes = JSON.parse(fs.readFileSync("./data/banlist.json"));
	freeHeroes = JSON.parse(fs.readFileSync("./data/freeweek.json"));
} catch (e) {
	process.stdout.write('error: ' + e + "\n");
}

exports.Heroes = {

	hero: null,
	mustBanHeroes: mustBanHeroes,
	freeHeroes: freeHeroes,
	heroesInfos: heroesInfos,

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
			hero.id.cleanVal() === heroName.cleanVal()));

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

	findHeroesByRole: function (roleId) {
		return this.heroesInfos.filter(hero => (hero.role === roleId)).sort(function(a, b) { 
			return a.infos.tierPosition - b.infos.tierPosition;
		  }).map(it=> `${this.getHeroName(it)} - Tier ${it.infos.tierPosition}\n`).join('')
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
		let reply = `Available build(s) for ${this.getHeroName(this.hero)}`;
		reply += this.hero.infos.builds.map(build => `\n${build.name}\n${build.skills}\n`).join('')
		return reply
	},

	getHeroRole: function () {
		return `${this.getHeroName(this.hero)} is a ${this.getRoleName(this.findRoleById(this.hero.role))}`;
	},

	getHeroUniverse: function () {
		return ` from ${this.hero.universe} universe`;
	},

	getHeroTierPosition: function () {
		return `currently on ${this.hero.infos.tierPosition} tier position`;
	},

	getHeroCounters: function () {
		let reply = `${this.getHeroName(this.hero)} is countered by \n`;
		reply += this.hero.infos.counters.map(counter => `${counter}\n`).join('');
		return reply;
	},

	getHeroStrongerMaps: function () {
		let reply = `${this.getHeroName(this.hero)} is usually stronger on these maps \n`;
		reply += this.hero.infos.strongerMaps.map(strongerMap => `${strongerMap}\n`).join('');
		return reply;
	},

	getHeroSynergies: function () {
		let reply = `${this.getHeroName(this.hero)} synergizes with \n`;
		reply += this.hero.infos.synergies.map(synergy => synergy + '\n').join('')
		return reply;
	},

	getHeroTips: function () {
		let reply = `Here are some tips for ${this.getHeroName(this.hero)}\n`;
		reply += this.hero.infos.tips + '\n';
		return reply;
	},

	getHeroInfos: function () {
		let reply = "\n" + this.getHeroRole() +
			this.getHeroUniverse() +
			"\n" + this.getHeroTierPosition() +
			"\n\n" + this.getHeroBuilds() +
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

	setFreeHeroes: function (heroesParam) {
		this.freeHeroes = heroesParam;
	},

	assembleBanListReturnMessage: function () {
		let reply = `Suggested bans\n`;
		reply += this.mustBanHeroes.map(ban => ban + '\n').join('');
		return reply;
	},

	assembleFreeWeekHeroesReturnMessage: function () {
		let reply = `There are no free heroes yet ¯\\_(ツ)_/¯`;

		if (this.freeHeroes.length > 0) {
			reply = "These are the free rotation heroes\n";
			reply += this.freeHeroes.map(freeHero => `${freeHero}\n`).join('');
		}
		return reply;
	},

	assembleSuggestHeroesReturnMessage: function (roleName) {
		let reply = `Suggested heroes \n`;
		let role = this.findRoleByName(roleName)
		if (role != null) {
			reply += this.findHeroesByRole(parseInt(role.id))
		} else {
			reply = `The role ${roleName} was not found`
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
		}else {
			this.findHero(argument, true);
			if (this.hero != null) {
				if (this.hero.infos != null && (this.hero.infos.counters.length > 0 &&
					this.hero.infos.synergies.length > 0 &&
					this.hero.infos.builds.length > 0)) {
					reply = eval(`this.getHero${commandObj.name}()`);
				} else {
					return `There was not enough info found for the hero ${argument} \nPlease, call the ${config.prefix}update command to search for them`;
				}

			} else {
				return `The hero ${argument} was not found`;
			}
		}

		return reply;
	}
};
