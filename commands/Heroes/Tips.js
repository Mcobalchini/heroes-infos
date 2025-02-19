const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHeroOrThrow(heroName, true);
    return {
        ...HeroService.assembleBaseObject(hero),
        featureDescription: hero.infos.tips,
        data: {            
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
    displayName: StringUtils.get('tips'),
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
