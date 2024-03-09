const { JSDOM } = require('jsdom');

exports.HeroesProfileIntegration = {
    buildsUrl: 'https://www.heroesprofile.com/api/v1/global/talents/build',
    cookieValue: '',

    createDrafterSession: async function (remainingTries) {        
        remainingTries = remainingTries ?? 3;        
        const page = await this.createPage();
        const url = 'https://drafter.heroesprofile.com/Drafter';
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded' });        
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

    gatherBanTierListInfo: async function () {
        if (!this.cookieValue) {
            this.cookieValue = await HeroesProfileIntegration.createDrafterSession();
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

            const fetchedData = await fetch('https://drafter.heroesprofile.com/getDraftBanData', requestOptions)
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

    //FIXME
    gatherCompositionsInfo: async function () {
        App.log(`Gathering compositions`);

        const fun = () => {
            return Array.from(document.querySelectorAll('#table-container tbody tr:not(.data-row)')).map(it => {
                return {
                    games: it.children[3]?.innerText,
                    winRate: parseFloat(it.children[1]?.innerText?.replace(',', '.')),
                    roles: Array.from(it.children[0].children[0].children)?.map(div => div.innerText)
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
        if (!this.cookieValue) {
            this.cookieValue = await HeroesProfileIntegration.createDrafterSession();
        }

        App.log(`Gathering influence`);
        
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
       
        let data = null;
        try {    
            const requestOptions = {
                method: 'POST',
                headers:
                {                    
                    'X-Csrf-Token': this.cookieValue.csrfToken,
                    'Content-Type': 'application/json'
                }
                ,
                body: JSON.stringify(details),
            };

            const fetchedData = await fetch('https://www.heroesprofile.com/api/v1/global/hero', requestOptions)
            heroes = await fetchedData.json();  

            if (heroes?.data?.length) {
                this.popularityWinRate = heroes.data.map((hero) => {
                    return {
                        name: hero.name,
                        influence: hero.influence
                    }
                })
            }

        } catch (e) {
            App.log(`Error while gathering ${heroName} profile builds, with data ${data}`, e)
            data = null;
        }
    },

    gatherProfileBuildsFromAPI: async function (heroName) {
        if (!this.cookieValue) {
            this.cookieValue = await HeroesProfileIntegration.createDrafterSession();
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
            const requestOptions = {
                method: 'POST',
                headers:
                {                    
                    'X-Csrf-Token': this.cookieValue.csrfToken,
                    'Content-Type': 'application/json'
                }
                ,
                body: JSON.stringify(details),
            };

            const fetchedData = await fetch(this.buildsUrl, requestOptions)
            data = await fetchedData.json();  

            return {
                builds: data.map((build) => {                     
                    const name = `[Popular Build](https://www.heroesprofile.com/Global/Talents/${heroName}) (${build.win_rate}% win rate)`;
                    buildString = `[T${build.level_one.sort}${build.level_four.sort}${build.level_seven.sort}${build.level_ten.sort}${build.level_thirteen.sort}${build.level_sixteen.sort}${build.level_twenty.sort},${heroName.replaceAll(' ','')}]`;
                    return {
                        name,
                        skills: buildString
                    }
                })
            }
        } catch (e) {
            App.log(`Error while gathering ${heroName} profile builds, with data ${data}`, e)
            data = null;
        }
    },
}