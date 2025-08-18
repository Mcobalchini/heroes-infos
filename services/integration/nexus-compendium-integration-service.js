const { logger } = require("../log-service");
const { PuppeteerService } = require("../puppeteer-service");

exports.NexusCompendiumIntegrationService = {
    baseUrl: `https://nexuscompendium.com`,
    gatherHeroesPrint: async function (remainingTries) {
        remainingTries = remainingTries ?? 3;
        const page = await PuppeteerService.createPage(null, false);
        let result;

        try {
            await page.goto(`${this.baseUrl}/currently`, { waitUntil: 'networkidle0' });
            result = await page.$('.primary-table > table:nth-child(9)');
            await result.screenshot({
                path: 'images/freeweek.png'
            });

        } catch (ex) {
            logger.error(`error while gathering rotation image`, ex);
        } finally {
            await page.close();
            PuppeteerService.closeBrowser();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherHeroesPrint(remainingTries);
            } else {
                logger.warn(`no more tries remaining for gathering heroes print`);
                return null;
            }
        }
    },

    gatherHeroesRotation: async function () {
        logger.info(`gathering heroes rotation`);
        const response = await fetch(`${this.baseUrl}/api/currently/RotationHero`);
        let result = null;
        if (!response.ok) {
            logger.error(`error while gathering rotation data`, response.statusText);
        }
        result = await response.json();
        if (result) {
            base = result.RotationHero;
            return {
                startDate: base.StartDate,
                endDate: base.EndDate,
                heroes: base.Heroes.map(it => it.ID)
            };
        }
    },
    
    gatherCurrentBrawl: async function () {
        logger.info(`gathering heroes rotation`);
        const response = await fetch(`${this.baseUrl}/api/currently/brawlrotation`);
        let result = null;
        if (!response.ok) {
            logger.error(`error while gathering rotation data`, response.statusText);
        }
        result = await response.json();
        if (result) {
            base = result.RotationHero;
            return {
                startDate: base.StartDate,
                endDate: base.EndDate,
                heroes: base.Heroes.map(it => it.ID)
            };
        }
    },
}