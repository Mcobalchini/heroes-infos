const { FileUtils } = require('../utils/file-utils.js');
const maps = FileUtils.openJsonSync('./data/constant/maps.json');

exports.MapRepository = {

    findMapByName: function (mapName) {
        let mapLowerCase = mapName.unaccentClean();
        return maps.find(map =>
            mapLowerCase.length > 2 &&
            map.name.unaccentClean() === mapLowerCase || map.name.unaccentClean().includes(mapLowerCase));
    },
};