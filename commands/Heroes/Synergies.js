const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHeroOrThrow(heroName, true);
    const synergies = hero.infos.synergies.heroes.map(synergy => {
        const synergyHero = HeroService.findHero(synergy);
        return {
            name: synergyHero.name,
            value: HeroService.getHeroRole(synergyHero),
            inline: true
        }
    });

    return {
        ...HeroService.assembleBaseObject(hero),        
        featureDescription: hero.infos.synergies.synergiesText + '\n' + StringUtils.get('hero.examples'),
        data: {
            synergies
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
    name: 'Synergies',
    displayName: StringUtils.get('synergies'),
    hint: 'Display heroes that synergize with the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
