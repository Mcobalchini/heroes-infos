const fs = require('fs');
let Heroes = require('./heroes.js').Heroes;
const config = require('../config.json');
const maps = JSON.parse(fs.readFileSync('./data/constant/maps.json'), {encoding: 'utf8', flag: 'r'});
const StringUtils = require('./strings.js').StringUtils;

exports.Maps = {

    init: function (mapName) {
        if (mapName != null && mapName.trim().length > 0) {
            let map = this.findMap(mapName);
            if (map != null) {
                let bestHeroes = Heroes.findAllHeroes(true)
                    .filter(hero => hero.infos.strongerMaps.map(it => it.name).includes(map.name))
                if (bestHeroes.length > 0) {
                    return this.assembleMapReturnMessage({
                        map: map,
                        heroes: bestHeroes.sort(Heroes.sortByTierPosition)
                    });
                }
                return StringUtils.get('no.best.heroes.for.map', this.getMapName(map));
            }
            return StringUtils.get('map.not.found', config.prefix);
        } else {
            return this.assembleMapReturnMessage({map: maps.map(it => it), heroes: []})
        }
    },

    findMap: function (mapName) {
        let mapLowerCase = mapName.unaccentClean();
        return maps.find(map =>
            mapLowerCase.length > 2 &&
            ((map.name.unaccentClean() === mapLowerCase ||
                    map.localizedName.unaccentClean() === mapLowerCase) ||
                (map.name.unaccentClean().startsWith(mapLowerCase) ||
                    map.localizedName.unaccentClean().startsWith(mapLowerCase))));
    },

    getMapName: function (map) {
        return StringUtils.isEn() ? map.name : map.localizedName;
    },

    assembleMapReturnMessage: function (args) {
        let featureName;
        let array;
        if (args.heroes.length > 0) {
            const map = new Map(Array.from(args.heroes, obj => [obj.role, []]));

            args.heroes.forEach(obj => map.get(obj.role).push(obj));

            featureName = StringUtils.get('stronger.map.heroes', this.getMapName(args.map));
            array = Array.from(map).map(([key, value]) => {
                return {
                    name: Heroes.getRoleName(Heroes.findRoleById(key)),
                    value: value.map(it => `${Heroes.getHeroName(it)}\n`).join(''),
                    inline: false
                }
            });
        } else {
            featureName = StringUtils.get('available.maps');
            array = args.map.map(map => {
                return {
                    name: map.name,
                    value: map.localizedName,
                    inline: true
                }
            })
        }

        return {
            data: {
                featureName: featureName,
                data: array
            },
            image: 'images/hots.png'
        }
    },
};
