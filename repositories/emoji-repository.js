const { FileUtils } = require('../utils/file-utils.js');
const { logger } = require('../services/log-service.js');
let emojis = [];

try {
    emojis = FileUtils.openJsonSync(`./data/variable/${process.env.CLIENT_ID}/emojis.json`);    
} catch (e) {
    logger.warn('error while reading emojis json data', e);
}

exports.EmojiRepository = {
    emojis,
    
    getEmojiByName: function (name) {
        const emoji = this.emojis.find(emoji => emoji.name === name.unaccentClean());
        return `<:${emoji.name}:${emoji.id}>`;
    },

    setEmojis: function (emojis) {
        this.emojis = emojis;
        FileUtils.writeJsonFile(`./data/variable/${process.env.CLIENT_ID}/emojis.json`, emojis);
    },

    getEmojis: function () {
        try {
            return FileUtils.openJsonSync(`./data/variable/${process.env.CLIENT_ID}/emojis.json`);
        } catch (e) {
            console.error(`Error loading emojis: ${e}`);
            return [];
        }
    },
}