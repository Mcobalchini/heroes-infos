exports.BlizzardIntegrationService = {
    url: 'https://news.blizzard.com/en-us/heroes-of-the-storm',

    gatherNews: async function (page) {    
        let url = ``;
        let divClass = '.Card-content';
        let result;
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            result = await page.evaluate((divClass) => {
                return Array.from(document.querySelectorAll(divClass)).slice(0, 3).map(it => {
                    return {
                        header: it.firstChild.innerText,
                        link: (it.firstChild.href)
                    }
                })
            }, divClass);
            await this.page.close();
        } catch (ex) {
            App.log('Error while gathering news', ex);
        }
        if (result != null) {
            return result;
        } else {
            await this.gatherNews();
        }
    },
}