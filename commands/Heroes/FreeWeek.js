const { Attachment } = require('discord.js');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = () => {
    const freeHeroesObject = HeroService.freeHeroes
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    return {
        featureDescription: StringUtils.get('rotation.dates',
            new Date(`${freeHeroesObject?.startDate} `).toLocaleDateString(StringUtils.EN_US, options),
            new Date(`${freeHeroesObject?.endDate} `).toLocaleDateString(StringUtils.EN_US, options)),
        data: {
            freeHeroes: (freeHeroesObject?.heroes?.length <= 0 ? StringUtils.get('no.free.heroes') : freeHeroesObject?.heroes?.map(freeHero => {
                const hero = HeroService.findHero(freeHero.name);
                return {
                    name: hero.name,
                    value: HeroService.getHeroRole(hero),
                    inline: true
                }
            }))            
        },
        bottomImage: 'images/freeweek.png'
    }
}

exports.help = {
    name: 'FreeWeek',
    displayName: StringUtils.get('free.heroes'),
    hint: 'Display the heroes currently in free rotation',
    acceptParams: false,
    defaultPermission: true,
    category: 'HEROES',
    source: 'The Nexus Compendium',
    sourceImage: 'https://nexuscompendium.com/images/logoes/site-logo.png'
};
