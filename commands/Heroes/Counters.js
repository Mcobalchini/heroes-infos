const {StringService} = require('../../services/string-service');
const {HeroService} = require('../../services/hero-service');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringService.get('hero.not.found', heroName);

    return {
        authorImage: `images/${hero.name.unaccentClean().replaceAll(' ', '-')}.png`,
        authorName: hero.name,
        authorUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
        data: {
            featureName: StringService.get('counters'),
            featureDescription: hero.infos.counters.countersText,
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
    hint: 'Display who counters the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Hero name name, or part of its name',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
