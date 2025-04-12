const { SourceRepository } = require('../repositories/source-repository');
const { BlizzardIntegrationService } = require('../services/integration/blizzard-integration-service');
const { StringUtils } = require('../utils/string-utils');

exports.run = async() => {
    return BlizzardIntegrationService.gatherNews().then(
        returnedNews => {
            return {
                data: {                    
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
    displayName: StringUtils.get('news'),
    hint: 'Display the latest news about the game',
    acceptParams: false,
    requiredParam: false,
    defaultPermission: true,
    category: 'GENERAL',
    source: SourceRepository.findSourceById('BLIZZARD')
}

