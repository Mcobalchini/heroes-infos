const {App} = require("../app");
const {FileService} = require("./file-service");
const roles = FileService.openJsonSync('./data/constant/roles.json');
const StringService = require('./string-service.js').StringService;
const heroesBase = FileService.openJsonSync('./data/constant/heroes-base.json').sort((a, b) => a.name.localeCompare(b.name));
const heroesPropertiesDir = './data/constant/heroes-names/';
let heroesInfos = [];
let freeHeroes = [];
let mustBanHeroes = [];
let compositions = [];

try {
    heroesInfos = FileService.openJsonSync('./data/heroes-infos.json');
    mustBanHeroes = FileService.openJsonSync('./data/banlist.json');
    compositions = FileService.openJsonSync('./data/compositions.json');
    freeHeroes = FileService.openJsonSync('./data/freeweek.json');
} catch (e) {
    App.log('error while reading json data', e);
}

exports.HeroService = {

    hero: null,
    mustBanHeroes: mustBanHeroes,
    freeHeroes: freeHeroes,
    heroesInfos: heroesInfos,
    compositions: compositions,
    heroesNamesMap: new Map(),

    assembleHeroesNames: function () {
        const heroesNames = [];
        const folder = FileService.openDir(heroesPropertiesDir);
        folder.forEach(folderLanguage => {
            heroesNames.push(
                JSON.parse(
                    FileService.openFile(heroesPropertiesDir + folderLanguage + '/heroes.json')
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

    sortByTierPosition: function (a, b) {
        return a.infos?.tierPosition - b.infos?.tierPosition;
    },

    findAllHeroes: function (searchInfos) {
        if (searchInfos) {
            return heroesBase.map(hero => this.findHeroInfos(hero.id));
        }
        return heroesBase;
    },

    findHeroesByScore: function (roleId) {
        let list = this.heroesInfos.sort(this.sortByTierPosition);

        if (isNaN(roleId) === false) {
            list = list.filter(hero => (hero.role === roleId)).sort(this.sortByTierPosition)
        }

        return list.sort(this.sortByTierPosition).reverse().map(it => {
            return {
                name: it.name,
                score: StringService.get('hero.score', it.infos.tierPosition)
            }
        }).splice(0, 12)
    },

    findHero: function (searchTerm, searchInfos) {
        const search = searchTerm.unaccentClean();

        let hero = this.findHeroByName(search);

        if (hero == null) {
            hero = heroesBase.find(hero =>
                hero.accessLink.unaccentClean() === search ||
                hero.id.unaccentClean() === search);
        }

        if (hero != null && searchInfos)
            hero = this.findHeroInfos(hero.id);

        return hero
    },

    findHeroByName: function (search) {
        let hero = heroesBase.find(heroInfo =>
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
            if (heroNames.split(",").find(it => it.unaccentClean() === search || it.unaccentClean().includes(search))) {
                heroProperty = heroProp;
                break;
            }
        }
        return heroProperty ? heroesBase.find(hero => hero.propertyName === heroProperty) : null;
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

    getHeroRole: function (hero) {
        return this.findRoleById(hero.role).name;
    },

    // getHeroInfos: function () {
    //     return {
    //         featureName: ' ',
    //         overview: this.getHeroOverview(),
    //         heroBuilds: this.getHeroBuilds(),
    //         heroSynergies: this.getHeroSynergies(),
    //         heroCounters: this.getHeroCounters(),
    //         heroStrongerMaps: this.getHeroStrongerMaps(),
    //         heroTips: this.getHeroTips()
    //     };
    // },

    setHeroesInfos: function (heroesParam) {
        this.heroesInfos = heroesParam;
    },

    updateHeroesInfos: function (heroesMap, popularityWinRate, heroesInfos) {
        for (let [heroKey, heroData] of heroesMap) {
            let index = heroesInfos.findIndex(it => it.id === heroKey);
            let icyData = heroData.icyData
            let profileData = heroData.profileData

            if (heroesInfos[index] == null) {
                heroesInfos[index] = {};
            }

            heroesInfos[index].infos = {};
            heroesInfos[index].id = heroKey;
            heroesInfos[index].name = this.findHero(heroKey).name;
            heroesInfos[index].infos.builds = this.assembleHeroBuilds(profileData,
                heroesInfos[index],
                icyData
            );

            heroesInfos[index].infos.synergies = icyData.synergies;
            heroesInfos[index].infos.counters = icyData.counters;
            heroesInfos[index].infos.strongerMaps = icyData.strongerMaps;
            heroesInfos[index].infos.tips = icyData.tips.map(tip => `${tip}\n`).join('');

            let obj = popularityWinRate?.find(it => {
                return it.name.cleanVal() === heroesInfos[index].name.cleanVal()
            });
            heroesInfos[index].infos.influence = parseInt(obj.influence) ?? - 1000;
        }
        const heroes = this.setHeroesTierPosition(heroesInfos);
        this.setHeroesInfos(heroes);
        this.setHeroesCommonSynergies();
        FileService.writeJsonFile('data/heroes-infos.json', this.heroesInfos);
    },

    setHeroesCommonSynergies: function () {
        this.heroesInfos.forEach(hero => {
            const crossSynergies = this.heroesInfos?.filter(it => it.infos.synergies.heroes.map(clean => clean.cleanVal())?.includes(
                hero.name.cleanVal()
            ))?.map(synergy => synergy.name);
            hero.infos?.synergies?.heroes.push(...crossSynergies);
            hero.infos.synergies.heroes = Array.from(new Set(hero.infos.synergies.heroes));
        });
    },

    assembleHeroBuilds: function (profileData, hero, icyData) {

        if (profileData == null)
            profileData = {};

        if (profileData?.builds == null)
            profileData.builds = [];

        if (profileData?.builds?.length === 0) {
            App.log(`No (profile) builds found for ${hero.name}`);
        }

        //retrieves the duplicate items
        let repeatedBuilds = profileData?.builds?.filter(item =>
            (icyData.builds.map(it => it.skills.unaccent()).includes(item.skills.unaccent()))
        );

        //applies winrate on known builds names
        if (repeatedBuilds != null) {
            icyData.builds.forEach(it => {
                for (let item of repeatedBuilds) {
                    if (item.skills.unaccent() === it.skills.unaccent()) {
                        it.name = `${it.name} (${item.name.match(/([\d.]%*)/g, '').join('').replace('..', '')} win rate)`
                    }
                }
            });
        }

        //removes the duplicate items
        if (profileData)
            profileData.builds = profileData?.builds?.filter(item => !repeatedBuilds.includes(item));

        return icyData.builds.concat(profileData?.builds?.slice(0, 4)).slice(0, 5);
    },

    setHeroesTierPosition: function (heroesParam) {
        App.log(`setting heroes tier position`);
        heroesParam.sort(function (a, b) {
            return (a.influence ?? 0) - (b.influence ?? 0);
        }).forEach(it => {
            if (it.infos) {
                it.infos.tierPosition = (it.infos?.influence ?? 0);
            }
        });
        return heroesParam;
    },

    setFreeHeroes: function (heroesParam) {
        this.freeHeroes = heroesParam;
        FileService.writeJsonFile('data/freeweek.json', heroesParam);
    },

    getRotationData: function () {
        return this.freeHeroes;
    },

    updateRotation: function (result) {
        let freeHeroes = [];

        for (let heroName of result.heroes) {
            let freeHero = this.findHero(heroName);
            let heroRole = this.findRoleById(freeHero.role);
            freeHeroes.push({
                name: freeHero.name,
                role: heroRole.name
            });
        }

        const rotation = {
            startDate: result.startDate,
            endDate: result.endDate,
            heroes: freeHeroes
        };
        this.setFreeHeroes(rotation);
    },

    updateBanList: function (result) {
        let banList = [];
        result.forEach(it => {
            let banHero = this.findHero(it);
            let heroRole = this.findRoleById(banHero.role);
            banList.push({
                name: banHero.name,
                role: heroRole.name,
            });
        });
        this.setBanHeroes(banList);
    },

    updateCompositions: function (result) {
        result.sort(function (a, b) {
            return a.games - b.games;
        }).forEach((it, idx) => {
            it.tierPosition = parseInt(idx + 1);
        });

        result.sort(function (a, b) {
            return a.winRate - b.winRate;
        }).forEach((it, idx) => {
            it.tierPosition = parseInt(it.tierPosition) + parseInt(idx + 1);
        });

        let sortedComposition = result.sort(function (a, b) {
            return a.tierPosition - b.tierPosition
        }).reverse();

        this.setCompositions(sortedComposition);
        FileService.writeJsonFile('data/compositions.json', sortedComposition);
        App.log(`Updated compositions list`);
    },

    setBanHeroes: function (heroesParam) {
        this.mustBanHeroes = heroesParam;
        FileService.writeJsonFile('data/banlist.json', heroesParam);
    },

    setCompositions: function (compositionsParam) {
        this.compositions = compositionsParam;
    }
};
