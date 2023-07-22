const {StringService} = require('../../services/string-service');
const {HeroService} = require("../../services/hero-service");

exports.run = async () => {
    return {
        data: {
            featureName: StringService.get('suggested.bans'),
            featureDescription: StringService.get('banheroes.description'),
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
    acceptParams: false,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
