const {StringService} = require('../services/string-service');
const {HeroService} = require('../services/hero-service');

exports.run = async (hero) => {
    return {
        featureName: StringService.get('counters'),
        featureDescription: hero.infos.counters.countersText,
        counter: hero.infos.counters.heroes.map(counter => {
            const heroCounter = HeroService.findHero(counter, true, false);
            return {
                name: HeroService.getHeroName(heroCounter),
                value: HeroService.getRoleName(HeroService.findRoleById(heroCounter.role)),
                inline: true
            }
        })
    };
}

exports.help = {
    name: 'Counters',
    hint: 'Display who counters the specified hero!',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
