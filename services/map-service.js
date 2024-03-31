const { FileUtils } = require('../utils/file-utils');
const maps = FileUtils.openJsonSync('./data/constant/maps.json');

exports.MapService = {

    findMap: function (mapName) {
        let mapLowerCase = mapName.unaccentClean();
        return maps.find(map =>
            mapLowerCase.length > 2 &&
            map.name.unaccentClean() === mapLowerCase || map.name.unaccentClean().includes(mapLowerCase));
    },
};
