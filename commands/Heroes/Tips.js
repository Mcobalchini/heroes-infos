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
            strengths: [{
                name: 'Hero Strengths',
                value: hero.infos.strengths.join('\n'),
                inline: true
            }],
            weaknesses: [{
                name: 'Hero Weaknesses',
                value: hero.infos.weaknesses.join('\n'),
                inline: true
            }],
        }
    }
}

exports.autoComplete = (interaction) => {
    const focusedValue = interaction.options.getFocused();
    const heroes = HeroService.autoCompleteHeroes(focusedValue);
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
