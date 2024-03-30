const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { StringService } = require("./string-service");
const EMBBED_ARRAY_LIMIT = 25;

exports.EmbedService = {
    authorName: 'Heroes of The Storm Bot',
    authorUrl:  'https://top.gg/bot/783467749258559509',
    authorIcon: 'attachment://hots.png',
    extraEmbeds: [],

    addItemIntoListIfNeeded: function (array) {
        if (array.length % 3 !== 0 && array.every(it => it.inline)) {
            array.push(
                {
                    name: `_ _`,
                    value: `|| ||`,
                    inline: true
                }
            )
        }
        return array;
    },

    createEmbed: function (replyObject, authorName, authorUrl, authorIcon, thumbnail) {
        authorName = authorName ? authorName : this.authorName;
        authorUrl = authorUrl ? authorUrl : this.authorUrl;    
        authorIcon = authorIcon ? authorIcon : this.authorIcon;

        const author = {
            name: authorName,
            url: authorUrl,
            iconURL: authorIcon
        }

        let featureDesc = replyObject.featureDescription ? replyObject.featureDescription : '_ _';
        let image = replyObject.image ? replyObject.image.replace('images/', 'attachment://') : 'attachment://footer.png';

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(replyObject.featureName)
            .setAuthor(author)
            .setImage(image)
            .setThumbnail(thumbnail)
            .setTimestamp();

        const attribute = Object.keys(replyObject).find(it => this.isNotReservedKey(it));

        if (Array.isArray(replyObject[attribute])) {
            let array = this.addItemIntoListIfNeeded(replyObject[attribute]);

            if (array.length > EMBBED_ARRAY_LIMIT) {
                const extraArray = array.splice(0, array.length - EMBBED_ARRAY_LIMIT);
                const extraReplyObject = {...replyObject}
                extraReplyObject.featureDescription = null;                
                extraReplyObject[attribute] = extraArray;                
                this.extraEmbeds.push(this.createEmbed(extraReplyObject, authorName,  '', ''));
           }

            embed.addFields(array);
            embed.setDescription(featureDesc);
        } else {
            let desc = replyObject[attribute];
            embed.setDescription(desc ? desc : featureDesc);
        }

        return embed;
    },

    isObject: function (object, key) {
        return object[key].toString() === '[object Object]'
            && !Array.isArray(object[key]) && key !== 'footer';
    },

    createEmbeds: function (replyObject, authorName, authorUrl, authorIcon) {
        let embeds = [];
        Object.keys(replyObject).forEach(function (key, _) {
            const attribute = replyObject[key];            
            if (this.isObject(replyObject, key)) {
                embeds.push(this.createEmbed(attribute, authorName, authorUrl, authorIcon));
            } else if (this.isNotReservedKey(key)) {
                embeds.push(this.createEmbed(replyObject, authorName, authorUrl, authorIcon));
            }
        }, this);

        if (this.extraEmbeds.length > 0) {
            embeds = embeds.concat(this.extraEmbeds);
            this.extraEmbeds = [];
        }

        return embeds;
    },

    isNotReservedKey: function (key) {
        return key !== 'featureName' && key !== 'featureDescription' && key !== 'footer' && key !== 'image';
    },

    fillAttachments: function (embeds) {
        const files = new Map();
        files.set('footer.png', new AttachmentBuilder('images/footer.png', 'attachment://footer.png'));
        embeds.forEach(it => {
            this.addToMap(files, it.data.image?.url);
            this.addToMap(files, it.data.thumbnail?.url);
            this.addToMap(files, it.data.author?.iconURL);
        }, this);
        return Array.from(files.values());
    },

    removeAttachmentPrefix: function (text) {
        return text.replace('attachment://', '');
    },

    addToMap: function (fileMap, property) {
        if (property != null) {
            const fileName = this.removeAttachmentPrefix(property);
            if (!fileName.includes('http') && fileName.length > 0 && !fileMap.has(fileName))
                fileMap.set(fileName, new AttachmentBuilder(`images/${fileName}`, fileName));
        }
    },

    assembleEmbedObject: function (embeds) {
        if (!Array.isArray(embeds)) {
            embeds = [embeds];
        }
        return {
            embeds,
            files: this.fillAttachments(embeds)
        };
    },

    fillFooter: function (attachment, embeds, footerObj) {
        embeds.forEach(it => {
            if (footerObj) {
                const footer = {
                    text: StringService.get('data.from', footerObj.source),
                    iconURL: footerObj.sourceImage
                }
                it.setFooter(footer)
            }
        });
    }
}
