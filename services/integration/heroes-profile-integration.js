const { JSDOM } = require('jsdom');
const { PuppeteerService } = require('../puppeteer-service');
const { App } = require('../../app');

const urlConfig = {
    apiUrl: 'https://www.heroesprofile.com/api/v1/global',
    siteUrl: 'https://www.heroesprofile.com/Global',
    drafterBaseUrl: 'https://drafter.heroesprofile.com',
};

exports.HeroesProfileIntegrationService = {
    apiUrl: urlConfig.apiUrl,
    siteUrl: urlConfig.siteUrl,
    buildsUrl: `${urlConfig.apiUrl}/talents/build`,
    influenceUrl: `${urlConfig.apiUrl}/hero`,
    buildsTitleUrl: `${urlConfig.siteUrl}/Talents/`,
    compositionsUrl: `${urlConfig.apiUrl}/compositions`,
    drafterUrl: `${urlConfig.drafterBaseUrl}/Drafter`,
    banDataUrl: `${urlConfig.drafterBaseUrl}/getDraftBanData`,
    cookieValue: '',

    createDrafterSession: async function (remainingTries) {
        remainingTries = remainingTries ?? 3;
        const page = await PuppeteerService.createPage();
        try {
            await page.goto(this.drafterUrl, { waitUntil: 'domcontentloaded' });
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
                await this.createDrafterSession(remainingTries);
            } else {
                App.log(`No more tries remaining for heroes draft session`);
                return null;
            }
        } finally {
            await page.close();
        }
    },

    getBanTierListInfo: async function () {
        if (!this.cookieValue) {
            this.cookieValue = await this.createDrafterSession();
        }

        App.log(`Gathering ban list`);
        let data;
        const details = {
            'data[0][name]': 'timeframe',
            'data[0][value]': 'Minor',
            'data[1][name]': 'minor_timeframe',
            'data[1][value]': this.cookieValue?.version,
            'currentPickNumber': '0',
            'mockdraft': 'false',
        }
        try {
            let formBody = [];
            for (let property in details) {
                const encodedKey = encodeURIComponent(property);
                const encodedValue = encodeURIComponent(details[property]);
                formBody.push(encodedKey + '=' + encodedValue);
            }
            formBody = formBody.join('&');

            const requestOptions = {
                method: 'POST',
                headers:
                {
                    'X-Csrf-Token': this.cookieValue.csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                }
                ,
                body: formBody,
            };

            const fetchedData = await fetch(this.banDataUrl, requestOptions)
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
            return data;
    },

    getCompositionsInfo: async function () {
        if (!this.cookieValue) {
            this.cookieValue = await this.createDrafterSession();
        }

        App.log(`Gathering compositions`);

        const details = {
            'timeframe_type': 'minor',
            'timeframe': [
                this.cookieValue?.version
            ],
            'minimum_games': '100',
            'game_type': [
                'sl'
            ],
        }

        let compositions = null;
        try {
            const request = {
                method: 'POST',
                headers:
                {
                    'X-Csrf-Token': this.cookieValue.csrfToken,
                    'Content-Type': 'application/json'
                }
                ,
                body: JSON.stringify(details),
            };

            const fetchedData = await fetch(this.compositionsUrl, request)
            compositions = await fetchedData.json();

            if (compositions?.length) {
                return compositions.map(comp => {
                    return {
                        games: comp.games_played,
                        winRate: comp.win_rate,
                        roles: [comp.role_one.name, comp.role_two.name, comp.role_three.name, comp.role_four.name, comp.role_five.name]
                    }
                })
            }

        } catch (e) {
            App.log(`Error while gathering profile compositions, with data ${compositions}`, e);
            compositions = null;
        }
    },


    getHeroesInfluenceFromAPI: async function () {
        if (!this.cookieValue) {
            this.cookieValue = await this.createDrafterSession();
        }

        App.log(`Gathering heroes influence`);

        const details = {
            'timeframe_type': 'minor',
            'timeframe': [
                this.cookieValue?.version
            ],
            'statfilter': 'win_rate',
            'game_type': [
                'sl'
            ],
        }

        let heroes = null;
        try {
            const request = {
                method: 'POST',
                headers:
                {
                    'X-Csrf-Token': this.cookieValue.csrfToken,
                    'Content-Type': 'application/json'
                }
                ,
                body: JSON.stringify(details),
            };

            const fetchedData = await fetch(this.influenceUrl, request)        
            heroes = await fetchedData.json();

            if (heroes?.data?.length) {
                return heroes.data.map((hero) => {
                    return {
                        name: hero.name,
                        influence: hero.influence
                    }
                })
            }

        } catch (e) {
            App.log(`Error while gathering ${heroName} profile builds, with data ${heroes}`, e);
            heroes = null;
        }
    },

    getBuildsFromAPI: async function (heroName) {
        if (!this.cookieValue) {
            this.cookieValue = await this.createDrafterSession();
        }

        const details = {
            'hero': heroName,
            'timeframe_type': 'minor',
            'timeframe': [
                this.cookieValue?.version
            ],
            'statfilter': 'win_rate',
            'game_type': [
                'sl'
            ],
            'talentbuildtype': 'Popular'
        }
        let data = null;
        try {
            const request = {
                method: 'POST',
                headers:
                {
                    'X-Csrf-Token': this.cookieValue.csrfToken,
                    'Content-Type': 'application/json'
                }
                ,
                body: JSON.stringify(details),
            };

            const fetchedData = await fetch(this.buildsUrl, request);        
            data = await fetchedData.json();

            return {
                builds: data.map((build) => {
                    const name = `[Popular Build](${this.buildsTitleUrl}${heroName}) (${build.win_rate}% win rate)`;
                    buildString = `[T${build.level_one.sort}${build.level_four.sort}${build.level_seven.sort}${build.level_ten.sort}${build.level_thirteen.sort}${build.level_sixteen.sort}${build.level_twenty.sort},${heroName.replaceAll(' ', '')}]`;
                    return {
                        name,
                        skills: buildString
                    }
                })
            }
        } catch (e) {
            App.log(`Error while gathering ${heroName} profile builds`, e)
            data = null;
        }
    },
}