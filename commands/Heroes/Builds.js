const {StringService} = require('../../services/string-service');
const {HeroService} = require("../../services/hero-service");

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringService.get('hero.not.found', heroName);

    return {
        authorImage: `images/${hero.name.unaccentClean()}.png`,
        authorName: hero.name,
        authorUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
        data: {
            featureName: StringService.get('builds'),
            builds: hero.infos.builds.map(build => {
                return {
                    name: build.skills,
                    value: build.name,
                    inline: false
                }
            })
        }
    };
}

exports.help = {
    name: 'Builds',
    hint: 'Display the known builds for the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};
