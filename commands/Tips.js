const {StringService} = require('../services/string-service');

exports.run = async (hero) => {
    return {
        featureName: StringService.get('tips'),
        description: hero.infos.tips
    }
}

exports.help = {
    name: 'Tips',
    hint: 'Display useful tips for the hero',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES',
    source: 'Icy Veins',
    sourceImage: 'https://static.icy-veins.com/images/common/favicon-high-resolution.png'
};
