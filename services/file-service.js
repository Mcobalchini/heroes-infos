const fs = require('fs');

exports.FileService = {
    openFile: function (filePath) {
        return fs.readFileSync(filePath, {encoding: 'utf8', flag: 'r'});
    },

    openJsonSync: function (filePath) {
        return JSON.parse(this.openFile(filePath));
    },

    openDir: function (path) {
        return fs.readdirSync(path);
    },

    writeFile: function (path, content, cb) {
        return fs.writeFile(path, content, cb);
    }
};
