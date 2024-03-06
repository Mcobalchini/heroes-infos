require('dotenv').config({ path: './variables.env' });
const HeroService = require('./hero-service.js').HeroService;
const MapService = require('./map-service.js').MapService;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
const { App } = require('../app.js');
const { FileService } = require("./file-service");
const { JSDOM } = require("jsdom");
const rest = new REST({ version: '9' }).setToken(process.env.HEROES_INFOS_TOKEN);

exports.Network = {
    isUpdatingData: false,
    replyTo: null,
    browser: null,
    hosts: null,
    popularityWinRate: null,

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
        const numberOfWorkers = process.env.THREAD_WORKERS ? Number(process.env.THREAD_WORKERS) : 5;
        const promises = [];
        promises.push(this.gatherHeroesPrint());
        promises.push(this.gatherHeroesRotation());

        if (args === "rotation") {
            const rotationPromiseProducer = () => promises.pop() ?? null;
            const dataThread = new PromisePool(rotationPromiseProducer, numberOfWorkers);
            dataThread.start().then(async () => {
                await this.endUpdate();
                return;
            });
        } else {
            promises.push(this.gatherBanTierListInfo());
            promises.push(this.gatherCompositionsInfo());
            promises.push(this.gatherPopularityAndWinRateInfo());
            this.popularityWinRate = null;

            const cookieValue = await this.createHeroesProfileSession();

            const dataPromiseProducer = () => {
                const currPromise = promises.pop()
                return currPromise ?? null;
            }

            const dataThread = new PromisePool(dataPromiseProducer, numberOfWorkers);

            App.log(`Creating heroes profile session cookie`);
            dataThread.start().then(async () => {
                let heroesMap = new Map();
                let heroesIdAndUrls = [];
                let heroesInfos = HeroService.findAllHeroes();

                for (let hero of heroesInfos) {
                    let normalizedName = hero.name.replace('/ /g', '+').replace('/\'/g', '%27');
                    heroesIdAndUrls.push({
                        heroId: hero.id,
                        heroNormalizedName: normalizedName,
                        icyUrl: `https://www.icy-veins.com/heroes/${hero.accessLink}-build-guide`,
                        //profileUrl: `https://www.heroesprofile.com/Global/Talents/getChartDataTalentBuilds.php?hero=${normalizedName}`
                        profileUrl: `https://www.heroesprofile.com/api/v1/global/talents/build`
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

                const thread = new PromisePool(promiseProducer, numberOfWorkers);

                try {
                    App.log(`Started gathering heroes data`);
                    thread.start().then(async () => {
                        let finishedTime = new Date();
                        App.log(`Finished gathering process in ${(finishedTime.getTime() - startTime.getTime()) / 1000} seconds`);
                        HeroService.updateHeroesInfos(heroesMap, this.popularityWinRate, heroesInfos);
                        await this.endUpdate();
                    });
                } catch (e) {
                    if (e.stack.includes('Navigation timeout')
                        || e.stack.includes('net::ERR_ABORTED')
                        || e.stack.includes('net::ERR_NETWORK_CHANGED')) {
                        App.log("Updating again after network error");
                        await this.updateData();
                    }

                    App.log('Error while updating', e);
                    this.isUpdatingData = false;
                }

            });
        }
    },

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
        const drafterCookieValue = await this.createHeroesProfileDrafterSession();
        let data;
        const details = {
            'data[0][name]': 'timeframe',
            'data[0][value]': 'Minor',
            'data[1][name]': 'minor_timeframe',
            'data[1][value]': drafterCookieValue?.version,
            'currentPickNumber': '0',
            'mockdraft': 'false',
        }
        try {
            let formBody = [];
            for (let property in details) {
                const encodedKey = encodeURIComponent(property);
                const encodedValue = encodeURIComponent(details[property]);
                formBody.push(encodedKey + "=" + encodedValue);
            }
            formBody = formBody.join("&");

            const requestOptions = {
                method: 'POST',
                headers:
                {                    
                    'X-Csrf-Token': drafterCookieValue.csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                }
                ,
                body: formBody,
            };

            const fetchedData = await fetch("https://drafter.heroesprofile.com/getDraftBanData", requestOptions)
            const html = await fetchedData.text();
            const dom = new JSDOM(html);
            data = Array.from(dom.window.document.querySelectorAll('.rounded-picture.hero-picture')).map(it => {
                const value = it.attributes['data-content'].value;
                const regex = /Games Banned: ([\d,]+)/;
                const match = regex.exec(value);
                const bannedMatches = match ? match[1] : 0;
                return {
                    name: it.attributes['data-heroname'].value,
                    bannedMatches: Number(bannedMatches.replaceAll(',', ''))
                }
            });
        } catch (e) {
            App.log('error while gathering heroes ban list', e)
            data = [];
        }

        if (data)
            HeroService.updateBanList(data.splice(0, 20).map(it => it.name));
    },

    gatherCompositionsInfo: async function () {
        App.log(`Gathering compositions`);

        const fun = () => {
            return Array.from(document.querySelectorAll('#combinations-data tbody tr:not(.data-row)')).map(it => {
                return {
                    games: it.children[3]?.innerText,
                    winRate: parseFloat(it.children[1]?.innerText?.replace(',', '.')),
                    roles: Array.from(it.children[0].children[0].children)?.map(div => div.attributes['data-heroname']?.nodeValue)
                }
            });
        };

        const options = {
            url: 'https://www.heroesprofile.com/Global/Compositions/',
            waitUntil: 'domcontentloaded',
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

        this.popularityWinRate = await this.performConnection(options);
    },

    gatherNews: async function () {
        await this.setBrowser();
        const page = await this.createPage();
        let url = `https://news.blizzard.com/en-us/heroes-of-the-storm`;
        let divClass = ".Card-content";
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

    createHeroesProfileSession: async function (remainingTries) {
        remainingTries = remainingTries ?? 3;

        const browser = await this.createBrowser();
        const page = await this.createPage(browser);
        const url = 'https://www.heroesprofile.com/Global/Talents/';
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const cookies = await page.cookies();
            return `${cookies[0].name}=${cookies[0].value};`
        } catch (ex) {
            App.log(`Error while creating heroes session`, ex);
            if (remainingTries > 0) {
                remainingTries--;
                await this.createHeroesProfileSession(remainingTries);
            } else {
                App.log(`No more tries remaining for heroes profile session`);
                return null;
            }
        } finally {
            await page.close();
            await browser.close();
        }
    },

    createHeroesProfileDrafterSession: async function (remainingTries) {
        remainingTries = remainingTries ?? 3;
        App.log(`Creating heroes draft session`);
        const page = await this.createPage();
        const url = 'https://drafter.heroesprofile.com/Drafter';
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
            App.log(`Created heroes profile session`);

            const obj = await page.evaluate(() => {
                const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
                const version = document.querySelector('[name="minor_timeframe"] option[selected]').value;
                return { csrfToken, version }
            });
            
            return {
                version: obj.version,
                csrfToken: obj.csrfToken,                
            }
        } catch (ex) {
            App.log(`Error while creating heroes draft session`, ex);
            if (remainingTries > 0) {
                remainingTries--;
                await this.createHeroesProfileDrafterSession(remainingTries);
            } else {
                App.log(`No more tries remaining for heroes draft session`);
                return null;
            }
        } finally {
            await page.close();
        }
    },

    gatherHeroesPrint: async function (remainingTries) {
        remainingTries = remainingTries ?? 3;
        const page = await this.createPage(null, false);

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
                await this.gatherHeroesPrint(remainingTries);
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
        let profileData = await this.gatherProfileData(page, profileUrl);
        if (icyData != null && profileData != null) {
            icyData.strongerMaps = icyData.strongerMaps.map(it => {
                const strongerMap = MapService.findMap(it);
                return {
                    name: strongerMap.name,
                    localizedName: strongerMap.localizedName
                }
            });

            let returnObject = {
                icyData,
                profileData
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
                profileData = await this.gatherWhenFail(profileUrl, null, page);

                let returnObject = {
                    icyData,
                    profileData
                }

                heroesMap.set(heroId, returnObject);
                try {
                    await page.close();
                } catch (ex) {
                    App.log(`Error while closing page`, ex);
                }
            }
        }
    },

    gatherWhenFail: async function (profileUrl, profileData, page, remainingTries) {
        remainingTries = remainingTries ?? 3;
        await App.delay(1500);
        profileData = await this.gatherProfileData(page, profileUrl);
        
        if (profileData != null) {
            return profileData;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherWhenFail(profileUrl, profileData, page, remainingTries);
            } else {
                App.log(`No more tries remaining for ${profileUrl}`);
                return null;
            }
        }
    },

    gatherIcyData: async function (page, icyUrl) {
        try {
            await page.goto(icyUrl, { waitUntil: 'domcontentloaded' });

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
                    counters: { countersText, heroes: counters },
                    synergies: { synergiesText, heroes: synergies },
                    strongerMaps: strongerMaps,
                    tips: tips
                };

            }, icyUrl);
        } catch (ex) {
            App.log(`Error while fetching icyData ${icyUrl}`, ex);
            if (ex.stack.includes("Navigation timeout")) {
                this.gatherIcyData(page, icyUrl);
            }
        }
    },

    gatherProfileData: async function (page, profileUrl) {
        try {
            await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

            return await page.evaluate((profileUrl) => {
                
                const names = Array.from(document.querySelectorAll('#table-container2 tbody tr')).map(it => `(${it.lastElementChild.innerText}% win rate)`);
                const skills = Array.from(document.querySelectorAll('#table-container2 tbody tr')).map(it => `${it.children[1].innerText.substring(0, it.children[1].innerText.indexOf('\n'))}`);
                const builds = [];
                for (let i in names) {
                    builds.push({
                        name: `[Popular Build](${profileUrl.replace('getChartDataTalentBuilds.php', '').replaceAll(' ', '+')}) ${names[i]}`,
                        skills: skills[i]
                    });
                }
                if (builds.length > 0) {
                    return {
                        builds: builds
                    };
                } else {
                    return null;
                }

            }, profileUrl);
        } catch (ex) {
            App.log(`Error while fetching profileData ${profileUrl}`, ex);
        }
    },

    performConnection: async function (options, remainingTries) {
        const url = options.url;
        const fun = options.function;
        const headers = options.headers;
        const blockStuff = options.blockStuff ?? true;
        remainingTries = remainingTries ?? 3;

        const page = await this.createPage(null, blockStuff);

        if (headers) {
            await page.setExtraHTTPHeaders({
                headers,
            });
        }

        await page.exposeFunction("fun", fun);
        let result;
        try {
            await page.goto(url, { waitUntil: options.waitUntil, timeout: 60000 });
            result = await page.evaluate(fun);
        } catch (ex) {
            App.log(`Error while fetching ${options.url}`, ex);
        } finally {
            await page.close();
        }

        if (result != null) {
            return result;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.performConnection(remainingTries, options);
            } else {
                App.log(`No more tries remaining for ${options.url}`);
                return null;
            }
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
            Routes.applicationCommands(process.env.CLIENT_ID), { body: commandObj },
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
        this.browser = await this.createBrowser();
    },

    createBrowser: async function () {
        return await puppeteer.launch({
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
        });
    },

    createPage: async function (browser = null, blockStuff = true) {
        const auxBrowser = browser ?? this.browser;
        const page = await auxBrowser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            let domain = null;
            let frags = request.url().split('/');
            if (frags.length > 2) {
                domain = frags[2];
            }
            if (this.hosts?.includes(domain) ||
                blockStuff && ['image', 'stylesheet', 'font', 'script', 'xhr'].indexOf(request.resourceType()) !== -1) {
                request.abort();
            } else {
                request.continue();
            }
            // console.log('>>', request.method(), request.url(), request.resourceType());
        });
////////         page.on('response', response => console.log('<<', response.status(), response.url()))

        return page;
    },
}
