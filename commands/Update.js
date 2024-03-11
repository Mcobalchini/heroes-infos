const { StringService } = require('../services/string-service');
const { App } = require('../app');
const { ExternalDataService } = require('../services/external-data-service');

exports.run = (args) => {
    if (ExternalDataService.isUpdatingData) {
        return StringService.get('hold.still.updating');
    } else {
        App.setBotStatus('Updating', 'WATCHING');
        ExternalDataService.updateData(args);
        return StringService.get('update.process.started');
    }
}

exports.help = {
    name: 'Update',
    hint: 'Update all bot database',
    acceptParams: true,
    requiredParam: false,
    paramOptions: [
        {
            name: 'rotation',
            description: 'updates.rotation'
        },
        {
            name: 'everything',
            description: 'updates.everything'
        }
    ],
    argumentDescription: 'What to update',
    defaultPermission: false,
    category: 'GENERAL'
}
