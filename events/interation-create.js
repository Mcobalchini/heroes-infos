/*const { CommandService } = require('../services/command-service.js');
const { EmbedUtils } = require('../utils/embed-utils');
const { logger } = require('../services/log-service.js');

exports.run = async (interaction) => {
    if (interaction.isCommand() || interaction.isAutocomplete()) {
        if (interaction.isCommand()) {
            await interaction.deferReply();
        } else if (interaction.isAutocomplete()) {
            CommandService.handleAutocomplete(interaction);
        } else {
            const reply = await CommandService.handleCommand(interaction);
            const embeds = createResponse(reply);
            const replyObject = EmbedUtils.assembleEmbedObject(embeds);
            replyObject.ephemeral = true;
            interaction.editReply(replyObject).catch(e => {
                logger.error(`error while responding`, e);
            });
        }        
    }
};

exports.name = 'interactionCreate';
*/