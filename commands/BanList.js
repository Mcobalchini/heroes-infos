const {StringService} = require('../services/string-service');
const {HeroService} = require("../services/hero-service");

exports.run = async () => {
    return {
        data: {
            featureName: StringService.get('suggested.bans'),
            mustBanHeroes: HeroService.mustBanHeroes.map(ban => {
                const hero = this.findHero(ban.name, false, false);
                return {
                    name: this.getHeroName(hero),
                    value: this.getRoleName(this.findRoleById(hero.role)),
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
