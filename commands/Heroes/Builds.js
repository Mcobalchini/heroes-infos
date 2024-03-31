const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringUtils.get('hero.not.found', heroName);

   return {
        ...HeroService.assembleBaseObject(hero),
        data: {
            featureName: StringUtils.get('builds'),
            builds: hero.infos.builds.map(build => {
                return {
                    name: build.skills,
                    value: build.name,
                    inline: false
                }
            })
        }
    }
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
