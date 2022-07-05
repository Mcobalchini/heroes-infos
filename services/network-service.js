const translate = require('@vitalets/google-translate-api');
const fs = require('fs');
require('dotenv').config({path: './variables.env'});
const Heroes = require('./heroes.js').Heroes;
const StringUtils = require('./strings.js').StringUtils;
const Maps = require('./maps.js').Maps;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const {Routes} = require('discord-api-types/v9');
const {REST} = require('@discordjs/rest');
const {App} = require('../app.js');
let msg = null;
const rest = new REST({version: '9'}).setToken(process.env.HEROES_INFOS_TOKEN);

exports.Network = {
    failedJobs: [],
    isUpdatingData: false,
    replyTo: null,
    browser: null,

    gatherHeroesRotation: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        const page = await this.createPage();

        let result
        const url = `https://nexuscompendium.com/api/currently/RotationHero`;
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'})
            result = await page.evaluate(() => {
                const obj = JSON.parse(document.body.innerText).RotationHero;
                return {
                    startDate: obj.StartDate,
                    endDate: obj.EndDate,
                    heroes: obj.Heroes.map(it => it.ID)
                }
            });
        } catch (ex) {
            App.log(`Error while gathering rotation`, ex);
            this.failedJobs.push(url)
        } finally {
            await page.close();
        }

        if (result != null) {
            let freeHeroes = [];

            for (let heroName of result.heroes) {
                let freeHero = Heroes.findHero(heroName, false, true);
                let heroRole = Heroes.findRoleById(freeHero.role);
                freeHeroes.push({
                    name: freeHero.name,
                    role: heroRole.name
                });
            }

            const rotation = {
                startDate: result.startDate,
                endDate: result.endDate,
                heroes: freeHeroes
            };

            Heroes.setFreeHeroes(rotation);
            this.writeFile('data/freeweek.json', rotation);
            App.log(`Updated heroes rotation`);
        } else {
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.gatherHeroesRotation(remainingTrials);
            } else {
                App.log(`No more tries remaining for gathering heroes rotation`);
                return null;
            }
        }
    },

    gatherHeroesPrint: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        const page = await this.createPage(false);

        let result
        const url = `https://nexuscompendium.com/currently`;

        try {
            await page.goto(url, {waitUntil: 'networkidle0'});
            result = await page.$('.primary-table > table:nth-child(9)');
            await result.screenshot({
                path: 'images/freeweek.png'
            });

        } catch (ex) {
            App.log(`Error while gathering rotation image`, ex);
            this.failedJobs.push(url)
        } finally {
            await page.close();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.gatherHeroesPrint(remainingTrials);
            } else {
                App.log(`No more tries remaining for gathering heroes print`);
                return null;
            }
        }
    },

    gatherBanTierListInfo: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        App.log(`Gathering ban tier list`);
        const page = await this.createPage();
        const url = `https://www.icy-veins.com/heroes/heroes-of-the-storm-general-tier-list`;
        let result;
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            result = await page.evaluate(() => {
                return [...new Set(Array.from(document.querySelectorAll('.htl_ban_true')).map(nameElements => nameElements.nextElementSibling.innerText))];
            });

        } catch (ex) {
            App.log(`Error while gathering tier list info`, ex);
            this.failedJobs.push(url)
        } finally {
            await page.close();
        }

        if (result != null) {
            let banList = [];
            result.forEach(it => {
                let banHero = Heroes.findHero(it, false, true);
                let heroRole = Heroes.findRoleById(banHero.role);
                banList.push({
                    name: banHero.name,
                    role: heroRole.name,
                });
            });

            Heroes.setBanHeroes(banList);
            this.writeFile('data/banlist.json', banList);
            App.log(`Updated ban list`);
        } else {
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.gatherBanTierListInfo(remainingTrials);
            } else {
                App.log(`No more tries remaining for ban tier list`);
                return null;
            }
        }

    },

    gatherCompositionsInfo: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        App.log(`Gathering compositions`);
        const page = await this.createPage();
        const url = `https://www.hotslogs.com/Sitewide/TeamCompositions?Grouping=1`;
        let result
        try {
            await page.goto(url);
            result = await page.evaluate(() => {
                return Array.from(document.querySelector('.rgMasterTable tbody').children).map((it) => {
                    return {
                        games: it.children[0].innerText,
                        winRate: parseFloat(it.children[1].innerText.replace(',', '.')),
                        roles: Array.from(it.children).filter(it => it.style.display === 'none').map(it => it.innerText)
                    }
                });
            });

        } catch (ex) {
            App.log(`Error while gathering compositions`, ex);
            this.failedJobs.push(url)
        } finally {
            await page.close();
        }

        if (result != null) {
            result.sort(function (a, b) {
                return a.games - b.games;
            }).forEach((it, idx) => {
                it.tierPosition = parseInt(idx + 1);
            });

            result.sort(function (a, b) {
                return a.winRate - b.winRate;
            }).forEach((it, idx) => {
                it.tierPosition = parseInt(it.tierPosition) + parseInt(idx + 1);
            });

            let sortedComposition = result.sort(function (a, b) {
                return a.tierPosition - b.tierPosition
            }).reverse();

            Heroes.setCompositions(sortedComposition);
            this.writeFile('data/compositions.json', sortedComposition);
            App.log(`Updated compositions list`);
        } else {
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.gatherCompositionsInfo(remainingTrials);
            } else {
                App.log(`No more tries remaining for gathering compositions`);
                return null;
            }
        }
    },

    gatherPopularityAndWinRateInfo: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        App.log(`Gathering win rate`);
        const page = await this.createPage();
        const url = `https://www.hotslogs.com/Sitewide/ScoreResultStatistics?League=0,1,2`;
        let result
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            result = await page.evaluate(() => {
                return Array.from(document.querySelector('.rgMasterTable tbody').children).map((it) => {
                    return {
                        name: it.children[1].firstElementChild.innerText,
                        winRate: parseFloat(it.children[3].innerText.replace(',', '.')),
                        games: parseFloat(it.children[2].innerText.replace(',', '.')),
                    }
                });
            });

        } catch (ex) {
            App.log(`Error while gathering popularity and WR info`, ex);
            this.failedJobs.push(url);
        } finally {
            await page.close();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.gatherPopularityAndWinRateInfo(remainingTrials);
            } else {
                App.log(`No more tries remaining for gathering popularity and WR`);
                return null;
            }
        }
    },

    gatherNews: async function () {
        await this.setBrowser();
        const page = await this.createPage();
        let url = `https://news.blizzard.com/pt-br/heroes-of-the-storm`;
        let divClass = ".ArticleListItem article";

        if (StringUtils.isEn()) {
            url = `https://news.blizzard.com/en-us/heroes-of-the-storm`;
            divClass = ".Card-content";
        }

        let result
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            result = await page.evaluate((divClass) => {
                return Array.from(document.querySelectorAll(divClass)).slice(0, 3).map(it => {
                    return {
                        header: it.firstChild.innerText,
                        link: (it.firstChild.href)
                    }
                })
            }, divClass);
            await this.browser.close();
        } catch (ex) {
            App.log('Error while gathering news', ex);
            this.failedJobs.push(url)
        }
        if (result != null) {
            return result;
        } else {
            await this.gatherNews();
        }
    },

    createHeroesProfileSession: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        App.log(`Creating heroes profile session`);
        const page = await this.createPage();
        const url = 'https://www.heroesprofile.com/Global/Talents/';
        let response;
        try {
            response = await page.goto(url, {waitUntil: 'domcontentloaded'})
            App.log(`Created heroes profile session`);
            return response._headers['set-cookie'];
        } catch (ex) {
            App.log(`Error while creating heroes session`, ex);
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.createHeroesProfileSession(remainingTrials);
            } else {
                App.log(`No more tries remaining for heroes profile session`);
                return null;
            }
        } finally {
            await page.close();
        }
    },

    gatherHeroStats: async function (icyUrl, heroId, profileUrl, heroesMap, cookie) {
        const page = await this.createPage();
        let icyData;
        let profileData;

        await page.setExtraHTTPHeaders({
            'Cookie': cookie,
        });

        try {

            await page.goto(icyUrl, {waitUntil: 'domcontentloaded'});

            icyData = await page.evaluate((icyUrl) => {
                const names = Array.from(document.querySelectorAll('.toc_no_parsing')).map(it => it.innerText);
                const skills = Array.from(document.querySelectorAll('.talent_build_copy_button > input')).map(skillsElements => skillsElements.value);
                const counters = Array.from(document.querySelectorAll('.hero_portrait_bad')).map(nameElements => nameElements.title);
                const synergies = Array.from(document.querySelectorAll('.hero_portrait_good')).map(nameElements => nameElements.title);
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
                    counters: counters,
                    synergies: synergies,
                    strongerMaps: strongerMaps,
                    tips: tips
                };

            }, icyUrl);
        } catch (ex) {
            App.log(`Error while fetching icyData`, ex);
        }

        try {

            await page.goto(profileUrl, {waitUntil: 'domcontentloaded'});

            profileData = await page.evaluate((profileUrl) => {
                const names = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .win_rate_cell')).map(it => `(${it.innerText}% win rate)`)
                const skills = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .build-code')).map(it => it.innerText)
                const builds = [];
                for (let i in names) {
                    builds.push({
                        name: `[Popular Build](${profileUrl.replace('getChartDataTalentBuilds.php', '').replaceAll(' ', '+')}) ${names[i]}`,
                        skills: skills[i]
                    });
                }

                return {
                    builds: builds,
                };
            }, profileUrl);
        } catch (ex) {
            App.log(`Error while fetching profileData`, ex);
        } finally {
            await page.close();
        }

        if (icyData != null && profileData != null) {
            let returnObject = {
                icyData: icyData,
                profileData: profileData
            }

            heroesMap.set(heroId, returnObject);
        } else {
             await this.gatherHeroStats(icyUrl, heroId, profileUrl, heroesMap, cookie);
        }
    },

    translateTips: async function (heroesInfos) {
        App.log(`Started translate process`);
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
                let index = heroesAux.findIndex(it => it.id === heroKey);
                heroesAux[index].infos.localizedTips = heroData
            }
        });
        Heroes.setHeroesInfos(heroesAux);
        this.writeFile('data/heroes-infos.json', heroesAux);
    },

    assembleHeroBuilds: function (profileData, hero, index, icyData) {

        if (profileData?.builds?.length === 0) {
            App.log(`No (profile) builds found for ${hero.name}`);
        }

        //retrieves the duplicate items
        let repeatedBuilds = profileData?.builds?.filter(item =>
            (icyData.builds.map(it => it.skills.unaccent()).includes(item.skills.unaccent()))
        );

        //applies winrate on known builds names
        icyData.builds.forEach(it => {
            for (let item of repeatedBuilds) {
                if (item.skills.unaccent() === it.skills.unaccent()) {
                    it.name = `${it.name} (${item.name.match(/([\d.]%*)/g, '').join('').replace('..', '')} win rate)`
                }
            }
        });

        //removes the duplicate items
        if (profileData)
            profileData.builds = profileData?.builds?.filter(item => !repeatedBuilds.includes(item));

        return icyData.builds.concat(profileData?.builds?.slice(0, 4)).slice(0, 5);
    },

    updateData: async function (args) {
        await this.setBrowser();
        App.log(`Started updating data process`);
        this.isUpdatingData = true;

        if (args === "rotation") {
            await this.gatherHeroesPrint();
            await this.gatherHeroesRotation();
            this.endUpdate();
            return
        }
        //write to file
        await this.gatherHeroesPrint();
        await this.gatherBanTierListInfo();
        await this.gatherCompositionsInfo();
        await this.gatherHeroesRotation();

        const popularityWinRate = await this.gatherPopularityAndWinRateInfo();
        const cookieValue = await this.createHeroesProfileSession();

        let heroesMap = new Map();
        let heroesIdAndUrls = [];
        let heroesInfos = Heroes.findAllHeroes();

        for (let hero of heroesInfos) {
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
                cookieValue).catch() : null;
        };

        let startTime = new Date();

        const thread = new PromisePool(promiseProducer, 5);

        try {
            App.log(`Started gathering heroes data`);
            thread.start().then(() => {

                let finishedTime = new Date();

                App.log(`Finished gathering process in ${(finishedTime.getTime() - startTime.getTime()) / 1000} seconds`);
                this.browser.close().catch();

                for (let [heroKey, heroData] of heroesMap) {
                    let index = heroesInfos.findIndex(it => it.id === heroKey);
                    let icyData = heroData.icyData
                    let profileData = heroData.profileData
                    let heroMaps = [];

                    for (let strongerMap of icyData.strongerMaps) {
                        let heroMap = Maps.findMap(strongerMap);
                        if (heroMap)
                            heroMaps.push({
                                name: heroMap.name,
                                localizedName: heroMap.localizedName
                            });
                    }

                    if (heroesInfos[index] == null) {
                        heroesInfos[index] = {};
                    }

                    heroesInfos[index].infos = {};
                    heroesInfos[index].id = heroKey;
                    heroesInfos[index].name = Heroes.findHero(heroKey, false, true).name;
                    heroesInfos[index].infos.builds = this.assembleHeroBuilds(profileData,
                        heroesInfos,
                        heroesInfos[index],
                        icyData
                    );

                    heroesInfos[index].infos.synergies = icyData.synergies;
                    heroesInfos[index].infos.counters = icyData.counters;
                    heroesInfos[index].infos.strongerMaps = heroMaps;
                    heroesInfos[index].infos.tips = icyData.tips.map(tip => `${tip}\n`).join('');

                    let obj = popularityWinRate?.find(it => {
                        return it.name.cleanVal() === heroesInfos[index].name.cleanVal()
                    });
                    heroesInfos[index].infos.winRate = obj?.winRate ?? 0;
                    heroesInfos[index].infos.games = obj?.games ?? 0;
                }

                Heroes.setHeroesInfos(heroesInfos);
                Heroes.setHeroesTierPosition();

                this.translateTips(heroesInfos).then(() => {
                    App.log(`Finished translate process`);
                    this.endUpdate();
                });
            });
        } catch (e) {

            if (e.stack.includes('Navigation timeout of 30000 ms exceeded')
                || e.stack.includes('net::ERR_ABORTED')
                || e.stack.includes('net::ERR_NETWORK_CHANGED')) {
                await this.updateData();
            }

            App.log('Error while updating', e);
            this.isUpdatingData = false;
        }
    },

    endUpdate: function () {
        App.log(`Finished update process`);
        this.isUpdatingData = false;
        App.bot.updatedAt = new Date().toLocaleString("pt-BR");
        App.setBotStatus('Heroes of the Storm', 'PLAYING');
    },

    postSlashCommandsToAPI: async function (commandObj) {
        await rest.post(
            Routes.applicationCommands(process.env.CLIENT_ID), {body: commandObj},
        );
    },

    getApiCommandsSize: async function () {
        if (!App.bot.application?.owner) await App.bot.application?.fetch();
        const botCommands = await App.bot.application?.commands.fetch()
        return botCommands.size
    },

    isUpdateNeeded: function () {
        return !Heroes.findHero('1', true)?.infos?.builds?.length > 0
    },

    startSession: async function (blockStuff = true) {
        try {
            await this.createPage(blockStuff);
        } catch (e) {
            await this.setBrowser();
            await this.createPage();
        }
    },

    setBrowser: async function () {
        this.browser = await puppeteer.launch({
            headless: true,
            // devtools: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        })
    },

    createPage: async function (blockStuff = true) {

        const page = await this.browser.newPage();
        await page.setRequestInterception(true);

        page.on('request', (request) => {
            if (blockStuff && ['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
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
                App.log(`error while writing file ${path}`, e);
                msg.reply(StringUtils.get('could.not.update.data.try.again'));
            }
        });
    }

}
