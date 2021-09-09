const translate = require('@vitalets/google-translate-api');
const fs = require('fs');
require('dotenv').config({ path: './variables.env' });
const Heroes = require('./heroes.js').Heroes;
const StringUtils = require('./strings.js').StringUtils;
const Maps = require('./maps.js').Maps;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
let msg = null;

exports.Network = {

    updatingData: false,
    replyTo: null,

    gatherHeroesRotation: async function(browser) {

        const page = await this.createPage(browser);

        let result = ""

        await page.goto(`https://nexuscompendium.com/api/currently/RotationHero`);
        result = await page.evaluate(() => {		
            return JSON.parse(document.body.innerText).RotationHero.Heroes.map(it => it.ID)	
        });

        await browser.close();
        return result;
    },

    gatherHeroStats: async function (icyUrl, heroId, profileUrl, heroesMap, browser, cookie) {

        const page = await this.createPage(browser);

        await page.setExtraHTTPHeaders({
            'Cookie': cookie,
        });

        await page.goto(icyUrl, {timeout: 0});

        const icyData = await page.evaluate(() => {
            const names = Array.from(document.querySelectorAll('.toc_no_parsing')).map(it => it.innerText);
            const skills = Array.from(document.querySelectorAll('.talent_build_copy_button > input')).map(skillsElements => skillsElements.value);
            const counters = Array.from(document.querySelectorAll('.hero_portrait_bad')).map(nameElements => nameElements.title);
            const synergies = Array.from(document.querySelectorAll('.hero_portrait_good')).map(nameElements => nameElements.title);
            const strongerMaps = Array.from(document.querySelectorAll('.heroes_maps_stronger .heroes_maps_content span img')).map(i => i.title);
            const tips = Array.from(document.querySelectorAll('.heroes_tips li')).map(i => i.innerText.trim().replaceAll('  ', ' '));

            const builds = [];
            for (i in names) {
                builds.push({
                    name: names[i],
                    skills: skills[i]
                });
            }

            return {
                builds: builds,
                counters: counters,
                synergies: synergies,
                strongerMaps: strongerMaps,
                tips: tips
            };

        });

        await page.goto(profileUrl, {timeout: 0});

        const profileData = await page.evaluate(() => {
            const names = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .win_rate_cell')).map(it => `Popular build (${it.innerText}% win rate)`)
            const skills = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .build-code')).map(it => it.innerText)
            const builds = [];
            for (i in names) {
                builds.push({
                    name: names[i],
                    skills: skills[i]
                });
            }

            return {
                builds: builds,
            };

        });

        returnObject = {
            icyData: icyData,
            profileData: profileData
        }

        heroesMap.set(heroId, returnObject);
        await page.close();
    },

    createHeroesProfileSession: async function(browser) {
        const page = await this.createPage(browser);
        const response = await page.goto('https://www.heroesprofile.com/Global/Talents/');
        return response._headers["set-cookie"];
    },

    gatherTierListInfo: async function (browser) {
        const page = await this.createPage(browser);

        let result = ""
        await page.goto(`https://www.icy-veins.com/heroes/heroes-of-the-storm-general-tier-list`, { waitUntil: 'domcontentloaded' })

        result = await page.evaluate(() => {		
            return [...new Set(Array.from(document.querySelectorAll('.htl_ban_true')).map(nameElements => nameElements.nextElementSibling.innerText))];
        });

        await page.close();
        return result;
    },

    gatherPopularityAndWinRateInfo: async function (browser) {
        const page = await this.createPage(browser);

        let result = ""

        await page.goto(`https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2`);
        result = await page.evaluate(() => {
            return Array.from(document.querySelector('.rgMasterTable tbody').children).map((it) => {
                return {
                    name: it.children[1].firstElementChild.innerText,
                    winRate: parseFloat(it.children[3].innerText.replace(",", ".")),
                    games: parseFloat(it.children[2].innerText.replace(",", ".")),
                }
            });
        });

        await page.close();
        return result;
    },

    gatherCompositionsInfo: async function (browser) {
        const page = await this.createPage(browser);

        let result = ""

        await page.goto(`https://www.hotslogs.com/Sitewide/TeamCompositions?Grouping=1`);
        result = await page.evaluate(() => {
            return Array.from(document.querySelector('.rgMasterTable tbody').children).map((it) => {         
                return {
                games: it.children[0].innerText,
                winRate: parseFloat(it.children[1].innerText.replace(",", ".")),
                roles: Array.from(it.children).filter(it => it.style.display === "none").map(it => it.innerText)
            }
            });
        });

        await page.close();
        return result;
    },

    updateData: async function(callbackFunction) {

        process.stdout.write(`Started updating data process at ${new Date().toLocaleTimeString()}\n`);
        this.updatingData = true;

        //const browser = await puppeteer.launch({devtools: true});
        const browser = await puppeteer.launch({
            headless: true,
            args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',		
            ],
        });
        
        const cookieValue = await this.createHeroesProfileSession(browser);	 
        const tierList = await this.gatherTierListInfo(browser);
        const popularityWinRate = await this.gatherPopularityAndWinRateInfo(browser);
        const compositions = await this.gatherCompositionsInfo(browser);
        
        //stores compositions
        compositions.sort(function (a, b) {
            return a.games - b.games;
        }).forEach((it, idx)=> {
            it.tierPosition = parseInt(idx+1);
        });

        compositions.sort(function (a, b) {
            return a.winRate - b.winRate;
        }).forEach((it, idx)=> {
            it.tierPosition = parseInt(it.tierPosition) + parseInt(idx+1);
        });
        
        let sortedComposition = compositions.sort(function (a, b) {return a.tierPosition - b.tierPosition}).reverse();
        Heroes.setCompositions(sortedComposition);
        this.writeFile('data/compositions.json', sortedComposition);

        let heroesMap = new Map();
        let heroesIdAndUrls = [];
        let heroesInfos = Heroes.findAllHeroes();

        for (hero of heroesInfos) {
            let normalizedName = hero.name.replace('/ /g', '+').replace('/\'/g', '%27');
            heroesIdAndUrls.push({
                heroId: hero.id,
                icyUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
                profileUrl: `https://www.heroesprofile.com/Global/Talents/getChartDataTalentBuilds.php?hero=${normalizedName}`
            });
        }

        const promiseProducer = () => {
            const heroCrawlInfo = heroesIdAndUrls.pop();
            return heroCrawlInfo ? this.gatherHeroStats(heroCrawlInfo.icyUrl,
                heroCrawlInfo.heroId,
                heroCrawlInfo.profileUrl,
                heroesMap,
                browser,
                cookieValue) : null;
        };
        
        let startTime = new Date();
        process.stdout.write(`Started gathering process at ${startTime.toLocaleTimeString()}\n`);

        const thread = new PromisePool(promiseProducer, 5);
            
        thread.start().then(() => {

            let finishedTime = new Date();

            process.stdout.write(`Finished gathering process at ${finishedTime.toLocaleTimeString()}\n`);
            process.stdout.write(`${(finishedTime - startTime) / 1000} seconds has passed\n`);

            for (let [heroKey, heroData] of heroesMap) {
                let index = heroesInfos.findIndex(it => it.id == heroKey);
                let icyData = heroData.icyData
                let profileData = heroData.profileData		
                let heroCounters = [];
                let heroSynergies = [];
                let heroMaps = [];
                let heroTips = "";
                
                for (synergy of icyData.synergies) {
                    let synergyHero = Heroes.findHero(synergy);
                    if (synergyHero)
                        heroSynergies.push(Heroes.getHeroName(synergyHero));
                }

                for (counter of icyData.counters) {
                    let counterHero = Heroes.findHero(counter);
                    if (counterHero)
                        heroCounters.push(Heroes.getHeroName(counterHero));
                }

                for (strongerMap of icyData.strongerMaps) {
                    let heroMap = Maps.findMap(strongerMap);
                    if (heroMap)
                        heroMaps.push(`${heroMap.name} (${heroMap.localizedName})`);
                }

                heroTips += icyData.tips.map(tip => `${tip}\n`).join('');

                if (heroesInfos[index] == null) {
                    heroesInfos[index] = {};
                }

                if (profileData.builds.length == 0){
                    process.stdout.write(`No builds found for ${heroesInfos[index].name}\n`);
                }

                //retrieves the duplicate items
                let repeatedBuilds = profileData.builds.filter(item => (icyData.builds.map(it => it.skills).includes(item.skills)));

                //applies winrate on known builds names
                icyData.builds.forEach(it => {
                    for (item of repeatedBuilds) {
                        if (item.skills == it.skills) {
                            it.name = `${it.name} (${item.name.match(/([0-9.]%*)/g, '').join('')} win rate)`
                        }
                    }
                });

                //removes the duplicate items
                profileData.builds = profileData.builds.filter(item => !repeatedBuilds.includes(item))
                let heroBuilds = icyData.builds.concat(profileData.builds);

                heroesInfos[index].infos = {};
                heroesInfos[index].id = heroKey;
                heroesInfos[index].name = Heroes.findHero(heroKey).name;
                heroesInfos[index].infos.builds = heroBuilds;
                heroesInfos[index].infos.synergies = heroSynergies;
                heroesInfos[index].infos.counters = heroCounters;
                heroesInfos[index].infos.strongerMaps = heroMaps;
                heroesInfos[index].infos.tips = heroTips;
        
                let obj = popularityWinRate.find(it => { return it.name.cleanVal() == heroesInfos[index].name.cleanVal() });
                heroesInfos[index].infos.winRate = obj.winRate;
                heroesInfos[index].infos.games = obj.games;		
            }

            Heroes.setHeroesInfos(heroesInfos);
            
            let cacheBans = [];
            tierList.forEach(it => {						
                cacheBans.push(Heroes.getHeroName(Heroes.findHero(it)));
            });
            
            Heroes.setBanHeroes(cacheBans);
            this.writeFile('data/banlist.json', cacheBans);

            heroesInfos.sort(function (a, b) {
                return a.infos.games - b.infos.games;
            }).forEach((it, idx)=> {
                it.infos.tierPosition = parseInt(idx+1);
            });

            heroesInfos.sort(function (a, b) {
                return a.infos.winRate - b.infos.winRate;
            }).forEach((it, idx)=> {
                it.infos.tierPosition = parseInt(it.infos.tierPosition) + parseInt(idx+1);
            })
            
            this.gatherHeroesRotation(browser).then((value) => {

                let cacheFree = [];
                let freeHeroes = value;
        
                for (heroName of freeHeroes) {
                    let freeHero = Heroes.findHero(heroName);
                    cacheFree.push(Heroes.getHeroName(freeHero));
                }
                
                this.writeFile('data/freeweek.json', cacheFree);
                
                Heroes.setFreeHeroes(cacheFree);
                updatingData = false;

                this.translateTips(heroesInfos).then(() => {
                    this.updatingData = false;
                    callbackFunction(StringUtils.get('process.update.finished.time', (finishedTime - startTime) / 1000));
                });
            });
        }).catch((e) => {
            let replyMsg = StringUtils.get('could.not.update.data.check.logs');

            if (e.stack.includes("Navigation timeout of 30000 ms exceeded")	|| e.stack.includes("net::ERR_ABORTED")) {
                replyMsg += StringUtils.get('try.to.update.again');
                this.updateData(callbackFunction);
            }            
            process.stdout.write(e.stack);
            this.updatingData = false;
            callbackFunction(replyMsg);
        });
    },

    translateTips: async function (heroesInfos) {
        
        let heroesAux = JSON.parse(JSON.stringify(heroesInfos));
        let heroesCrawl = JSON.parse(JSON.stringify(heroesAux));
        let heroesMap = new Map();

        const translatePromiseProducer = () => {
            const heroCrawlInfo = heroesCrawl.pop();
            return heroCrawlInfo ? translate(heroCrawlInfo.infos.tips.substring(0, 5000), {to: 'pt'}).then(res => {
                heroesMap.set(heroCrawlInfo.id, res.text);
            }) : null;
        };
            
        const translateThread = new PromisePool(translatePromiseProducer, 20);
        translateThread.start().then(() => {
            for (let [heroKey, heroData] of heroesMap) {
                let index = heroesAux.findIndex(it => it.id == heroKey);
                heroesAux[index].infos.localizedTips = heroData
            }	
        })
        Heroes.setHeroesInfos(heroesAux);
        this.writeFile('data/heroes-infos.json', heroesAux);	
    },

    createPage: async function (browser) {

        const page = await browser.newPage();
        await page.setRequestInterception(true);

        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
                request.abort();
            } else {
                request.continue();
            }
        });
        return page;
    },

    writeFile: function (path, obj) {
        fs.writeFile(path, JSON.stringify(obj), (e) => {
            if (e != null) {
                process.stdout.write('error: ' + e + "\n");
                msg.reply(StringUtils.get('could.not.update.data.check.logs'));
            }
        });
    }
}
