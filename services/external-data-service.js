require('dotenv').config({ path: './variables.env' });
const HeroService = require('./hero-service.js').HeroService;
const PromisePool = require('es6-promise-pool');
const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
const { App } = require('../app.js');
const { NexusCompendiumIntegrationService } = require('./integration/nexus-compendium-integration-service.js');
const { HeroesProfileIntegrationService } = require('./integration/heroes-profile-integration.js');
const { IcyVeinsIntegrationService } = require('./integration/icy-veins-integration-service.js');
const { BlizzardIntegrationService } = require('./integration/blizzard-integration-service.js');
const { PuppeteerService } = require('./puppeteer-service.js');
const rest = new REST({ version: '9' }).setToken(process.env.HEROES_INFOS_TOKEN);

exports.ExternalDataService = {
    isUpdatingData: false,
    replyTo: null,
    popularityWinRate: null,

    updateData: async function (args) {
        await PuppeteerService.setBrowser();
        App.log(`Started updating data process`);
        this.isUpdatingData = true;
        const numberOfWorkers = process.env.THREAD_WORKERS ? Number(process.env.THREAD_WORKERS) : 5;
        const updateSteps = [];
        updateSteps.push(NexusCompendiumIntegrationService.gatherHeroesPrint());
        updateSteps.push(NexusCompendiumIntegrationService.gatherHeroesRotation().then(result => HeroService.updateRotation(result)));

        if (args === 'rotation') {
            const rotationPromiseProducer = () => updateSteps.pop() ?? null;
            const dataThread = new PromisePool(rotationPromiseProducer, numberOfWorkers);
            dataThread.start().then(async () => {
                await this.afterUpdate();
                return;
            });
        } else {
            this.popularityWinRate = null;
            updateSteps.push(HeroesProfileIntegrationService.getBanTierListInfo().then(result => HeroService.updateBanList(result.splice(0, 20).map(it => it.name))));
            updateSteps.push(HeroesProfileIntegrationService.getCompositionsInfo().then(result => HeroService.updateCompositions(result)));
            updateSteps.push(HeroesProfileIntegrationService.getHeroesInfluenceFromAPI().then(result => this.popularityWinRate = result));

            const dataPromiseProducer = () => {
                const currPromise = updateSteps.pop()
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
                        accessLink: hero.accessLink,
                        heroNormalizedName: normalizedName
                    });
                }

                const heroUpdateSteps = () => {
                    const heroCrawlInfo = heroesIdAndUrls.pop();
                    return heroCrawlInfo ? this.gatherHeroStats(
                        heroCrawlInfo.heroId,                        
                        heroCrawlInfo.heroNormalizedName,
                        heroCrawlInfo.accessLink,
                        heroesMap).catch() : null;
                };

                let startTime = new Date();

                const heroesInfosThread = new PromisePool(heroUpdateSteps, numberOfWorkers);

                try {
                    App.log(`Started gathering heroes data`);
                    heroesInfosThread.start().then(async () => {
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
        await BlizzardIntegrationService.gatherNews();
    },

    gatherHeroStats: async function (heroId, heroName, heroIcyLink, heroesMap) {
        const icyData = await IcyVeinsIntegrationService.gatherIcyData(heroIcyLink);
        let profileData = await HeroesProfileIntegrationService.getBuildsFromAPI(heroName);

        if (icyData && profileData) {
            heroesMap.set(heroId, { icyData, profileData });
        } else {
            if (icyData == null && profileData == null) {
                await this.gatherHeroStats(heroId, heroName, heroIcyLink, heroesMap);
            } else if (profileData == null) {
                profileData = await this.gatherWhenFail(null, heroName, 3);
                heroesMap.set(heroId, { icyData, profileData });
            }
        }
    },

    gatherWhenFail: async function (profileData, heroName, remainingTries) {
        remainingTries = remainingTries ?? 3;
        await App.delay(1500);
        profileData = await HeroesProfileIntegrationService.getBuildsFromAPI(heroName);

        if (profileData != null) {
            return profileData;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherWhenFail(profileData, heroName, remainingTries);
            } else {
                App.log(`No more tries remaining for ${heroName}`);
                return null;
            }
        }
    },

    afterUpdate: async function () {
        PuppeteerService.closeBrowser();
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
}
