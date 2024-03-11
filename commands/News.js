const {StringService} = require('../services/string-service');
const { BlizzardIntegrationService } = require('../services/integration/blizzard-integration-service');

exports.run = () => {
    return BlizzardIntegrationService.gatherNews().then(
        returnedNews => {
            return {
                data: {
                    featureName: StringService.get('news'),
                    news: returnedNews.map(it => {
                        return {
                            name: it.header,
                            value: it.link,
                            inline: false
                        };
                    })
                }
            }
        }
    )
}

exports.help = {
    name: 'News',
    hint: 'Display the latest news of the game',
    acceptParams: false,
    requiredParam: false,
    defaultPermission: true,
    category: 'GENERAL',
    source: 'Blizzard',
    sourceImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blizzard_Entertainment_Logo_2015.svg/800px-Blizzard_Entertainment_Logo_2015.svg.png'
}

