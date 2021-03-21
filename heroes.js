const fs = require('fs');

const roles = JSON.parse(fs.readFileSync("./roles.json"), { encoding: 'utf8', flag: 'r' });
const heroesBase = JSON.parse(fs.readFileSync("./heroes-base.json"), { encoding: 'utf8', flag: 'r' });
const SEPARATOR = "------------------------------------------------------------------------"
let heroesInfos = [];

try {
	heroesInfos = JSON.parse(fs.readFileSync("./heroes-infos.json"))
} catch (e) { }

const maps = JSON.parse(fs.readFileSync("./maps.json"));


exports.Heroes = {

	findHero: function (heroName) {
		let hero = heroesBase.find(hero => (hero.name.cleanVal() === heroName.cleanVal() ||
			hero.localizedName.cleanVal() === heroName.cleanVal() ||
			hero.accessLink.cleanVal() === heroName.cleanVal() ||
			hero.id.cleanVal() === heroName.cleanVal()));
		if (hero) {
			return hero;
		}
		process.stdout.write(`Hero ${heroName} not found\n`);
	},

	getHeroInfos: function (command, heroName) {
		let hero = this.findHero(heroName);

		if (hero != null) {
			let heroInfos = this.findHeroInfos(hero.id);

			if (heroInfos != null && (heroInfos.counters.length > 0 &&
				heroInfos.synergies.length > 0 &&
				heroInfos.builds.length > 0)) {
				return this.assembleReturnMessage(command, heroInfos);
			} else {
				return `There was not enough info found for the hero ${heroName} \nPlease, call the ${config.prefix}update command to search for them`;
			}

		} else {
			return `The hero ${heroName} was not found`;
		}
	},
	findHeroInfos: function (idParam) {
		return heroesInfos.find(hero => (hero.id === idParam));
	},

	getMapInfos: function (command, mapName) {
		if (mapName != null && mapName.trim().length > 0) {
			let map = this.findMap(mapName);
			let bestHeroes = [];
			if (map != null) {
				for (info of heroesInfos) {
					for (strongerMap of info.strongerMaps) {
						if (strongerMap === `${map.name} (${map.localizedName})`) {
							bestHeroes.push(info)
						}
					}
				}
				return this.assembleReturnMessage(command, { map: map, heroes: bestHeroes });
			} else {
				return `The specified map was not found\nType "${config.prefix}help map" to get a list with the available maps`;
			}
		} else {
			return this.assembleReturnMessage(command, { map: maps.map(it => it.name + ' (' + it.localizedName + ')'), heroes: [] })
		}
	},

	findRoleById: function (roleId) {
		let role = roles.find(role => (role.id.toString().cleanVal() === roleId.toString().cleanVal()));
		if (role) {
			return role;
		}
	},

	getHeroName: function (hero) {
		let heroName = `${hero.name} (${hero.localizedName})`;
		if (hero.name == hero.localizedName) {
			heroName = `${hero.name}`;
		}
		return heroName
	},

	findMap: function (mapName) {
		let mapLowerCase = mapName.cleanVal();
		return maps.find(map =>
		(map.name.cleanVal() === mapLowerCase ||
			map.localizedName.cleanVal() === mapLowerCase));
	},

	assembleBuildsReturnMessage: function (hero) {
		let reply = `Available build(s) for ${hero.name}`;
		reply += hero.builds.map(build => `\n${build.name}:\n${build.skills}\n`).join('')
		return reply
	},

	assembleRoleReturnMessage: function (hero) {
		let reply = `${hero.name} is a ${hero.role}`;
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

	assembleCountersReturnMessage: function (hero) {
		let reply = `${hero.name} is countered by \n`;
		reply += hero.counters.map(counter => `${counter}\n`).join('');
		return reply;
	},

	assembleHeroStrongerMapsReturnMessage: function (hero) {
		let reply = `${hero.name} is usually stronger on these maps \n`;
		reply += hero.strongerMaps.map(hero => `${hero}\n`).join('');
		return reply;
	},


	assembleSynergiesReturnMessage: function (hero) {
		let reply = `${hero.name} synergizes with \n`;
		reply += hero.synergies.map(it => it + '\n').join('')
		return reply;
	},

	assembleTipsReturnMessage: function (hero) {
		let reply = `Here are some tips for ${hero.name}\n`;
		reply += hero.tips + '\n';
		return reply;
	},

	assembleMapReturnMessage: function (args) {
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
	},

	assembleReturnMessage: function (commandObj, args) {
		let reply = "";
		if (commandObj.name === 'Builds') {
			reply = this.assembleBuildsReturnMessage(args);
		} else if (commandObj.name === 'Banlist') {
			reply = this.assembleBanListReturnMessage();
		} else if (commandObj.name === 'Counters') {
			reply = this.assembleCountersReturnMessage(args);
		} else if (commandObj.name === 'Synergies') {
			reply = this.assembleSynergiesReturnMessage(args);
		} else if (commandObj.name === 'Map') {
			reply = this.assembleMapReturnMessage(args);
		} else if (commandObj.name === 'FreeWeek') {
			reply = this.assembleFreeWeekHeroesReturnMessage(args);
		} else if (commandObj.name === 'Tips') {
			reply = this.assembleTipsReturnMessage(args);
		} else if (commandObj.name === 'Infos') {
			reply = "\n" + this.assembleRoleReturnMessage(args);
			reply += "\n" + this.assembleBuildsReturnMessage(args);
			reply += SEPARATOR
			reply += "\n" + this.assembleSynergiesReturnMessage(args);
			reply += SEPARATOR
			reply += "\n" + this.assembleCountersReturnMessage(args);
			reply += SEPARATOR
			reply += "\n" + this.assembleHeroStrongerMapsReturnMessage(args);
			reply += SEPARATOR
			reply += "\n" + this.assembleTipsReturnMessage(args);
		}

		return reply;
	}
};
