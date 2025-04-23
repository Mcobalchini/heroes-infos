const { EmojiRepository } = require('../../repositories/emoji-repository');
const { HeroRepository } = require('../../repositories/hero-repository');
const { SourceRepository } = require('../../repositories/source-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async () => {
    return {
        featureDescription: StringUtils.get('banheroes.description'),
        data: {             
            mustBanHeroes: HeroRepository.listBanHeroes().map(ban => {
                const hero = HeroRepository.findHero(ban.name);
                return {
                    name: `${EmojiRepository.getEmojiByName(hero.name.unaccentClean())} ${hero.name}`,
                    value: HeroService.getHeroRole(hero),
                    inline: true
                }
            })
        }
    }
}

exports.help = {
    name: 'Banlist',
    hint: 'Display suggested heroes to ban on ranked',
    displayName: StringUtils.get('suggested.bans'),
    acceptParams: false,
    defaultPermission: true,
    category: 'HEROES',
    source: SourceRepository.findSourceById('ICY_VEINS')
};
