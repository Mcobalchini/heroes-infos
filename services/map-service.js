const {FileService} = require("./file-service");
let HeroService = require('./hero-service.js').HeroService;
const mapService = FileService.openJsonSync('./data/constant/maps.json');
const StringService = require('./string-service.js').StringService;

exports.Maps = {

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
                return StringService.get('no.best.heroes.for.map', this.getMapName(map));
            }
            return StringService.get('map.not.found');
        } else {
            return this.assembleMapReturnMessage({map: mapService.map(it => it), heroes: []})
        }
    },

    findMap: function (mapName) {
        let mapLowerCase = mapName.unaccentClean();
        return mapService.find(map =>
            mapLowerCase.length > 2 &&
            ((map.name.unaccentClean() === mapLowerCase ||
                    map.localizedName.unaccentClean() === mapLowerCase) ||
                (map.name.unaccentClean().startsWith(mapLowerCase) ||
                    map.localizedName.unaccentClean().startsWith(mapLowerCase))));
    },

    getMapName: function (map) {
        return StringService.isEn() ? map.name : map.localizedName;
    },

    assembleMapReturnMessage: function (args) {
        let featureName;
        let array;
        if (args.heroes.length > 0) {
            const map = new Map(Array.from(args.heroes, obj => [obj.role, []]));

            args.heroes.forEach(obj => map.get(obj.role).push(obj));

            featureName = StringService.get('stronger.map.heroes', this.getMapName(args.map));
            array = Array.from(map).map(([key, value]) => {
                return {
                    name: HeroService.getRoleName(HeroService.findRoleById(key)),
                    value: value.map(it => `${HeroService.getHeroName(it)}\n`).slice(0, 3).join(''),
                    inline: true
                }
            });
        } else {
            featureName = StringService.get('available.mapService');
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
