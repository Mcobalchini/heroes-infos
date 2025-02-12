require('dotenv').config({ path: './variables.env' });
const HeroService = require('./hero-service.js').HeroService;
const PromisePool = require('es6-promise-pool');
const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
const { NexusCompendiumIntegrationService } = require('./integration/nexus-compendium-integration-service.js');
const { HeroesProfileIntegrationService } = require('./integration/heroes-profile-integration-service.js');
const { IcyVeinsIntegrationService } = require('./integration/icy-veins-integration-service.js');
const { BlizzardIntegrationService } = require('./integration/blizzard-integration-service.js');
const { logger } = require('./log-service.js');
const { App } = require('../app.js');
const rest = new REST({ version: '9' }).setToken(process.env.HEROES_INFOS_TOKEN);
const HOUR = 1000 * 60 * 60;
const PERIOD = HOUR * 1;

exports.ExternalDataService = {
    isUpdatingData: false,
    replyTo: null,
    popularityWinRate: null,
    missingUpdateHeroes: [],
    numberOfWorkers: process.env.THREAD_WORKERS ? Number(process.env.THREAD_WORKERS) : 5,

    updateData: async function (args) {        
        logger.info(`started updating data process`);
        this.isUpdatingData = true;
        const updateSteps = [];
        if (args === 'heroes') {
            const missingHeroes = this.missingUpdateHeroes.map(it => HeroService.findHeroById(it));
            this.missingUpdateHeroes = [];
            await this.updateHeroesData(missingHeroes);
            return;
        } else {
            updateSteps.push(NexusCompendiumIntegrationService.gatherHeroesPrint());
            updateSteps.push(NexusCompendiumIntegrationService.gatherHeroesRotation().then(result => HeroService.updateRotation(result)));

            if (args === 'rotation') {
                const rotationPromiseProducer = () => updateSteps.pop() ?? null;
                const dataThread = new PromisePool(rotationPromiseProducer, this.numberOfWorkers);
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

                const dataThread = new PromisePool(dataPromiseProducer, this.numberOfWorkers);
                dataThread.start().then(async () => this.updateHeroesData(HeroService.getAllHeroes()));
            }
        }
    },

    gatherNews: async function () {
        await BlizzardIntegrationService.gatherNews();
    },

    updateHeroesData: async function (heroesInfos) {
        let heroesMap = new Map();
        let heroesIdAndUrls = [];

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

        const heroesInfosThread = new PromisePool(heroUpdateSteps, this.numberOfWorkers);

        try {
            logger.info(`started gathering heroes data`);
            heroesInfosThread.start().then(async () => {
                let finishedTime = new Date();
                logger.info(`finished gathering process in ${(finishedTime.getTime() - startTime.getTime()) / 1000} seconds`);
                HeroService.updateHeroesInfos(heroesMap, this.popularityWinRate);
                await this.afterUpdate();
            });
        } catch (e) {
            if (e.stack.includes('Navigation timeout')
                || e.stack.includes('net::ERR_ABORTED')
                || e.stack.includes('net::ERR_NETWORK_CHANGED')) {
                logger.error('updating again after network error', e);
                await this.updateData();
            }
            logger.error('error while updating', e);
            this.isUpdatingData = false;
        }
    },

    gatherHeroStats: async function (heroId, heroName, heroIcyLink, heroesMap) {
        let [
            icyData,
            profileData
        ] = await Promise.all([
            IcyVeinsIntegrationService.getIcyVeinsData(heroIcyLink),
            HeroesProfileIntegrationService.getBuildsFromAPI(heroName)
        ]);

        if (icyData && profileData) {
            heroesMap.set(heroId, { icyData, profileData });
        } else {
            if (icyData == null && profileData == null) {
                await this.gatherHeroStats(heroId, heroName, heroIcyLink, heroesMap);
            } else if (profileData == null) {
                profileData = await this.gatherWhenFail(null, heroId, heroName, 0);
                heroesMap.set(heroId, { icyData, profileData });
            }
        }
    },

    gatherWhenFail: async function (profileData, heroId, heroName, remainingTries) {
        remainingTries = remainingTries ?? 1;
        profileData = await HeroesProfileIntegrationService.getBuildsFromAPI(heroName);

        if (profileData != null) {
            return profileData;
        } else {
            if (remainingTries > 0) {
                remainingTries--;
                await this.gatherWhenFail(profileData, heroId, heroName, remainingTries);
            } else {
                logger.warn(`no more tries remaining for ${heroName}`);
                this.missingUpdateHeroes.push(heroId);
                return null;
            }
        }
    },

    afterUpdate: async function () {    
        logger.info(`finished update process`);
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
        return this.isFirstLoad() || this.missingUpdateHeroes.length > 0;
    },
    
    isFirstLoad: function () {
        return !HeroService.findHero('1', true)?.infos?.builds?.length > 0;
    },
    
    periodicUpdateCheck: function (interval) {
        logger.info('checking if update needed');
        let arg = null;

        if (this.isFirstLoad()) {
            arg = 'everything'
        } else if (this.isUpdateNeeded()) {
            arg = 'heroes';
        } else if (this.isRotationUpdateNeeded()) {
            arg = 'rotation';
        }

        if (arg) {
            App.setBotStatus(`Updating ${arg}`, 'WATCHING');
            this.updateData(arg).then(() => App.setBotStatus('Heroes of the Storm', 'PLAYING'));
        }

        if (interval)
            setInterval(() => this.periodicUpdateCheck(false), PERIOD);
    },

    isRotationUpdateNeeded: function () {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(`${HeroService.getRotationData().endDate} `) < today;
    },
}
