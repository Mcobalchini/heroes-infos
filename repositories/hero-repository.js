const { FileUtils } = require('../utils/file-utils.js');
const { logger } = require('../services/log-service.js');
const { HeroNotFoundException } = require('../utils/exception-utils.js');
const heroesBase = FileUtils.openJsonSync('./data/constant/heroes-base.json').sort((a, b) => a.name.localeCompare(b.name));
const heroesPropertiesDir = './data/constant/heroes-names/';

let heroesInfos = [];
let freeHeroes = [];
let mustBanHeroes = [];
let compositions = [];

try {
    heroesInfos = FileUtils.openJsonSync(`./data/variable/${process.env.CLIENT_ID}/heroes-infos.json`);
    mustBanHeroes = FileUtils.openJsonSync(`./data/variable/${process.env.CLIENT_ID}/banlist.json`);
    compositions = FileUtils.openJsonSync(`./data/variable/${process.env.CLIENT_ID}/compositions.json`);
    freeHeroes = FileUtils.openJsonSync(`./data/variable/${process.env.CLIENT_ID}/freeweek.json`);
} catch (e) {
    logger.warn('error while reading json data', e);
}

exports.HeroRepository = {
    mustBanHeroes: mustBanHeroes,
    freeHeroes: freeHeroes,
    heroesInfos: heroesInfos,
    compositions: compositions,
    heroesNamesMap: new Map(),

    assembleHeroesNames: function () {
        const heroesNames = [];
        const folder = FileUtils.openDir(heroesPropertiesDir);
        folder.forEach(folderLanguage => {
            heroesNames.push(
                JSON.parse(
                    FileUtils.openFile(heroesPropertiesDir + folderLanguage + '/heroes.json')
                )
            );
        });
        heroesNames.forEach(language => {
            language.forEach(hero => {
                Object.keys(hero).forEach(key => {
                    if (this.heroesNamesMap.has(key)) {
                        this.heroesNamesMap.set(key, this.heroesNamesMap.get(key).concat(`,${hero[key]}`));
                    } else {
                        this.heroesNamesMap.set(key, hero[key]);
                    }
                });
            });
        });
    },

    findHeroByPropertyName: function (search) {
        if (this.heroesNamesMap.size === 0) {
            this.assembleHeroesNames();
        }
        let heroProperty = null;
        for (let [heroProp, heroNames] of this.heroesNamesMap.entries()) {
            if (heroNames.split(',').find(it => it.unaccentClean() === search || it.unaccentClean().includes(search))) {
                heroProperty = heroProp;
                break;
            }
        }
        return heroProperty ? heroesBase.find(hero => hero.propertyName === heroProperty) : null;
    },

    listAllHeroes: function (searchInfos) {
        if (searchInfos) {
            return heroesBase.map(hero => this.findHeroInfosById(hero.id));
        }
        return heroesBase;
    },

    findHero: function (searchTerm, searchInfos) {
        const search = searchTerm.unaccentClean();

        let hero = this.findHeroByName(search);

        if (hero == null) {
            hero = heroesBase.find(hero =>
                hero.accessLink.unaccentClean() === search ||
                hero.id === search);
        }

        if (hero != null && searchInfos)
            hero = this.findHeroInfosById(hero.id);

        return hero
    },

    findHeroOrThrow: function (searchTerm, searchInfos) {
        const hero = this.findHero(searchTerm, searchInfos);
        if (!hero) {
            throw new HeroNotFoundException(searchTerm);
        }
        return hero;
    },

    findHeroByName: function (search) {
        const hero = heroesBase.find(heroInfo =>
            heroInfo.name.unaccentClean() === search ||
            heroInfo.name.unaccentClean().includes(search)
        );
        return hero ? hero : this.findHeroByPropertyName(search);
    },

    findHeroByPropertyName: function (search) {
        if (this.heroesNamesMap.size === 0) {
            this.assembleHeroesNames();
        }
        let heroProperty = null;
        for (let [heroProp, heroNames] of this.heroesNamesMap.entries()) {
            if (heroNames.split(',').find(it => it.unaccentClean() === search || it.unaccentClean().includes(search))) {
                heroProperty = heroProp;
                break;
            }
        }
        return heroProperty ? heroesBase.find(hero => hero.propertyName === heroProperty) : null;
    },

    listHeroesByName: function (search) {
        return heroesBase.filter(heroInfo =>
            heroInfo.name.unaccentClean() === search ||
            heroInfo.name.unaccentClean().startsWith(search)
        );
    },

    listHeroesByPropertyName: function (search) {
        if (this.heroesNamesMap.size === 0) {
            this.assembleHeroesNames();
        }
        const heroProperty = [];
        for (let [heroProp, heroNames] of this.heroesNamesMap.entries()) {
            const namesArray = heroNames.split(',');
            for (let name of namesArray) {
                const cleanName = name.unaccentClean();
                if (cleanName === search || cleanName.includes(search)) {
                    heroProperty.push(heroProp);
                    break;
                }
            }
        }
        return heroProperty.length > 0
            ? heroesBase.filter(hero => heroProperty.includes(hero.propertyName))
            : [];
    },

    findHeroById: function (id) {
        return heroesBase.find(hero => hero.id === id);
    },

    findHeroInfosById: function (idParam) {
        return this.heroesInfos?.find(hero => (hero.id === idParam));
    },

    listHeroesInfos: function () {
        return this.heroesInfos;
    },

    listHeroesBase: function () {
        return heroesBase;
    },

    getRotationObject: function () {
        return this.freeHeroes;
    },

    listCompositions: function () {
        return this.compositions;
    },

    listBanHeroes: function () {
        return this.mustBanHeroes;
    },
    
    setHeroesInfos: function (heroesParam) {
        this.heroesInfos = heroesParam;
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/heroes-infos.json`, this.heroesInfos);
    },

    setFreeHeroes: function (heroesParam) {
        this.freeHeroes = heroesParam;
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/freeweek.json`, this.freeHeroes);
    },

    setBanHeroes: function (heroesParam) {
        this.mustBanHeroes = heroesParam;
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/banlist.json`, this.mustBanHeroes);
    },

    setCompositions: function (compositionsParam) {
        this.compositions = compositionsParam;
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/compositions.json`, this.compositions);
    }
}