const puppeteer = require('puppeteer');
const { LogService } = require('./log-service.js');
const { FileUtils } = require('../utils/file-utils.js');

exports.PuppeteerService = {
    browser: null,
    hosts: null,
    popularityWinRate: null,

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
            LogService.log(`Error while fetching ${options.url}`, ex);
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
                LogService.log(`No more tries remaining for ${options.url}`);
                return null;
            }
        }
    },

    setBrowser: async function () {
        this.closeBrowser();
        this.browser = await this.createBrowser();
    },

    closeBrowser: function () {
        this.browser?.close()?.catch();        
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
        if (this.hosts == null) {
            const hostFile = FileUtils.openFile('./data/constant/blocked-hosts.txt').split('\n');
            this.hosts = hostFile.map(it => {
                const frag = it.split(' ');
                if (frag.length > 1 && frag[0] === '0.0.0.0') {
                    return frag[1];
                }
            }).filter(it => it);
        }
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
            //console.log('>>', request.method(), request.url(), request.resourceType());
        });
        ////////         page.on('response', response => console.log('<<', response.status(), response.url()))

        return page;
    },
}
