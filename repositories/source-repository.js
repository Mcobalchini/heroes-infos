const { FileUtils } = require('../utils/file-utils.js');
const { EmojiRepository } = require('./emoji-repository.js');
const sources = FileUtils.openJsonSync('./data/constant/sources.json');

exports.SourceRepository = {

    findSourceById: function (id) {
        const source = sources.find(source => (source.id === id));
        try {
            if (source.mustSearchIcon || source.mustSearchIcon === undefined) {
                source.icon = EmojiRepository.getEmojiByName(source.name.unaccentClean());
                source.mustSearchIcon = false
            }            
        } catch (e) {            
            source.icon = '';
            source.mustSearchIcon = true;
        }        
        return source;
    },

    getSourceIcon: function (name) {
        const emoji = EmojiRepository.getEmojiByName(name.unaccentClean());
        return `<:${emoji.name}:${emoji.id}>`;
    },

    listSources() {
        return sources;
    }
}