const { LogService } = require("../log-service");
const { PuppeteerService } = require("../puppeteer-service");

exports.BlizzardIntegrationService = {
    baseUrl: 'https://news.blizzard.com/en-us/heroes-of-the-storm',

    gatherNews: async function () {        
        await PuppeteerService.setBrowser();
        const page = await PuppeteerService.createPage();
        let divClass = '.Card-content';
        let result;
        try {
            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
            result = await page.evaluate((divClass) => {
                return Array.from(document.querySelectorAll(divClass)).slice(0, 3).map(it => {
                    return {
                        header: it.firstChild.innerText,
                        link: (it.firstChild.href)
                    }
                })
            }, divClass);
            await page.close();
            PuppeteerService.closeBrowser();
        } catch (ex) {
            LogService.log('Error while gathering news', ex);
        }
        if (result != null) {
            return result;
        } else {
            await this.gatherNews();
        }
    },
}