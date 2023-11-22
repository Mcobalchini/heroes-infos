const {StringService} = require('../../services/string-service');
const {HeroService} = require('../../services/hero-service');

exports.run = async (heroes) => {
    heroes = heroes.replaceAll(',',' ').replaceAll(';',' ')
    let heroesSorted = JSON.parse(JSON.stringify(HeroService.heroesInfos.sort(HeroService.sortByTierPosition)))
        .filter(it => it.name !== 'Gall' && it.name !== 'Cho');

    let currentCompRoles = [];
    let heroesArray = heroes.split(' ');
    let currentCompHeroes = new Map();
    let remainingHeroes = 5;
    let suggested = [];

    for (let it of heroesArray) {
        if (it) {
            let hero = HeroService.findHero(it, true);
            if (hero != null) {
                if (currentCompHeroes.size >= 5) {
                    break;
                }
                currentCompHeroes.set(hero.id, hero);
            }
        }
    }

    if (currentCompHeroes.size > 0) {
        remainingHeroes -= currentCompHeroes.size;
        const missingRolesMap = new Map();

        for (let currentCompHero of currentCompHeroes.values()) {
            heroesSorted = heroesSorted.filter(item => item.id !== currentCompHero.id);
            currentCompRoles.push(HeroService.findRoleById(currentCompHero.role).name);
        }
        currentCompRoles = currentCompRoles.sort();

        for (let currentCompHero of currentCompHeroes.values()) {
            let synergies = currentCompHero.infos.synergies.heroes.map(it => HeroService.findHero(it));
            synergies.forEach((synergy) => {
                let hero = heroesSorted.find(it => it.id === synergy.id)
                if (hero != null) {
                    if (hero.infos.tierPosition < 0) {
                        hero.infos.tierPosition *= -1;
                        hero.infos.tierPosition += 1000;
                    } else {
                        hero.infos.tierPosition += 2000;
                    }
                    hero.infos.tierPosition = hero.infos.tierPosition * 2;
                }
            });
        }

        //sorted filtered heroes
        heroesSorted = heroesSorted.sort(HeroService.sortByTierPosition).reverse();

        let metaCompsRoles = HeroService.compositions.map(it => it.roles.sort());

        for (let role of currentCompRoles) {
            let index = currentCompRoles.indexOf(role);
            if (index !== -1) {
                if (currentCompRoles[index + 1] === role) {
                    //it's a duplicate
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
                let role = HeroService.findRoleByName(missingRole);
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
                    name: hero.name,
                    role: HeroService.findRoleById(hero.role).name,
                }
            });

            return {
                data: {
                    featureName: StringService.get('suggested.team'),
                    featureDescription: StringService.get('current.team', currentHeroes.map(it => `*${it.name}*`)?.join(', ')),
                    suggestedHeroes: Array.from(missingRolesMap).map(([rolesArray, heroes]) => {
                        const missingHeroes = heroes.map(it => {
                            return `${it.name} - **${HeroService.findRoleById(it.role).name}**\n`
                        });
                        currentHeroes.forEach(it => {
                            missingHeroes.splice(rolesArray.indexOf(it.role),
                                0,
                                `~~${it.name} - ${HeroService.findRoleByName(it.role).name}~~\n`)
                        });
                        return {
                            name: `${rolesArray.map(it => HeroService.findRoleByName(it).name).join(', ')}`,
                            value: missingHeroes.join(''),
                            inline: false,
                        }
                    })
                }
            };
        } else {
            return {
                data: {
                    featureName: StringService.get('suggested.team'),
                    featureDescription: `${StringService.get('current.team', Array.from(currentCompHeroes).map(([_, value]) => `${value.name}`).join(', '))}`,
                    suggestedHeroes: Array.from(heroesSorted.splice(0, remainingHeroes)).map(it => {
                        return {
                            name: it.name,
                            value: HeroService.findRoleById(it.role).name,
                            inline: false,
                        }
                    })
                }
            };
        }
    }
    return StringService.get('no.team.check.heroes');
}

exports.help = {
    name: 'Team',
    hint: 'Suggest a team based on the top competitive-tier composition.',
    argumentName: 'Heroes',
    argumentDescription: 'The names of the heroes in your current composition, separated by commas or spaces.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
}
