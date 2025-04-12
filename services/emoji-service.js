const { ExternalDataService } = require('./external-data-service.js');
const { logger } = require('./log-service.js');
const { EmojiRepository } = require('../repositories/emoji-repository.js');

exports.EmojiService = {
    updateEmojisIfNeeded: async function () {
        ExternalDataService.getEmojisFromApi().then(emojis => {
            if (emojis) {
                EmojiRepository.setEmojis(emojis?.items);                
                logger.info(`emojis updated`);
            } else {
                logger.info(`no emojis to update`);
            }
        }).catch(err => {
            logger.error(`Error updating emojis: ${err}`);
        });
    },
};
