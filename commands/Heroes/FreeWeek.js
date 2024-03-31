const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async () => {
    const freeHeroesObject = HeroService.freeHeroes
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    return {
        data: {
            featureName: StringUtils.get('free.heroes'),
            featureDescription: StringUtils.get('rotation.dates',
                new Date(`${freeHeroesObject?.startDate} `).toLocaleDateString(StringUtils.EN_US, options),
                new Date(`${freeHeroesObject?.endDate} `).toLocaleDateString(StringUtils.EN_US, options)),
            freeHeroes: (freeHeroesObject?.heroes?.length <= 0 ? StringUtils.get('no.free.heroes') : freeHeroesObject?.heroes?.map(freeHero => {
                const hero = HeroService.findHero(freeHero.name);
                return {
                    name: hero.name,
                    value: HeroService.getHeroRole(hero),
                    inline: true
                }
            })),
            image: 'images/freeweek.png'
        }
    }
}

exports.help = {
    name: 'FreeWeek',
    hint: 'Display the heroes currently in free rotation',
    acceptParams: false,
    defaultPermission: true,
    category: 'HEROES',
    source: 'The Nexus Compendium',
    sourceImage: 'https://nexuscompendium.com/images/logoes/site-logo.png'
};
