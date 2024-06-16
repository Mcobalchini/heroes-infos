const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringUtils.get('hero.not.found', heroName);

    let overviewText = 'Quick overview about the hero';
    if (hero.infos.overviewText) {
        overviewText = `**Via Icy Veins**: ${hero.infos.overviewText}`
    }
    //TODO use stringUtils
    return {
        ...HeroService.assembleBaseObject(hero),
        data: {
            featureName: StringUtils.get('overview'),
            featureDescription: overviewText,
            overview: [
                {
                    name: StringUtils.get('role'),
                    value: HeroService.getHeroRole(hero),
                    inline: false
                },
                {
                    name: StringUtils.get('universe'),
                    value: hero.universe,
                    inline: true
                },
                {
                    name: StringUtils.get('score'),
                    value: hero.infos.tierPosition.toString(),
                    inline: true
                }
            ]
        }
    }
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
    name: 'Overview',
    hint: 'Display a simple overview for the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};
