const { logger } = require("../log-service");
const { JSDOM } = require('jsdom');

exports.IcyVeinsIntegrationService = {
    baseUrl: 'https://www.icy-veins.com/heroes/{0}-build-guide',

    getIcyVeinsData: async function (heroName) {
        const icyUrl = this.getUrl(heroName);     
        try {                   
            const response = await fetch(icyUrl);
            if (!response.ok) {
                logger.error(`error while gathering news`, response.statusText);
                return null;
            }
            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;
                    
            const overviewText = document.querySelector('.page_content > p').textContent.split('\n').join(' ');
            const strengths = Array.from(document.querySelectorAll('.strengths li')).map(it => it.textContent.trim());
            const weaknesses = Array.from(document.querySelectorAll('.weaknesses li')).map(it => it.textContent.trim());
            const names = Array.from(document.querySelectorAll('.toc_no_parsing')).map(it => it.textContent.split('\n').join('').trim());
            const skills = Array.from(document.querySelectorAll('.talent_build_copy_button > input')).map(skillsElements => skillsElements.value);
            const counters = Array.from(document.querySelectorAll('.hero_portrait_bad')).map(nameElements => nameElements.title);
            const synergies = Array.from(document.querySelectorAll('.hero_portrait_good')).map(nameElements => nameElements.title);            
            const synergiesText = document.querySelector('.heroes_synergies .heroes_synergies_counters_content > div:last-child').textContent.split('\n').join(' ').trim();
            const countersText = document.querySelector('.heroes_counters .heroes_synergies_counters_content > div:last-child').textContent.split('\n').join(' ').trim();
            const strongerMaps = Array.from(document.querySelectorAll('.heroes_maps_stronger .heroes_maps_content span img')).map(i => i.title);
            const tips = Array.from(document.querySelectorAll('.heroes_tips li')).map(i => i.textContent.trim().replaceAll('  ', ' '));

            const builds = [];
            for (let i in names) {
                builds.push({
                    name: names[i],
                    link: icyUrl,
                    skills: skills[i]
                });
            }

            return {
                overviewText,
                builds,
                strengths,
                weaknesses,
                counters: { countersText, heroes: counters },
                synergies: { synergiesText, heroes: synergies },
                strongerMaps,
                tips
            };    
        } catch (ex) {
            logger.error(`error while fetching icyData ${icyUrl}`, ex);
            return null;
        }
    },

    getUrl: function (heroName) {
        return this.baseUrl.replace('{0}', heroName);
    }
}