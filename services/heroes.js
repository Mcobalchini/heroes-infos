const fs = require('fs');
const config = require('../config.json');
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
    process.stdout.write('error: ' + e + '\n');
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

    findHero: function (heroName, searchInfos, evaluateThis) {
        let hero = heroesBase.find(hero =>
            (hero.name.unaccentClean() === heroName.unaccentClean() ||
                hero.localizedName.unaccentClean() === heroName.unaccentClean() ||
                hero.accessLink.unaccentClean() === heroName.unaccentClean() ||
                hero.id.unaccentClean() === heroName.unaccentClean() ||
                (hero.name.unaccentClean() + ' (' + hero.localizedName.unaccentClean() + ')' === heroName.unaccentClean()) ||
                (hero.name.unaccentClean().includes(heroName.unaccentClean()) ||
                    hero.localizedName.unaccentClean().includes(heroName.unaccentClean()) ||
                    ((hero.name.unaccentClean() + ' (' + hero.localizedName.unaccentClean() + ')').includes(heroName.unaccentClean()))))
        );

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
                    name: build.name,
                    value: build.skills,
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
                const hero = this.findHero(counter.name, true, false);
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
                const hero = this.findHero(synergy.name, true, false);
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

    setFreeHeroes: function (heroesParam) {
        this.freeHeroes = heroesParam;
    },

    setBanHeroes: function (heroesParam) {
        this.mustBanHeroes = heroesParam;
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
                }),
                footer: true,
            },
            image: 'images/hots.png'
        }
    },

    assembleFreeWeekHeroesReturnMessage: function () {
        if (this.freeHeroes.length <= 0) {
            return StringUtils.get('no.free.heroes');
        }

        return {
            data: {
                featureName: StringUtils.get('free.heroes'),
                freeHeroes: this.freeHeroes.map(freeHero => {
                    const hero = this.findHero(freeHero.name, false, false);
                    return {
                        name: this.getHeroName(hero),
                        value: this.getRoleName(this.findRoleById(hero.role)),
                        inline: true
                    }
                }),
                footer: true
            },
            image: 'images/hots.png'
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
                let synergies = currentCompHero.infos.synergies.map(it => this.findHero(it.name, false, true));
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
                return {
                    data: {
                        featureName: StringUtils.get('suggested.team'),
                        featureDescription: `${StringUtils.get('current.team', Array.from(currentCompHeroes).map(([_, value]) => `${this.getHeroName(value)}`).join(', '))}`,
                        suggestedHeroes: Array.from(missingRolesMap).map(([key, value]) => {
                            return {
                                name: `Comp: ${key.map(it => this.getRoleName(this.findRoleByName(it))).join(', ')}`,
                                value: value.map(it => `${this.getHeroName(it)} - **${this.getRoleName(this.findRoleById(it.role))}**\n`).join(''),
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
                        if (commandObj.isFromIcyVeins){
                            returnedValues.footer = true;
                        }
                        reply = {
                            image: `images/${this.hero.name.unaccentClean().replaceAll(' ', '-')}.png`,
                            heroName: this.getHeroName(this.hero),
                            heroLink: `https://www.icy-veins.com/heroes/${this.hero.accessLink}-build-guide`,
                            data: returnedValues
                        };
                    } else {
                        reply = StringUtils.get('not.enough.hero.infos', argument, config.prefix);
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
