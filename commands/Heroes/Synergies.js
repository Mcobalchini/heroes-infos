const {StringService} = require('../../services/string-service');
const {HeroService} = require('../../services/hero-service');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringService.get('hero.not.found', heroName);

    let synergies = hero.infos.synergies.heroes.map(synergy => {
        const synergyHero = HeroService.findHero(synergy);
        return {
            name: synergyHero.name,
            value: HeroService.getHeroRole(synergyHero),
            inline: true
        }
    });

    if (synergies.length > 24) {
        synergies = synergies.slice(0, 24)
    }

    return {
        authorImage: `images/${hero.name.unaccentClean().replaceAll(' ', '-')}.png`,
        authorName: hero.name,
        authorUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
        data: {
            featureName: StringService.get('synergies'),
            featureDescription: hero.infos.synergies.synergiesText,
            synergies
        }
    };
}

exports.help = {
    name: 'Synergies',
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
