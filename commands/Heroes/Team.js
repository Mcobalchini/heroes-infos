const { EmojiRepository } = require('../../repositories/emoji-repository');
const { HeroRepository } = require('../../repositories/hero-repository');
const { RoleRepository } = require('../../repositories/role-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroes) => {
    heroes = heroes.replaceAll(',', ' ').replaceAll(';', ' ')
    let heroesSorted = JSON.parse(JSON.stringify(HeroRepository.listHeroesInfos().sort(HeroService.sortByTierPosition)))
        .filter(it => it.name !== 'Gall' && it.name !== 'Cho');

    let currentCompRoles = [];
    let heroesArray = heroes.split(' ');
    let currentCompHeroes = new Map();
    let remainingHeroes = 5;
    let suggested = [];

    for (let it of heroesArray) {
        if (it) {
            let hero = HeroRepository.findHero(it, true);
            if (hero != null) {
                if (currentCompHeroes.size >= 5) {
                    break;
                }
                currentCompHeroes.set(hero.id, hero);
            }
        }
    }

    if (currentCompHeroes.size > 4) {
        return StringUtils.get('more.than.four.heroes');
    }

    if (currentCompHeroes.size > 0) {
        remainingHeroes -= currentCompHeroes.size;
        const missingRolesMap = new Map();

        for (let currentCompHero of currentCompHeroes.values()) {
            heroesSorted = heroesSorted.filter(item => item.id !== currentCompHero.id);
            currentCompRoles.push(RoleRepository.findRoleById(currentCompHero.role).name);
        }
        currentCompRoles = currentCompRoles.sort();

        for (let currentCompHero of currentCompHeroes.values()) {
            let synergies = currentCompHero.infos.synergies.heroes.map(it => HeroRepository.findHero(it));
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

        let metaCompsRoles = HeroRepository.listCompositions().map(it => it.roles.sort());

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
                let role = RoleRepository.findRoleByName(missingRole);
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
                    role: RoleRepository.findRoleById(hero.role).name,
                }
            });

            return {                
                featureDescription: StringUtils.get('current.team', currentHeroes.map(it => `*${it.name}*`)?.join(', ')),
                data: {                    
                    suggestedHeroes: Array.from(missingRolesMap).map(([rolesArray, heroes]) => {
                        const missingHeroes = heroes.map(it => {
                            return `${EmojiRepository.getEmojiByName(it.name.unaccentClean())} ${it.name} - **${RoleRepository.findRoleById(it.role).name}**\n`
                        });
                        currentHeroes.forEach(it => {
                            missingHeroes.splice(rolesArray.indexOf(it.role),
                                0,
                                `~~${EmojiRepository.getEmojiByName(it.name.unaccentClean())} ${it.name} - ${RoleRepository.findRoleByName(it.role).name}~~\n`)
                        });
                        return {
                            name: `${rolesArray.map(it => RoleRepository.findRoleByName(it).name).join(', ')}`,
                            value: missingHeroes.join(''),
                            inline: false,
                        }
                    })
                }
            };
        } else {
            return {                
                featureDescription: `${StringUtils.get('current.team', Array.from(currentCompHeroes).map(([_, value]) => `${value.name}`).join(', '))}`,
                data: {
                    suggestedHeroes: Array.from(heroesSorted.splice(0, remainingHeroes)).map(it => {
                        return {
                            name: `${EmojiRepository.getEmojiByName(it.name.unaccentClean())} ${it.name}`,
                            value: RoleRepository.findRoleById(it.role).name,
                            inline: false,
                        }
                    })
                }
            };
        }
    }
    return StringUtils.get('no.team.check.heroes');
}

exports.help = {
    name: 'Team',
    displayName: StringUtils.get('team'),
    hint: 'Suggest a team based on the top competitive-tier composition.',
    argumentName: 'Heroes',
    argumentDescription: 'The names of at maximum 4 heroes in your current composition, separated by commas or spaces.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
}
