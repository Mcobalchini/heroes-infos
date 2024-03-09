const { MapService } = require("../services/map-service");

exports.IcyVeinsIntegrationService = {
    baseUrl: 'https://www.icy-veins.com/heroes/{{0}}-build-guide',
    gatherIcyData: async function (page, heroName) {
        icyUrl = this.getUrl(heroName);
        try {
            await page.goto(icyUrl, { waitUntil: 'domcontentloaded' });

            const heroIcyVeinsData = await page.evaluate((icyUrl) => {
                const names = Array.from(document.querySelectorAll('.toc_no_parsing')).map(it => it.innerText);
                const skills = Array.from(document.querySelectorAll('.talent_build_copy_button > input')).map(skillsElements => skillsElements.value);
                const counters = Array.from(document.querySelectorAll('.hero_portrait_bad')).map(nameElements => nameElements.title);
                const synergies = Array.from(document.querySelectorAll('.hero_portrait_good')).map(nameElements => nameElements.title);
                const synergiesText = document.querySelector('.heroes_synergies .heroes_synergies_counters_content').innerText;
                const countersText = document.querySelector('.heroes_counters .heroes_synergies_counters_content').innerText;
                const strongerMaps = Array.from(document.querySelectorAll('.heroes_maps_stronger .heroes_maps_content span img')).map(i => i.title);
                const tips = Array.from(document.querySelectorAll('.heroes_tips li')).map(i => i.innerText.trim().replaceAll('  ', ' '));

                const builds = [];
                for (let i in names) {
                    builds.push({
                        name: `[${names[i]}](${icyUrl})`,
                        skills: skills[i]
                    });
                }

                return {
                    builds: builds,
                    counters: { countersText, heroes: counters },
                    synergies: { synergiesText, heroes: synergies },
                    strongerMaps: strongerMaps,
                    tips: tips
                };

            }, icyUrl);

            heroIcyVeinsData.strongerMaps = icyData.strongerMaps.map(it => {
                const strongerMap = MapService.findMap(it);
                return {
                    name: strongerMap.name,
                    localizedName: strongerMap.localizedName
                }
            });
            return heroIcyVeinsData;
        } catch (ex) {
            App.log(`Error while fetching icyData ${icyUrl}`, ex);
            if (ex.stack.includes('Navigation timeout')) {
                this.gatherIcyData(page, heroName);
            }
        }
    },

    getUrl: function (heroName) {
        return baseUrl.replace('{{0}}', heroName);
    }
}