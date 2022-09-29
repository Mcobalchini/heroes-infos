const {StringService} = require('../services/string-service');
const {HeroService} = require('../services/hero-service');

exports.run = async (hero) => {
    return {
        featureName: StringService.get('synergies'),
        featureDescription: hero.infos.synergies.synergiesText,
        synergies: hero.infos.synergies.heroes.map(synergy => {
            const sinergyHero = HeroService.findHero(synergy, true, false);
            return {
                name: HeroService.getHeroName(sinergyHero),
                value: HeroService.getRoleName(HeroService.findRoleById(sinergyHero.role)),
                inline: true
            }
        })
    };
}

exports.help = {
    name: 'Synergies',
    hint: 'Display who synergizes with the specified hero!',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
