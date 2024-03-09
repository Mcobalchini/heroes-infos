require('dotenv').config({ path: './variables.env' });
const HeroService = require('./hero-service.js').HeroService;
const MapService = require('./map-service.js').MapService;
const puppeteer = require('puppeteer');
const PromisePool = require('es6-promise-pool');
const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
const { App } = require('../app.js');
const { FileService } = require('./file-service');
const { NexusCompendiumIntegrationService: NexusCompendiumIntegration } = require('../integration/nexus-compendium-integration-service.js');
const { HeroesProfileIntegration: HeroesProfileIntegrationService } = require('../integration/heroes-profile-integration.js');
const { IcyVeinsIntegrationService: IcyVeinsIntegrationService } = require('../integration/icy-veins-integration-service.js');
const { BlizzardIntegrationService } = require('../integration/blizzard-integration-service.js');
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
        const page = await this.createPage(null, false);
        promises.push(NexusCompendiumIntegration.gatherHeroesPrint(page));
        promises.push(NexusCompendiumIntegration.gatherHeroesRotation());

        if (args === 'rotation') {
            const rotationPromiseProducer = () => promises.pop() ?? null;
            const dataThread = new PromisePool(rotationPromiseProducer, numberOfWorkers);
            dataThread.start().then(async () => {
                await this.afterUpdate();
                return;
            });
        } else {
            promises.push(HeroesProfileIntegrationService.gatherBanTierListInfo());
            promises.push(HeroesProfileIntegrationService.gatherCompositionsInfo());
            promises.push(HeroesProfileIntegrationService.gatherPopularityAndWinRateInfo());
            this.popularityWinRate = null;

            const dataPromiseProducer = () => {
                const currPromise = promises.pop()
                return currPromise ?? null;
            }

            const dataThread = new PromisePool(dataPromiseProducer, numberOfWorkers);
            dataThread.start().then(async () => {
                let heroesMap = new Map();
                let heroesIdAndUrls = [];
                let heroesInfos = HeroService.findAllHeroes();

                for (let hero of heroesInfos) {
                    let normalizedName = hero.name.replace('/ /g', '+').replace('/\'/g', '%27');
                    heroesIdAndUrls.push({
                        heroId: hero.id,
                        heroNormalizedName: normalizedName
                    });
                }

                const promiseProducer = () => {
                    const heroCrawlInfo = heroesIdAndUrls.pop();
                    return heroCrawlInfo ? this.gatherHeroStats(
                        heroCrawlInfo.heroId,
                        heroCrawlInfo.heroNormalizedName,
                        heroesMap).catch() : null;
                };

                let startTime = new Date();

                const thread = new PromisePool(promiseProducer, numberOfWorkers);

                try {
                    App.log(`Started gathering heroes data`);
                    thread.start().then(async () => {
                        let finishedTime = new Date();
                        App.log(`Finished gathering process in ${(finishedTime.getTime() - startTime.getTime()) / 1000} seconds`);
                        HeroService.updateHeroesInfos(heroesMap, this.popularityWinRate, heroesInfos);
                        await this.afterUpdate();
                    });
                } catch (e) {
                    if (e.stack.includes('Navigation timeout')
                        || e.stack.includes('net::ERR_ABORTED')
                        || e.stack.includes('net::ERR_NETWORK_CHANGED')) {
                        App.log('Updating again after network error');
                        await this.updateData();
                    }

                    App.log('Error while updating', e);
                    this.isUpdatingData = false;
                }

            });
        }
    },

    gatherNews: async function () {
        await this.setBrowser();
        const page = await this.createPage();
        await BlizzardIntegrationService.gatherNews();
    },

    gatherHeroStats: async function (heroId, heroName, heroesMap) {
        const page = await this.createPage();
        const icyData = await IcyVeinsIntegrationService.gatherIcyData(page, heroName);
        let profileData = await HeroesProfileIntegrationService.gatherProfileBuildsFromAPI(heroName);

        if (icyData && profileData) {            
            await this.setHeroDataAndClosePage(heroId, icyData, profileData, heroesMap);
        } else {
            if (icyData == null && profileData == null) {
                await this.gatherHeroStats(heroId, heroName, heroesMap);
            } else if (profileData == null) {
                profileData = await this.gatherWhenFail(null, page, heroName, 3);
                await this.setHeroDataAndClosePage(heroId, icyData, profileData, heroesMap);
            }
        }
    },

    setHeroDataAndClosePage: async function(heroId, icyData, profileData, heroesMap) {
        heroesMap.set(heroId, { icyData, profileData });
        try {
            await page.close();
        } catch (ex) {
            App.log(`Error while closing page ${page?.url}`, ex);
        }
    },

    gatherWhenFail: async function (profileData, page, heroName, remainingTries) {
        remainingTries = remainingTries ?? 3;
        await App.delay(1500);
        profileData = await this.gatherProfileBuildsFromAPI(heroName);

        if (profileData != null) {
            return profileData;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherWhenFail(profileData, page, heroName, remainingTries);
            } else {
                App.log(`No more tries remaining for ${heroName}`);
                return null;
            }
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

        await page.exposeFunction('fun', fun);
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

    afterUpdate: async function () {
        await this.browser.close().catch();
        App.log(`Finished update process`);
        this.isUpdatingData = false;
        App.bot.updatedAt = new Date().toLocaleString('pt-BR');
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
