const { CommandService } = require('../services/command-service.js');
const { EmbedUtils } = require('../utils/embed-utils');
const { logger } = require('../services/log-service.js');
const { ExternalDataService } = require('../services/external-data-service.js');
const { StringUtils } = require('../utils/string-utils.js');

exports.run = async (app, interaction) => {
    try {        
        if (interaction.isCommand()) {
            await interaction.deferReply();
            const commandReply = await CommandService.handleCommand(interaction);
            const embeds = createResponse(commandReply);
            const response = EmbedUtils.assembleEmbedObject(embeds);
            response.ephemeral = true;
            interaction.editReply(response).catch(e => {
                logger.error(`error while responding`, e);
            });
        } else if (interaction.isAutocomplete()) {
            await CommandService.handleAutocomplete(interaction);
        }    
    } catch (error) {
        logger.error(`error while handling interaction`, error);
    }
};

function createResponse(reply) {
    const embeds = [...EmbedUtils.createEmbeds(reply)];

    if (ExternalDataService.isUpdatingData) {
        let updatingWarningEmbed = EmbedUtils.createSingleEmbed({
            featureName: StringUtils.get('note'),
            featureDescription: StringUtils.get('hold.still.updating.data'),
            thumbnail: 'images/download.png'
        });
        embeds.push(updatingWarningEmbed);
    }
    return embeds;
}
exports.once = false;
exports.name = 'interactionCreate';