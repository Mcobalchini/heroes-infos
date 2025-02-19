const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async () => {
    return {
        featureDescription: StringUtils.get('banheroes.description'),
        data: {                        
            mustBanHeroes: HeroService.mustBanHeroes.map(ban => {
                const hero = HeroService.findHero(ban.name);
                return {
                    name: hero.name,
                    value: HeroService.getHeroRole(hero),
                    inline: false
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
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
