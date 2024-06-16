const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroService.findHero(heroName, true);
    if (!hero) return StringUtils.get('hero.not.found', heroName);

    return {
        ...HeroService.assembleBaseObject(hero),
        data: {
            featureName: StringUtils.get('builds'),
            builds: hero.infos.builds.map(build => (
                {
                    name: build.skills,
                    value: build.name,
                    inline: false
                }
            ))
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
    name: 'Builds',
    hint: 'Display the known builds for the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};