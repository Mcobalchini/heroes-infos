const { StringUtils } = require('../utils/string-utils.js');
const { logger } = require('./log-service.js');
const { RoleRepository } = require('../repositories/role-repository.js');
const { HeroRepository } = require('../repositories/hero-repository.js');

exports.HeroService = {        
    listHeroesSortedByScore: function (roleId) {
        let list = HeroRepository.listHeroesInfos().sort(this.sortByTierPosition);

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

    getHeroRole: function (hero) {
        return RoleRepository.findRoleById(hero.role)?.name ?? '_ _';
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

    updateHeroesInfos: function (heroesMap, popularityWinRate) {
        let heroesToUpdate = HeroRepository.listHeroesInfos();
        if (!heroesToUpdate.length) {
            heroesToUpdate = JSON.parse(JSON.stringify(HeroRepository.listHeroesBase()));
        }

        for (let [heroKey, heroData] of heroesMap) {
            let hero = heroesToUpdate.find(it => it.id === heroKey);
            const icyData = heroData.icyData;
            const psionicData = heroData.psionicData;
            const profileBuilds = heroData.profileData;

            if (hero == null) {
                hero = {};
            }

            hero.infos = {};
            hero.infos.builds = this.assembleHeroBuilds(hero,
                profileBuilds?.builds,
                icyData.builds
            );
            hero.infos.overviewText = icyData.overviewText;
            hero.infos.strengths = icyData.strengths;
            hero.infos.weaknesses = icyData.weaknesses
            hero.infos.synergies = icyData.synergies;
            hero.infos.counters = icyData.counters;
            hero.infos.strongerMaps = icyData.strongerMaps;
            hero.infos.hpBase = psionicData?.hp_base;
            hero.infos.hpScaling = psionicData?.hp_scaling;
            hero.infos.hpRegenBase = psionicData?.hp_regen_base;
            hero.infos.manaBase = psionicData?.mana_base;
            hero.infos.manaRegenBase = psionicData?.mana_regen_base;
            hero.infos.aaDmgBase = psionicData?.aa_dmg_base;
            hero.infos.aaDmgScaling = psionicData?.aa_dmg_scaling;
            hero.infos.aaSpeed = psionicData?.aa_speed;
            hero.infos.aaRange = psionicData?.aa_range;
            hero.infos.tips = icyData.tips.map(tip => `${tip}\n`).join('');

            let heroInfluence = popularityWinRate?.find(it => it.name.cleanVal() === hero.name.cleanVal());

            if (heroInfluence?.influence) {
                hero.infos.influence = parseInt(heroInfluence.influence) ?? - 1000;
            } else {
                logger.warn(`no influence data gathered for ${hero.name}`)
            }
        }

        const heroes = this.setHeroesTierPosition(heroesToUpdate);
        this.setHeroesCommonSynergies(heroes);
        HeroRepository.setHeroesInfos(heroes);
    },

    setHeroesCommonSynergies: function (heroesList) {
        logger.info(`setting heroes common synergies`);
        heroesList.forEach(hero => {
            const crossSynergies = heroesList?.filter(it => it.infos.synergies.heroes.map(clean => clean.cleanVal())?.includes(
                hero.name.cleanVal()
            ))?.map(synergy => synergy.name);
            hero.infos?.synergies?.heroes.push(...crossSynergies);
            hero.infos.synergies.heroes = Array.from(new Set(hero.infos.synergies.heroes));
        });
    },

    setHeroesTierPosition: function (heroesList) {
        logger.info(`setting heroes tier position`);
        heroesList.sort(function (a, b) {
            return (a.influence ?? 0) - (b.influence ?? 0);
        }).forEach(it => {
            if (it.infos) {
                it.infos.tierPosition = (it.infos?.influence ?? 0);
            }
        });
        return heroesList;
    },

    assembleHeroBuilds: function (hero, profileBuilds, icyBuilds) {
        if (profileBuilds == null)
            profileBuilds = [];

        if (profileBuilds?.length === 0) {
            logger.warn(`no (profile) builds found for ${hero.name}`);
        }

        //retrieves the duplicates
        let repeatedBuilds = profileBuilds?.filter(item =>
            (icyBuilds.map(it => it.skills.unaccent()).includes(item.skills.unaccent()))
        );

        //applies win rate on known build names
        if (repeatedBuilds != null) {
            icyBuilds.forEach(it => {
                for (let item of repeatedBuilds) {
                    if (item.skills.unaccent() === it.skills.unaccent()) {
                        it.winRate = item.winRate;
                    }
                }
            });
        }

        //removes the duplicate items
        if (profileBuilds) {
            profileBuilds = profileBuilds?.filter(item => !repeatedBuilds.includes(item));
        }

        const allBuilds = icyBuilds.concat(profileBuilds);
        allBuilds.forEach(build => {
            build.name = `[${build.name}](${build.link})`;
            if (build.winRate) {
                build.name = `${build.name} (${build.winRate}% win rate)`;
            }
        });
        return allBuilds;
    },

    updateRotation: function (result) {
        let freeHeroes = [];

        for (let heroName of result.heroes) {
            let freeHero = HeroRepository.findHero(heroName);
            let heroRole = RoleRepository.findRoleById(freeHero.role);
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
        HeroRepository.setFreeHeroes(rotation);
    },

    updateBanList: function (result) {
        let banList = [];
        result.forEach(it => {
            let banHero = HeroRepository.findHero(it);
            let heroRole = RoleRepository.findRoleById(banHero.role);
            banList.push({
                name: banHero.name,
                role: heroRole.name,
            });
        });        
        HeroRepository.setBanHeroes(banList);
    },

    updateCompositions: function (compositionsResult) {
        compositionsResult?.sort(function (a, b) {
            return a.games - b.games;
        }).forEach((it, idx) => {
            it.tierPosition = parseInt(idx + 1);
        });

        compositionsResult?.sort(function (a, b) {
            return a.winRate - b.winRate;
        }).forEach((it, idx) => {
            it.tierPosition = parseInt(it.tierPosition) + parseInt(idx + 1);
        });

        let sortedComposition = compositionsResult?.sort(function (a, b) {
            return a.tierPosition - b.tierPosition
        }).reverse();
        if (sortedComposition) {            
            HeroRepository.setCompositions(sortedComposition);
            logger.info(`updated compositions list`);
        } else {
            logger.info(`compositions list not updated (no data found)`);
        }
    },

    assembleBaseObject: function (hero) {
        return {
            thumbnail: `images/${hero.name.unaccentClean()}.png`,
            authorName: hero.name,
            authorUrl: `https://heroesofthestorm.blizzard.com/en-us/heroes/${hero.accessLink}`,
            avatar: `attachment://${hero.name.unaccentClean()}.png`,
        }
    },

    autoCompleteHeroes: function (heroName) {
        const heroesByName = HeroRepository.listHeroesByName(heroName);
        const heroesByProp = HeroRepository.listHeroesByPropertyName(heroName);
        const heroesSet = Array.from(new Set(heroesByName.concat(heroesByProp))).splice(0, 24);
        return heroesSet;
    },
};
