const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { StringUtils } = require('./string-utils');
const { CommandService } = require('../services/command-service');
const EMBBED_ARRAY_LIMIT = 24;

exports.EmbedUtils = {
    defaultAuthorName: 'Heroes of The Storm Bot',
    defaultAuthorUrl: 'https://top.gg/bot/783467749258559509',
    defaultAuthorIcon: 'attachment://hots.png',
    remainingItems: [],

    createSingleEmbed: function (response) {
        const authorName = response.authorName ?? this.defaultAuthorName;
        const authorUrl = response.authorUrl ?? this.defaultAuthorUrl;
        const avatar = response.avatar ?? this.defaultAuthorIcon;
        let thumbnail = null;

        const author = {
            name: authorName,
            url: authorUrl,
            iconURL: avatar
        }

        if (response.thumbnail != null) {
            thumbnail = 'attachment://' + response.thumbnail.replace('images/', '');
        }

        let featureDesc = response.featureDescription ?? '_ _';
        let bottomImage = response.bottomImage?.replace('images/', 'attachment://') ?? 'attachment://footer.png';

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(response.featureName)
            .setDescription(featureDesc)
            .setAuthor(author)
            .setImage(bottomImage)
            .setThumbnail(thumbnail) //image on the right
            .setTimestamp();

        if (response.footer) {
            const footer = {
                text: StringUtils.get('data.from', response.footer.source),
                iconURL: response.footer.sourceImage
            }
            embed.setFooter(footer);
        }

        const data = response.data;
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    const list = this.createPaginationAndReturnList(key, value);
                    embed.addFields(list);
                } else {
                    if (value != null) {
                        embed.setDescription(value ?? featureDesc);
                    }
                }
            });
        }
        return embed;
    },

    addEmbedRecursively: function (response, attachment, embeds) {
        const embed = this.createSingleEmbed(response, attachment);
        embeds.push(embed);

        if (this.remainingItems.length > 0) {
            const responseAux = JSON.parse(JSON.stringify(response));
            responseAux.data = this.remainingItems.shift();
            responseAux.featureDescription = null;
            responseAux.thumbnail = null;
            this.addEmbedRecursively(responseAux, attachment, embeds);
        }
    },

    createEmbeds: function (response, attachment) {
        const embeds = [];
        this.addEmbedRecursively(response, attachment, embeds);
        return embeds;
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

    addToMap: function (fileMap, property) {
        if (property != null) {
            const fileName = property.replace('attachment://', '');
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

    createPaginationAndReturnList: function (attributeName, list) {
        if (list.length > EMBBED_ARRAY_LIMIT) {
            const extraArray = list.splice(0, list.length - EMBBED_ARRAY_LIMIT);
            this.remainingItems.push({ attributeName: extraArray });
        }
        list = this.addItemIntoListIfNeeded(list);
        return list;
    }
}
