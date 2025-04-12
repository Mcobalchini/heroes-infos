const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');
const { HeroRepository } = require('../../repositories/hero-repository');
const { SourceRepository } = require('../../repositories/source-repository');
const { EmojiRepository } = require('../../repositories/emoji-repository');

exports.run = () => {
    const freeHeroesObject = HeroRepository.getRotationObject();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    return {
        featureDescription: StringUtils.get('rotation.dates',
            new Date(`${freeHeroesObject?.startDate} `).toLocaleDateString(StringUtils.EN_US, options),
            new Date(`${freeHeroesObject?.endDate} `).toLocaleDateString(StringUtils.EN_US, options)),
        data: {
            freeHeroes: (freeHeroesObject?.heroes?.length <= 0 ? StringUtils.get('no.free.heroes') : freeHeroesObject?.heroes?.map(freeHero => {
                const hero = HeroRepository.findHero(freeHero.name);
                return {
                    name: `${EmojiRepository.getEmojiByName(hero.name.unaccentClean())} ${hero.name}`,
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
    source: SourceRepository.findSourceById('NEXUS_COMPENDIUM'),
};
