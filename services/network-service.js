require('dotenv').config({path: './variables.env'});
const HeroService = require('./hero-service.js').HeroService;
const MapService = require('./map-service.js').MapService;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const {Routes} = require('discord-api-types/v9');
const {REST} = require('@discordjs/rest');
const {App} = require('../app.js');
const {FileService} = require("./file-service");
const rest = new REST({version: '9'}).setToken(process.env.HEROES_INFOS_TOKEN);

exports.Network = {
    isUpdatingData: false,
    replyTo: null,
    browser: null,
    hosts: null,

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

    gatherBanTierListInfo: async function () {
        App.log(`Gathering ban list`);
        const fun = function () {
            return [...new Set(Array.from(document.querySelectorAll('.htl_ban_true'))
                .map(nameElements => nameElements.nextElementSibling.innerText))];
        };

        const options = {
            url: 'https://www.icy-veins.com/heroes/heroes-of-the-storm-general-tier-list',
            waitUntil: 'domcontentloaded',
            function: fun
        }

        const result = await this.performConnection(options);

        if (result)
            HeroService.updateBanList(result);
    },

    gatherCompositionsInfo: async function () {
        App.log(`Gathering compositions`);

        const fun = function () {
            return Array.from(document.querySelector('.cdk-table tbody')?.children)?.map((it) => {
                return {
                    games: it.children[0].innerText,
                    winRate: parseFloat(it.children[1].innerText.replace(',', '.')),
                    roles: Array.from(it.children).filter(it => it.style.display === 'none').map(it => it.innerText)
                }
            });
        };

        const options = {
            url: 'https://www.hotslogs.com/sitewide/teamcompositions',
            waitUntil: 'networkidle2',
            blockStuff: false,
            function: fun
        }

        const result = await this.performConnection(options);

        if (result)
            HeroService.updateCompositions(result);
    },

    gatherPopularityAndWinRateInfo: async function () {
        App.log(`Gathering influence`);

        const fun = () => {
            return Array.from(document.querySelectorAll('#hero-stat-data tr')).filter(f => f.firstElementChild).map((it) => {
                return {
                    name: it.firstElementChild?.children[0]?.children[1].innerText,
                    influence: it.children[7].innerText,
                }
            });
        };

        const options = {
            url: 'https://heroesprofile.com/Global/Hero/',
            waitUntil: 'domcontentloaded',
            function: fun
        }

        return await this.performConnection(options);
    },

    gatherNews: async function () {
        await this.setBrowser();
        const page = await this.createPage();
        let url = `https://news.blizzard.com/en-us/heroes-of-the-storm`;
        let divClass = ".Card-content";
        let result;
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
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            App.log(`Created heroes profile session`);
            const cookies = await page.cookies();
            return `${cookies[0].name}=${cookies[0].value};`
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

    gatherHeroesPrint: async function (remainingTrials) {
        remainingTrials = remainingTrials ?? 3;
        const page = await this.createPage(false);

        let result;
        const url = `https://nexuscompendium.com/currently`;

        try {
            await page.goto(url, {waitUntil: 'networkidle0'});
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
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.gatherHeroesPrint(remainingTrials);
            } else {
                App.log(`No more tries remaining for gathering heroes print`);
                return null;
            }
        }
    },

    gatherHeroStats: async function (icyUrl, heroId, profileUrl, heroesMap, cookie) {
        const page = await this.createPage();
        await page.setExtraHTTPHeaders({
            'Cookie': cookie,
        });

        const icyData = await this.gatherIcyData(page, icyUrl);
        const profileData = await this.gatherProfileData(page, profileUrl);

        if (icyData != null && profileData != null) {
            icyData.strongerMaps = icyData.strongerMaps.map(it => {
                const strongerMap = MapService.findMap(it);
                return {
                    name: strongerMap.name,
                    localizedName: strongerMap.localizedName
                }
            });

            let returnObject = {
                icyData: icyData,
                profileData: profileData
            }

            heroesMap.set(heroId, returnObject);
            try {
                await page.close();
            } catch (ex) {
                App.log(`Error while closing page`, ex);
            }
        } else {
            if (icyData == null && profileData == null) {
                await this.gatherHeroStats(icyUrl, heroId, profileUrl, heroesMap, cookie);
            } else if (profileData == null) {
                await this.gatherProfileData(page, profileUrl);
            }
        }
    },

    gatherIcyData: async function (page, icyUrl) {
        try {

            await page.goto(icyUrl, {waitUntil: 'domcontentloaded'});

            return await page.evaluate((icyUrl) => {
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
                    counters: {countersText, heroes: counters},
                    synergies: {synergiesText, heroes: synergies},
                    strongerMaps: strongerMaps,
                    tips: tips
                };

            }, icyUrl);
        } catch (ex) {
            App.log(`Error while fetching icyData ${icyUrl}`, ex);
        }
    },

    gatherProfileData: async function (page, profileUrl) {
        try {
            await page.goto(profileUrl, {waitUntil: 'domcontentloaded', timeout: 60000});

            return await page.evaluate((profileUrl) => {
                const names = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .win_rate_cell')).map(it => `(${it.innerText}% win rate)`);
                const skills = Array.from(document.querySelectorAll('#popularbuilds.primary-data-table tr .build-code')).map(it => it.innerText);
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
            App.log(`Error while fetching profileData ${profileUrl}`, ex);
        }
    },

    performConnection: async function (options, remainingTrials) {
        const url = options.url;
        const fun = options.function;
        const blockStuff = options.blockStuff ?? true;
        remainingTrials = remainingTrials ?? 3;

        const page = await this.createPage(blockStuff);
        await page.exposeFunction("fun", fun);
        let result;
        try {
            await page.goto(url, {waitUntil: options.waitUntil, timeout: 30000});
            result = await page.evaluate(fun);
        } catch (ex) {
            App.log(`Error while fetching ${options.url}`, ex);
        } finally {
            await page.close();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTrials > 0) {
                remainingTrials--;
                await this.performConnection(remainingTrials, options);
            } else {
                App.log(`No more tries remaining for ${options.url}`);
                return null;
            }
        }
    },

    updateData: async function (args) {
        const hostFile = FileService.openFile('./data/constant/blocked-hosts.txt').split('\n');
        this.hosts = hostFile.map(it => {
            const frag = it.split(' ');
            if (frag.length > 1 && frag[0] === '0.0.0.0') {
                return frag[1];
            }
        }).filter(it => it);

        await this.setBrowser();
        App.log(`Started updating data process`);
        this.isUpdatingData = true;

        await this.gatherHeroesPrint();
        await this.gatherHeroesRotation();
        if (args === "rotation") {
            await this.endUpdate();
            return;
        }
        await this.gatherBanTierListInfo();
        await this.gatherCompositionsInfo();

        const popularityWinRate = await this.gatherPopularityAndWinRateInfo();
        const cookieValue = await this.createHeroesProfileSession();

        let heroesMap = new Map();
        let heroesIdAndUrls = [];
        let heroesInfos = HeroService.findAllHeroes();

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
        const workers = process.env.THREAD_WORKERS ? Number(process.env.THREAD_WORKERS) : 5;
        const thread = new PromisePool(promiseProducer, workers);

        try {
            App.log(`Started gathering heroes data`);
            thread.start().then(async () => {
                let finishedTime = new Date();
                App.log(`Finished gathering process in ${(finishedTime.getTime() - startTime.getTime()) / 1000} seconds`);

                HeroService.updateHeroesInfos(heroesMap, popularityWinRate, heroesInfos);

                await this.endUpdate();
            });
        } catch (e) {

            if (e.stack.includes('Navigation timeout of 60000 ms exceeded')
                || e.stack.includes('net::ERR_ABORTED')
                || e.stack.includes('net::ERR_NETWORK_CHANGED')) {
                App.log("Updating again");
                await this.updateData();
            }

            App.log('Error while updating', e);
            this.isUpdatingData = false;
        }
    },

    endUpdate: async function () {
        await this.browser.close().catch();
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
        const botCommands = await App.bot.application?.commands.fetch();
        return botCommands.size;
    },

    isUpdateNeeded: function () {
        return !HeroService.findHero('1', true)?.infos?.builds?.length > 0;
    },

    isRotationUpdateNeeded: function () {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(`${HeroService.getRotationData().endDate} `) < today;
    },

    setBrowser: async function () {
        this.browser?.close()?.catch();
        this.browser = await puppeteer.launch({
            headless: true,
            devtools: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--autoplay-policy=user-gesture-required',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-default-apps',
                '--disable-dev-shm-usage',
                '--disable-domain-reliability',
                '--disable-extensions',
                '--disable-features=AudioServiceOutOfProcess',
                '--disable-hang-monitor',
                '--disable-ipc-flooding-protection',
                '--disable-notifications',
                '--disable-offer-store-unmasked-wallet-cards',
                '--disable-popup-blocking',
                '--disable-print-preview',
                '--disable-prompt-on-repost',
                '--disable-renderer-backgrounding',
                '--disable-setuid-sandbox',
                '--disable-speech-api',
                '--disable-sync',
                '--hide-scrollbars',
                '--ignore-gpu-blacklist',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--no-pings',
                '--no-zygote',
                '--password-store=basic',
                '--use-gl=swiftshader',
                '--use-mock-keychain',
            ],
        })
    },

    createPage: async function (blockStuff = true) {

        const page = await this.browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            let domain = null;
            let frags = request.url().split('/');
            if (frags.length > 2) {
                domain = frags[2];
            }
            if (this.hosts.includes(domain) ||
                blockStuff && ['image', 'stylesheet', 'font', 'script', 'xhr'].indexOf(request.resourceType()) !== -1) {
                request.abort();
            } else {
                request.continue();
            }
            // console.log('>>', request.method(), request.url(), request.resourceType());
        });
        // page.on('response', response => console.log('<<', response.status(), response.url()))

        return page;
    },
}
