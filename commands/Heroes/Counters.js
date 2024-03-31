const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringUtils.get('hero.not.found', heroName);

    return {
        ...HeroService.assembleBaseObject(hero),
        data: {
            featureName: StringUtils.get('counters'),
            featureDescription: hero.infos.counters.countersText + '\n' + StringUtils.get('hero.examples'),
            counter: hero.infos.counters.heroes.map(counter => {
                const heroCounter = HeroService.findHero(counter);
                return {
                    name: heroCounter.name,
                    value: HeroService.getHeroRole(heroCounter),
                    inline: true
                }
            })
        }
    };
}

exports.help = {
    name: 'Counters',
    hint: 'Display heroes that counter the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
