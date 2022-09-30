const {StringService} = require('../services/string-service');
const {HeroService} = require('../services/hero-service');

exports.run = async (hero) => {
    return {
        featureName: StringService.get('overview'),
        overview: [
            {
                name: StringService.get('role'),
                value: HeroService.getHeroRole(hero),
                inline: false
            },
            {
                name: StringService.get('universe'),
                value: HeroService.getHeroUniverse(hero),
                inline: true
            },
            {
                name: StringService.get('score'),
                value: HeroService.getHeroTierPosition(hero).toString(),
                inline: true
            }
        ]
    }
}

exports.help = {
    name: 'Overview',
    hint: 'Display a simple overview for the specified hero!',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};
