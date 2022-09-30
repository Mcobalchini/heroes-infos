const {StringService} = require('../services/string-service');
const {App} = require('../app');
const {Network} = require('../services/network-service');

exports.run = (args) => {
    if (Network.isUpdatingData) {
        return StringService.get('hold.still.updating');
    } else {
        App.setBotStatus('Updating', 'WATCHING');
        Network.updateData(args);
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
    defaultPermission: false,
    category: 'GENERAL'
}
