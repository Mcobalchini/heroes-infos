const fs = require('fs');

exports.FileUtils = {
    openFile: function (filePath) {
        return fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    },

    openJsonSync: function (filePath) {
        return JSON.parse(this.openFile(filePath));
    },

    openDir: function (path) {
        return fs.readdirSync(path);
    },

    writeFile: function (path, content, cb) {
        return fs.writeFile(path, content, cb);
    },

    writeJsonFile: function (path, content) {
        return this.writeFile(path, JSON.stringify(content), (e) => {
            if (e != null) {
                throw e;
            }
        });
    }
};
