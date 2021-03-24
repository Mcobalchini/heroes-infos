const fs = require('fs');
let Heroes = require('./heroes.js').Heroes;
const maps = JSON.parse(fs.readFileSync("./maps.json"), { encoding: 'utf8', flag: 'r' });
const SEPARATOR = "------------------------------------------------------------------------"

exports.Maps = {

	init: function (mapName) {	
		if (mapName != null && mapName.trim().length > 0) {
			let map = this.findMap(mapName);
			let bestHeroes = [];
			if (map != null) {			
				for (hero of Heroes.findAllHeroes()) {
					for (strongerMap of hero.infos.strongerMaps) {
						if (strongerMap === `${map.name} (${map.localizedName})`) {
							bestHeroes.push(hero)
						}
					}
				}
				return this.assembleMapReturnMessage({ map: map, heroes: bestHeroes });
			} else {
				return `The specified map was not found\nType "${config.prefix}help map" to get a list with the available maps`;
			}
		} else {
			return this.assembleMapReturnMessage({ map: maps.map(it => it.name + ' (' + it.localizedName + ')'), heroes: [] })
		}
	},

	findMap: function (mapName) {
		let mapLowerCase = mapName.cleanVal();
		return maps.find(map =>
		(map.name.cleanVal() === mapLowerCase ||
			map.localizedName.cleanVal() === mapLowerCase));
	},
	
	assembleMapReturnMessage: function (args) {
		let reply = "";
		if (args.heroes.length > 0) {
			const map = new Map(Array.from(args.heroes, obj => [obj.infos.role, []]));
			args.heroes.forEach(obj => map.get(obj.infos.role).push(obj));

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
};
