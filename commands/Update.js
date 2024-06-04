const { ExternalDataService } = require('../services/external-data-service');
const { App } = require('../app');
const { StringUtils } = require('../utils/string-utils');

exports.run = (args) => {
    if (ExternalDataService.isUpdatingData) {
        return StringUtils.get('hold.still.updating');
    } else {
        App.setBotStatus('Updating', 'WATCHING');
        ExternalDataService.updateData(args);
        return StringUtils.get('update.process.started');
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
        },
        {
            name: 'heroes',
            description: 'updates.heroes'
        }
    ],
    argumentDescription: 'What to update',
    defaultPermission: false,
    category: 'GENERAL'
}

// exports.help = {
//     name: 'Update',
//     hint: 'Update all bot database',
//     requiredParam: false,
//     subCommands: [
//          {
//             name: 'general',
//             description: 'updates.heroes',
//             requiredParam: true,
//             paramOptions: [
//                 {
//                     name: 'rotation',
//                     description: 'updates.rotation'
//                 },
//                 {
//                     name: 'everything',
//                     description: 'updates.everything'
//                 },
//                 {
//                     name: 'heroes',
//                     description: 'updates.heroes'
//                 }
//             ],
//         },
//         {
//             name: 'specific',
//             description: 'updates.heroes',
//             argumentName: 'heroes',
//             argumentDescription: 'heroes names splitted by comma',
//             requiredParam: true,
//         }
//     ],
//     argumentDescription: 'What to update',
//     defaultPermission: false,
//     category: 'GENERAL'
// }
