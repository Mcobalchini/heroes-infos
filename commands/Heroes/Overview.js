const { HeroRepository } = require('../../repositories/hero-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroRepository.findHeroOrThrow(heroName, true);
    let overviewText = StringUtils.get('quick.overview.about.hero');
    if (hero.infos.overviewText) {
        overviewText = StringUtils.get('via.source', 'Icy Veins', hero.infos.overviewText);
    }
    //TODO rewrite this using sources.json
    return {
        ...HeroService.assembleBaseObject(hero),
        featureDescription: overviewText,
        data: {
            overview: [
                {
                    name: StringUtils.get('role'),
                    value: HeroService.getHeroRole(hero),
                    inline: false
                },
                {
                    name: StringUtils.get('universe'),
                    value: hero.universe.capitalize(),
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
    displayName: StringUtils.get('overview'),
    hint: 'Display a simple overview for the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};
