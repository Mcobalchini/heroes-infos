const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringUtils.get('hero.not.found', heroName);

    return {
        ...HeroService.assembleBaseObject(hero),
        data: {
            featureName: StringUtils.get('tips'),
            featureDescription: hero.infos.tips,
            strengthsWeaknesses: [
                {
                    name: 'Hero Strengths',
                    value: hero.infos.strengths.join('\n'),
                    inline: false
                },
                {
                    name: `_ _`,
                    value: `|| ||`,
                    inline: true
                },
                {
                    name: 'Hero Weaknesses',
                    value: hero.infos.weaknesses.join('\n'),
                    inline: false
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
    name: 'Tips',
    hint: 'Display useful tips for the hero',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
