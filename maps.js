const fs = require('fs');
let Heroes = require('./heroes.js').Heroes;
const config = require("./config.json");
const maps = JSON.parse(fs.readFileSync("./data/maps.json"), { encoding: 'utf8', flag: 'r' });
const SEPARATOR = "------------------------------------------------------------------------"

exports.Maps = {

	init: function (mapName) {
		if (mapName != null && mapName.trim().length > 0) {
			let map = this.findMap(mapName);
			let bestHeroes = [];
			if (map != null) {
				for (hero of Heroes.findAllHeroes(true)) {
					for (strongerMap of hero.infos.strongerMaps) {
						if (strongerMap === `${map.name} (${map.localizedName})`) {
							bestHeroes.push(hero)
						}
					}
				}
				return this.assembleMapReturnMessage({ map: map, heroes: bestHeroes });
			} else {
				return `The specified map was not found\nType "${config.prefix}help <name of the map>" to get a list with the available maps`;
			}
		} else {
			return this.assembleMapReturnMessage({ map: maps.map(it => this.getMapName(it)), heroes: [] })
		}
	},

	findMap: function (mapName) {
		let mapLowerCase = mapName.cleanVal();
		return maps.find(map =>
		(map.name.cleanVal() === mapLowerCase ||
			map.localizedName.cleanVal() === mapLowerCase));
	},

	getMapName: function (map) {
		return map.name + ' (' + map.localizedName + ')';
	},

	assembleMapReturnMessage: function (args) {
		let reply = "";
		if (args.heroes.length > 0) {
			const map = new Map(Array.from(args.heroes, obj => [obj.role, []]));
			args.heroes.forEach(obj => map.get(obj.role).push(obj));

			reply = `These are the heroes that are usually stronger on ${this.getMapName(args.map)}`;
			reply += "\n";
			reply += Array.from(map).map(([key, value]) => `${Heroes.getRoleName(Heroes.findRoleById(key))} \n- ${value.map(it => `${Heroes.getHeroName(it)}\n`).join('- ')}${SEPARATOR}\n`).join('');
		} else {
			reply = `These are the available maps`;
			reply += "\n";
			reply += args.map.map(map => `${map}\n`).join('')
		}

		return reply;
	},
};
