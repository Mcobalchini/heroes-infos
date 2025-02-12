const { logger } = require("../log-service");

exports.BlizzardIntegrationService = {
    baseUrl: 'https://news.blizzard.com/en-us/api/news/blizzard?feedCxpProductIds[]=blt2e50e1521bb84dc6',

    gatherNews: async function () {
        let result;
        const response = await fetch(this.baseUrl);
        if (!response.ok) {
            logger.error(`error while gathering news`, response.statusText);
        }
        result = await response.json();

        if (result != null) {
            return result.feed?.contentItems?.slice(0, 3).map(it => {
                return {
                    header: it.properties.title,
                    link: it.properties.newsUrl
                }
            });
        } else {
            await this.gatherNews();
        }
    },
}