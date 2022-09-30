const {StringService} = require('../services/string-service');
const {HeroService} = require('../services/hero-service');

exports.run = async () => {
    const freeHeroesObject = HeroService.freeHeroes
    const options = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
    return {
        data: {
            featureName: StringService.get('free.heroes'),
            featureDescription: StringService.get('rotation.dates',
                new Date(`${freeHeroesObject?.startDate} `).toLocaleDateString(StringService.EN_US, options),
                new Date(`${freeHeroesObject?.endDate} `).toLocaleDateString(StringService.EN_US, options)),
            freeHeroes: (freeHeroesObject?.heroes?.length <= 0 ? StringService.get('no.free.heroes') : freeHeroesObject?.heroes?.map(freeHero => {
                const hero = HeroService.findHero(freeHero.name, false, false);
                return {
                    name: HeroService.getHeroName(hero),
                    value: HeroService.getRoleName(HeroService.findRoleById(hero.role)),
                    inline: true
                }
            })),
            image: 'images/freeweek.png'
        }
    }
}

exports.help = {
    name: 'FreeWeek',
    hint: 'Display which heroes are currently free rotation',
    acceptParams: false,
    defaultPermission: true,
    category: 'HEROES',
    source: 'The Nexus Compendium',
    sourceImage: 'https://nexuscompendium.com/images/logoes/site-logo.png'
};
