const fs = require('fs');
const {App} = require("../app");
const {Maps} = require("./maps");
const roles = JSON.parse(fs.readFileSync('./data/constant/roles.json'), {encoding: 'utf8', flag: 'r'});
const StringUtils = require('./strings.js').StringUtils;
const heroesBase = JSON.parse(fs.readFileSync('./data/constant/heroes-base.json'), {encoding: 'utf8', flag: 'r'});
let heroesInfos = [];
let freeHeroes = [];
let mustBanHeroes = [];
let compositions = [];

try {
    heroesInfos = JSON.parse(fs.readFileSync('./data/heroes-infos.json'));
    mustBanHeroes = JSON.parse(fs.readFileSync('./data/banlist.json'));
    compositions = JSON.parse(fs.readFileSync('./data/compositions.json'));
    freeHeroes = JSON.parse(fs.readFileSync('./data/freeweek.json'));
} catch (e) {
    App.log('error while reading json data', e);
}

exports.Heroes = {

    hero: null,
    mustBanHeroes: mustBanHeroes,
    freeHeroes: freeHeroes,
    heroesInfos: heroesInfos,
    compositions: compositions,

    init: function (command, heroName) {
        return this.assembleReturnMessage(command, heroName);
    },

    sortByTierPosition: function (a, b) {
        return a.infos.tierPosition - b.infos.tierPosition;
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
            list = list.filter(hero => (hero.role === roleId))
        }

        return list.sort(this.sortByTierPosition).reverse().map(it => {
            return {
                name: this.getHeroName(it),
                score: StringUtils.get('hero.score', it.infos.tierPosition)
            }
        }).splice(0, 12)
    },

    findHero: function (searchTerm, searchInfos, evaluateThis) {
        let hero = heroesBase.find(hero =>
            hero.name.unaccentClean() === searchTerm.unaccentClean() ||
            hero.localizedName.unaccentClean() === searchTerm.unaccentClean()
        );

        if (hero == null) {
            hero = heroesBase.find(hero => hero.accessLink.unaccentClean() === searchTerm.unaccentClean() ||
                hero.id.unaccentClean() === searchTerm.unaccentClean() ||
                (hero.name.unaccentClean().includes(searchTerm.unaccentClean()) ||
                    hero.localizedName.unaccentClean().includes(searchTerm.unaccentClean())));
        }

        if (hero != null && searchInfos)
            hero = this.findHeroInfos(hero.id);
        if (evaluateThis) {
            this.hero = hero;
        }
        return hero
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

    getRoleName: function (roleParam) {
        return StringUtils.isEn() ? roleParam.name : roleParam.localizedName;
    },

    getHeroName: function (heroParam) {
        return StringUtils.isEn() ? heroParam.name : heroParam.localizedName;
    },

    getHeroBuilds: function () {
        return {
            featureName: StringUtils.get('builds'),
            builds: this.hero.infos.builds.map(build => {
                return {
                    name: build.skills,
                    value: build.name,
                    inline: false
                }
            })
        };
    },

    getHeroRole: function () {
        return this.getRoleName(this.findRoleById(this.hero.role));
    },

    getHeroUniverse: function () {
        return this.hero.universe;
    },

    getHeroTierPosition: function () {
        return this.hero.infos.tierPosition;
    },

    getHeroCounters: function () {
        return {
            featureName: StringUtils.get('counters'),
            counter: this.hero.infos.counters.map(counter => {
                const hero = this.findHero(counter, true, false);
                return {
                    name: this.getHeroName(hero),
                    value: this.getRoleName(this.findRoleById(hero.role)),
                    inline: true
                }
            })
        };
    },

    getHeroStrongerMaps: function () {
        return {
            featureName: StringUtils.get('stronger.maps'),
            strongerMaps: this.hero.infos.strongerMaps.map(strongerMap => {
                const mapName = StringUtils.isEn() ? strongerMap.name : strongerMap.localizedName;
                return {
                    name: "** **",
                    value: mapName,
                    inline: true
                }
            })
        };
    },

    getHeroSynergies: function () {
        return {
            featureName: StringUtils.get('synergies'),
            synergies: this.hero.infos.synergies.map(synergy => {
                const hero = this.findHero(synergy, true, false);
                return {
                    name: this.getHeroName(hero),
                    value: this.getRoleName(this.findRoleById(hero.role)),
                    inline: true
                }
            })
        };
    },

    getHeroTips: function () {
        let tips
        if (StringUtils.language === 'pt-br') {
            tips = this.hero.infos.localizedTips ? this.hero.infos.localizedTips : ' ';
        } else {
            tips = this.hero.infos.tips;
        }

        return {
            featureName: StringUtils.get('tips'),
            description: tips
        }
    },

    getHeroOverview: function () {
        return {
            featureName: StringUtils.get('overview'),
            overview: [
                {
                    name: StringUtils.get('role'),
                    value: this.getHeroRole(),
                    inline: false
                },
                {
                    name: StringUtils.get('universe'),
                    value: this.getHeroUniverse(),
                    inline: true
                },
                {
                    name: StringUtils.get('score'),
                    value: this.getHeroTierPosition().toString(),
                    inline: true
                }
            ]
        }
    },

    getHeroInfos: function () {
        return {
            featureName: ' ',
            overview: this.getHeroOverview(),
            heroBuilds: this.getHeroBuilds(),
            heroSynergies: this.getHeroSynergies(),
            heroCounters: this.getHeroCounters(),
            heroStrongerMaps: this.getHeroStrongerMaps(),
            heroTips: this.getHeroTips()
        };
    },

    setHeroesInfos: function (heroesParam) {
        this.heroesInfos = heroesParam;
    },

    updateHeroesInfos: function (heroesMap, popularityWinRate) {
        for (let [heroKey, heroData] of heroesMap) {
            let index = heroesInfos.findIndex(it => it.id === heroKey);
            let icyData = heroData.icyData
            let profileData = heroData.profileData
            let heroMaps = [];

            for (let strongerMap of icyData.strongerMaps) {
                let heroMap = Maps.findMap(strongerMap);
                if (heroMap)
                    heroMaps.push({
                        name: heroMap.name,
                        localizedName: heroMap.localizedName
                    });
            }

            if (heroesInfos[index] == null) {
                heroesInfos[index] = {};
            }

            heroesInfos[index].infos = {};
            heroesInfos[index].id = heroKey;
            heroesInfos[index].name = this.findHero(heroKey, false, true).name;
            heroesInfos[index].infos.builds = this.assembleHeroBuilds(profileData,
                heroesInfos,
                heroesInfos[index],
                icyData
            );

            heroesInfos[index].infos.synergies = icyData.synergies;
            heroesInfos[index].infos.counters = icyData.counters;
            heroesInfos[index].infos.strongerMaps = heroMaps;
            heroesInfos[index].infos.tips = icyData.tips.map(tip => `${tip}\n`).join('');

            let obj = popularityWinRate?.find(it => {
                return it.name.cleanVal() === heroesInfos[index].name.cleanVal()
            });
            heroesInfos[index].infos.winRate = obj?.winRate ?? 0;
            heroesInfos[index].infos.games = obj?.games ?? 0;
        }
        this.setHeroesInfos(heroesInfos);
        this.setHeroesTierPosition();
        return this.heroesInfos;
    },

    assembleHeroBuilds: function (profileData, hero, index, icyData) {

        if (profileData?.builds?.length === 0) {
            App.log(`No (profile) builds found for ${hero.name}`);
        }

        //retrieves the duplicate items
        let repeatedBuilds = profileData?.builds?.filter(item =>
            (icyData.builds.map(it => it.skills.unaccent()).includes(item.skills.unaccent()))
        );

        //applies winrate on known builds names
        icyData.builds.forEach(it => {
            for (let item of repeatedBuilds) {
                if (item.skills.unaccent() === it.skills.unaccent()) {
                    it.name = `${it.name} (${item.name.match(/([\d.]%*)/g, '').join('').replace('..', '')} win rate)`
                }
            }
        });

        //removes the duplicate items
        if (profileData)
            profileData.builds = profileData?.builds?.filter(item => !repeatedBuilds.includes(item));

        return icyData.builds.concat(profileData?.builds?.slice(0, 4)).slice(0, 5);
    },


    setHeroesTierPosition: function () {
        App.log(`setting heroes tier position`);
        this.heroesInfos.sort(function (a, b) {
            return a.infos.games - b.infos.games;
        }).forEach((it, idx) => {
            it.infos.tierPosition = parseInt(idx + 1);
        });

        this.heroesInfos.sort(function (a, b) {
            return a.infos.winRate - b.infos.winRate;
        }).forEach((it, idx) => {
            it.infos.tierPosition = parseInt(it.infos.tierPosition) + parseInt(idx + 1);
        })
    },

    setFreeHeroes: function (heroesParam) {
        this.freeHeroes = heroesParam;
        App.writeFile('data/freeweek.json', heroesParam);
    },

    updateRotation: function (result) {
        let freeHeroes = [];

        for (let heroName of result.heroes) {
            let freeHero = this.findHero(heroName, false, true);
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
            let banHero = this.findHero(it, false, true);
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
        App.writeFile('data/compositions.json', sortedComposition);
        App.log(`Updated compositions list`);
    },

    setBanHeroes: function (heroesParam) {
        this.mustBanHeroes = heroesParam;
        App.writeFile('data/banlist.json', heroesParam);
    },

    setCompositions: function (compositionsParam) {
        this.compositions = compositionsParam;
    },

    assembleBanListReturnMessage: function () {
        return {
            data: {
                featureName: StringUtils.get('suggested.bans'),
                mustBanHeroes: this.mustBanHeroes.map(ban => {
                    const hero = this.findHero(ban.name, false, false);
                    return {
                        name: this.getHeroName(hero),
                        value: this.getRoleName(this.findRoleById(hero.role)),
                        inline: false
                    }
                })
            }
        }
    },

    assembleFreeWeekHeroesReturnMessage: function () {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return {
            data: {
                featureName: StringUtils.get('free.heroes'),
                featureDescription: StringUtils.get('rotation.dates',
                    new Date(`${this.freeHeroes?.startDate} `).toLocaleDateString(StringUtils.language, options),
                    new Date(`${this.freeHeroes?.endDate} `).toLocaleDateString(StringUtils.language, options)),
                freeHeroes: (this.freeHeroes?.heroes?.length <= 0 ? StringUtils.get('no.free.heroes') : this.freeHeroes?.heroes?.map(freeHero => {
                    const hero = this.findHero(freeHero.name, false, false);
                    return {
                        name: this.getHeroName(hero),
                        value: this.getRoleName(this.findRoleById(hero.role)),
                        inline: true
                    }
                })),
                image: 'images/freeweek.png'
            }
        }
    },

    assembleSuggestHeroesReturnMessage: function (roleName) {
        let role = null;
        let actualName = null;
        if (roleName != null && roleName !== '') {
            role = this.findRoleByName(roleName)
            if (role == null) {
                return StringUtils.get('role.not.found', roleName);
            } else {
                actualName = StringUtils.isEn() ? role.name : role.localizedName;
            }
        }

        const str = role !== null ? StringUtils.get('on.role', actualName) : ''

        return {
            data: {
                featureName: StringUtils.get('suggested.heroes', str),
                suggestions: this.findHeroesByScore(parseInt(role?.id)).map(it => {
                    return {
                        name: it.name,
                        value: it.score,
                        inline: true
                    };
                })
            }
        }
    },

    assembleTeamReturnMessage: function (heroes) {
        let heroesSorted = JSON.parse(JSON.stringify(this.heroesInfos.sort(this.sortByTierPosition)))
            .filter(it => it.name !== "Gall" && it.name !== "Cho");

        let currentCompRoles = [];
        let heroesArray = heroes.split(' ');
        let currentCompHeroes = new Map();
        let remainingHeroes = 5;
        let suggested = [];

        for (let it of heroesArray) {
            let hero = this.findHero(it, true, false);
            if (hero != null) {
                if (currentCompHeroes.size >= 5) {
                    break;
                }
                currentCompHeroes.set(hero.id, hero);
            }
        }

        if (currentCompHeroes.size > 0) {
            remainingHeroes -= currentCompHeroes.size;
            const missingRolesMap = new Map()

            for (let currentCompHero of currentCompHeroes.values()) {
                heroesSorted = heroesSorted.filter(item => item.id !== currentCompHero.id);
                currentCompRoles.push(this.findRoleById(currentCompHero.role).name);
            }
            currentCompRoles = currentCompRoles.sort();

            for (let currentCompHero of currentCompHeroes.values()) {
                let synergies = currentCompHero.infos.synergies.map(it => this.findHero(it, false, true));
                synergies.forEach((synergy) => {
                    let hero = heroesSorted.find(it => it.id === synergy.id)
                    if (hero != null)
                        hero.infos.tierPosition = hero.infos.tierPosition * 2;
                });
            }

            //sorted filtered heroes
            heroesSorted = heroesSorted.sort(this.sortByTierPosition).reverse();

            let metaCompsRoles = this.compositions.map(it => it.roles.sort());

            for (let role of currentCompRoles) {
                let index = currentCompRoles.indexOf(role);
                if (index !== -1) {
                    if (currentCompRoles[index + 1] === role) {
                        //is a duplicate
                        metaCompsRoles = metaCompsRoles.filter(it => it.toString().includes(role + ',' + role));
                    }
                }
                metaCompsRoles = metaCompsRoles.filter(it => it.includes(role));
            }

            metaCompsRoles = metaCompsRoles.splice(0, 3);
            if (metaCompsRoles.length > 0) {

                for (let comp of metaCompsRoles) {
                    let missingRoles = JSON.parse(JSON.stringify(comp));

                    for (let currentRole of currentCompRoles) {
                        let index = missingRoles.indexOf(currentRole);
                        if (index !== -1)
                            missingRoles.splice(missingRoles.indexOf(currentRole), 1);
                    }

                    missingRolesMap.set(comp, missingRoles);
                }
            }

            //filter missing role heroes only
            for (let [key, value] of missingRolesMap.entries()) {
                for (let missingRole of value) {
                    let role = this.findRoleByName(missingRole);
                    let hero = heroesSorted.filter(heroToShift => heroToShift.role == role.id).shift();
                    heroesSorted = heroesSorted.filter(heroFiltered => heroFiltered.id != hero.id);

                    suggested.push(hero);
                }
                missingRolesMap.set(key, suggested);
                suggested = [];
            }

            if (Array.from(missingRolesMap.values())[0]?.length) {
                const currentHeroes = Array.from(currentCompHeroes).map(([_, hero]) => {
                    return {
                        name: this.getHeroName(hero),
                        role: this.findRoleById(hero.role).name,
                    }
                });

                return {
                    data: {
                        featureName: StringUtils.get('suggested.team'),
                        featureDescription: StringUtils.get('current.team', currentHeroes.map(it => `*${it.name}*`)?.join(', ')),
                        suggestedHeroes: Array.from(missingRolesMap).map(([rolesArray, heroes]) => {
                            const missingHeroes = heroes.map(it => {
                                return `${this.getHeroName(it)} - **${this.getRoleName(this.findRoleById(it.role))}**\n`
                            });
                            currentHeroes.forEach(it => {
                                missingHeroes.splice(rolesArray.indexOf(it.role),
                                    0,
                                    `~~${it.name} - ${this.getRoleName(this.findRoleByName(it.role))}~~\n`)
                            });
                            return {
                                name: `${rolesArray.map(it => this.getRoleName(this.findRoleByName(it))).join(', ')}`,
                                value: missingHeroes.join(''),
                                inline: false,
                            }
                        })
                    }
                };
            } else {
                return {
                    data: {
                        featureName: StringUtils.get('suggested.team'),
                        featureDescription: `${StringUtils.get('current.team', Array.from(currentCompHeroes).map(([_, value]) => `${this.getHeroName(value)}`).join(', '))}`,
                        suggestedHeroes: Array.from(heroesSorted.splice(0, remainingHeroes)).map(it => {
                            return {
                                name: this.getHeroName(it),
                                value: this.getRoleName(this.findRoleById(it.role)),
                                inline: false,
                            }
                        })
                    }
                };
            }
        }
        return 'No team'
    },

    assembleReturnMessage: function (commandObj, argument) {
        let reply;

        if (commandObj.name === 'Banlist') {
            reply = this.assembleBanListReturnMessage();
        } else if (commandObj.name === 'FreeWeek') {
            reply = this.assembleFreeWeekHeroesReturnMessage();
        } else if (commandObj.name === 'Suggest') {
            reply = this.assembleSuggestHeroesReturnMessage(argument);
        } else if (commandObj.name === 'Team') {
            reply = this.assembleTeamReturnMessage(argument);
        } else {
            if (argument.length > 0) {
                this.findHero(argument, true, true);
                if (this.hero != null) {
                    if (this.hero.infos != null && (this.hero.infos.counters.length > 0 &&
                        this.hero.infos.synergies.length > 0 &&
                        this.hero.infos.builds.length > 0)) {
                        let returnedValues = eval(`this.getHero${commandObj.name}()`);
                        return {
                            authorImage: `images/${this.hero.name.unaccentClean().replaceAll(' ', '-')}.png`,
                            heroName: this.getHeroName(this.hero),
                            heroLink: `https://www.icy-veins.com/heroes/${this.hero.accessLink}-build-guide`,
                            data: returnedValues
                        };
                    } else {
                        reply = StringUtils.get('not.enough.hero.infos', argument);
                    }
                } else {
                    reply = StringUtils.get('hero.not.found', argument);
                }
            } else {
                reply = StringUtils.get('hero.not.found', argument);
            }
        }
        return reply;
    }
};
