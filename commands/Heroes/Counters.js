const { HeroRepository } = require('../../repositories/hero-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroRepository.findHeroOrThrow(heroName, true);
    return {
        ...HeroService.assembleBaseObject(hero),
        featureDescription: hero.infos.counters.countersText + '\n' + StringUtils.get('hero.examples'),
        data: {            
            counter: hero.infos.counters.heroes.map(counter => {
                const heroCounter = HeroRepository.findHero(counter);
                return {
                    name: heroCounter.name,
                    value: HeroService.getHeroRole(heroCounter),
                    inline: true
                }
            })
        }
    };
}

exports.autoComplete = (heroName) => {    
    const heroes = HeroService.autoCompleteHeroes(heroName);
    return heroes.map(hero => (
        {
            name: hero.name,
            value: hero.name
        }
    ));
}

exports.help = {
    name: 'Counters',
    hint: 'Display heroes that counter the specified hero!',
    argumentName: 'Hero',
    displayName: StringUtils.get('counters'),
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
