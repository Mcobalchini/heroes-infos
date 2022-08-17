const {FileService} = require("./file-service");
let HeroService = require('./hero-service.js').HeroService;
const maps = FileService.openJsonSync('./data/constant/maps.json');
const StringService = require('./string-service.js').StringService;

exports.MapService = {

    init: function (mapName) {
        if (mapName != null && mapName.trim().length > 0) {
            let map = this.findMap(mapName);
            if (map != null) {
                let bestHeroes = HeroService.findAllHeroes(true)
                    .filter(hero => hero.infos.strongerMaps.map(it => it.name).includes(map.name))
                if (bestHeroes.length > 0) {
                    return this.assembleMapReturnMessage({
                        map: map,
                        heroes: bestHeroes.sort(HeroService.sortByTierPosition)
                    });
                }
                return StringService.get('no.best.heroes.for.map', map.name);
            }
            return StringService.get('map.not.found');
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
                (map.name.unaccentClean().includes(mapLowerCase) ||
                    map.localizedName.unaccentClean().includes(mapLowerCase))));
    },

    getMapName: function (map) {
        return map.name;
    },

    assembleMapReturnMessage: function (args) {
        let featureName;
        let array;
        if (args.heroes.length > 0) {
            const map = new Map(Array.from(args.heroes, obj => [obj.role, []]));

            args.heroes.forEach(obj => map.get(obj.role).push(obj));

            featureName = StringService.get('stronger.map.heroes', args.map.name);
            array = Array.from(map).map(([key, value]) => {
                return {
                    name: HeroService.getRoleName(HeroService.findRoleById(key)),
                    value: value.map(it => `${HeroService.getHeroName(it)}\n`).slice(0, 3).join(''),
                    inline: true
                }
            });
        } else {
            featureName = StringService.get('available.maps');
            array = args.map.map(map => {
                const name = this.getMapName(map);
                return {
                    name: name,
                    value: `|| ||`,
                    inline: true
                }
            })
        }

        return {
            data: {
                featureName: featureName,
                data: array
            }
        }
    },
};
