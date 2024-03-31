const { FileUtils } = require('../utils/file-utils.js');
const { StringUtils } = require('../utils/string-utils.js');
const { LogService } = require('./log-service.js');
const roles = FileUtils.openJsonSync('./data/constant/roles.json');
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
    LogService.log('error while reading json data', e);
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

    findAllHeroes: function (searchInfos) {
        if (searchInfos) {
            return heroesBase.map(hero => this.findHeroInfos(hero.id));
        }
        return heroesBase;
    },

    listHeroesSortedByScore: function (roleId) {
        let list = this.heroesInfos.sort(this.sortByTierPosition);

        if (isNaN(roleId) === false) {
            list = list.filter(hero => (hero.role === roleId)).sort(this.sortByTierPosition)
        }

        return list.sort(this.sortByTierPosition).reverse().map(it => {
            return {
                name: it.name,
                score: StringUtils.get('hero.score', it.infos.tierPosition)
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

    findHeroById: function (search) {
        return heroesBase.find(heroInfo => heroInfo.id === search);
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

    findHeroInfos: function (idParam) {
        return this.heroesInfos.find(hero => (hero.id === idParam));
    },

    getRoles: function () {
        return this.roles;
    },

    findRoleById: function (roleId) {
        let role = roles.find(role => (role.id.toString().cleanVal() === roleId.toString().cleanVal()));
        if (role) {
            return role;
        }
    },

    findRoleByName: function (roleName) {
        let role = roles.find(role => role.name.cleanVal() === roleName.cleanVal());
        if (role) {
            return role;
        }
    },

    getHeroRole: function (hero) {
        return this.findRoleById(hero.role)?.name ?? '_ _';
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

    sortByTierPosition: function (a, b) {
        return a.infos?.tierPosition - b.infos?.tierPosition;
    },

    setHeroesInfos: function (heroesParam) {
        this.heroesInfos = heroesParam;
    },

    updateHeroesInfos: function (heroesMap, popularityWinRate) {
        if (!this.heroesInfos.length) {
            this.heroesInfos = JSON.parse(JSON.stringify(heroesBase));
        }

        for (let [heroKey, heroData] of heroesMap) {
            let hero = this.heroesInfos.find(it => it.id === heroKey);
            let icyData = heroData.icyData
            let profileBuilds = heroData.profileData

            if (hero == null) {
                hero = {};
            }

            hero.infos = {};
            hero.infos.builds = this.assembleHeroBuilds(hero,
                profileBuilds?.builds,
                icyData.builds
            );

            hero.infos.synergies = icyData.synergies;
            hero.infos.counters = icyData.counters;
            hero.infos.strongerMaps = icyData.strongerMaps;
            hero.infos.tips = icyData.tips.map(tip => `${tip}\n`).join('');

            let heroInfluence = popularityWinRate?.find(it => it.name.cleanVal() === hero.name.cleanVal());

            if (heroInfluence?.influence) {
                hero.infos.influence = parseInt(heroInfluence.influence) ?? - 1000;
            } else {
                LogService.log(`No influence data gathered for ${hero.name}`)
            }
        }

        const heroes = this.setHeroesTierPosition(this.heroesInfos);
        this.setHeroesInfos(heroes);
        this.setHeroesCommonSynergies();
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/heroes-infos.json`, this.heroesInfos);
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

    assembleHeroBuilds: function (hero, profileBuilds, icyBuilds) {
        if (profileBuilds == null)
            profileBuilds = [];

        if (profileBuilds?.length === 0) {
            LogService.log(`No (profile) builds found for ${hero.name}`);
        }

        //retrieves the duplicate items
        let repeatedBuilds = profileBuilds?.filter(item =>
            (icyBuilds.map(it => it.skills.unaccent()).includes(item.skills.unaccent()))
        );

        //applies winrate on known builds names
        if (repeatedBuilds != null) {
            icyBuilds.forEach(it => {
                for (let item of repeatedBuilds) {
                    if (item.skills.unaccent() === it.skills.unaccent()) {
                        it.name = `${it.name} (${item.name.match(/([\d.]%*)/g, '').join('').replace('..', '')} win rate)`
                    }
                }
            });
        }

        //removes the duplicate items
        if (profileBuilds)
            profileBuilds = profileBuilds?.filter(item => !repeatedBuilds.includes(item));

        return icyBuilds.concat(profileBuilds);
    },

    setHeroesTierPosition: function (heroesParam) {
        LogService.log(`setting heroes tier position`);
        heroesParam.sort(function (a, b) {
            return (a.influence ?? 0) - (b.influence ?? 0);
        }).forEach(it => {
            if (it.infos) {
                it.infos.tierPosition = (it.infos?.influence ?? 0);
            }
        });
        return heroesParam;
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
        result?.sort(function (a, b) {
            return a.games - b.games;
        }).forEach((it, idx) => {
            it.tierPosition = parseInt(idx + 1);
        });

        result?.sort(function (a, b) {
            return a.winRate - b.winRate;
        }).forEach((it, idx) => {
            it.tierPosition = parseInt(it.tierPosition) + parseInt(idx + 1);
        });

        let sortedComposition = result?.sort(function (a, b) {
            return a.tierPosition - b.tierPosition
        }).reverse();

        this.setCompositions(sortedComposition);
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/compositions.json`, sortedComposition);
        LogService.log(`Updated compositions list`);
    },

    assembleBaseObject: function (hero) {
        return {
            authorImage: `images/${hero.name.unaccentClean()}.png`,
            authorName: hero.name,
            authorUrl: `https://heroesofthestorm.blizzard.com/en-us/heroes/${hero.accessLink}`,
        }
    },

    setFreeHeroes: function (heroesParam) {
        this.freeHeroes = heroesParam;
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/freeweek.json`, heroesParam);
    },

    setBanHeroes: function (heroesParam) {
        this.mustBanHeroes = heroesParam;
        FileUtils.writeJsonFile(`data/variable/${process.env.CLIENT_ID}/banlist.json`, heroesParam);
    },

    setCompositions: function (compositionsParam) {
        this.compositions = compositionsParam;
    }
};
