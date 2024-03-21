const { LogService } = require("../log-service");
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
            LogService.log(`Error while gathering rotation image`, ex);
        } finally {
            await page.close();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherHeroesPrint(remainingTries);
            } else {
                LogService.log(`No more tries remaining for gathering heroes print`);
                return null;
            }
        }
    },
    
    gatherHeroesRotation: async function () {
        LogService.log(`Gathering heroes rotation`);

        const fun = function () {
            const obj = JSON.parse(document.body.innerText).RotationHero;
            return {
                startDate: obj.StartDate,
                endDate: obj.EndDate,
                heroes: obj.Heroes.map(it => it.ID)
            }
        };

        const options = {
            url: `${this.baseUrl}/api/currently/RotationHero`,
            waitUntil: 'domcontentloaded',
            function: fun
        }
        const result = await PuppeteerService.performConnection(options);

        if (result)
            return result;
    },
}