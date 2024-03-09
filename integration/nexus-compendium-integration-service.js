exports.NexusCompendiumIntegrationService = {
    gatherHeroesPrint: async function (page, remainingTries) {
        remainingTries = remainingTries ?? 3;       

        let result;
        const url = `https://nexuscompendium.com/currently`;

        try {
            await page.goto(url, { waitUntil: 'networkidle0' });
            result = await page.$('.primary-table > table:nth-child(9)');
            await result.screenshot({
                path: 'images/freeweek.png'
            });

        } catch (ex) {
            App.log(`Error while gathering rotation image`, ex);
        } finally {
            await page.close();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherHeroesPrint(page, remainingTries);
            } else {
                App.log(`No more tries remaining for gathering heroes print`);
                return null;
            }
        }
    },

    //FIXME
    gatherHeroesRotation: async function () {
        App.log(`Gathering heroes rotation`);

        const fun = function () {
            const obj = JSON.parse(document.body.innerText).RotationHero;
            return {
                startDate: obj.StartDate,
                endDate: obj.EndDate,
                heroes: obj.Heroes.map(it => it.ID)
            }
        };

        const options = {
            url: 'https://nexuscompendium.com/api/currently/RotationHero',
            waitUntil: 'domcontentloaded',
            function: fun
        }
        const result = await this.performConnection(options);

        if (result)
            HeroService.updateRotation(result);
    },
}