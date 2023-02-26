const {FileService} = require('./file-service');
const strings = FileService.openJsonSync('./data/constant/strings.json');

exports.StringService = {
    EN_US: 'en-US',

    accentsMap: new Map([
        ['A', 'Á|À|Ã|Â|Ä'],
        ['a', 'á|à|ã|â|ä'],
        ['C', 'Ç'],
        ['c', 'ç'],
        ['D', 'Đ'],
        ['d', 'đ'],
        ['E', 'É|È|Ẽ|Ẻ|Ẹ|Ê|Ë'],
        ['e', 'é|è|ẽ|ẻ|ẹ|ê|ë'],
        ['I', 'Í|Ì|Ĩ|Ị|Ỉ|Î|Ï'],
        ['i', 'í|ì|ĩ|ị|ỉ|î|ï'],
        ['N', 'Ñ'],
        ['n', 'ñ'],
        ['O', 'Ó|Ò|Õ|Ô|Ö'],
        ['o', 'ó|ò|õ|ô|ö'],
        ['U', 'Ú|Ù|Ũ|Ụ|Ủ|Ũ|Ü'],
        ['u', 'ú|ù|ũ|ụ|ủ|ũ|ü'],
        ['Y', 'Ý|Ỳ|Ỷ|Ỹ|Ỵ'],
        ['y', 'ý|ỳ|ỷ|ỹ|ỵ']
    ]),

    get: function (property) {
        let args = Array.prototype.slice.call(arguments, 1);

        if (property != null) {
            let string = property
            try {
                string = Object.values(strings.find(it => Object.keys(it) == property))[0];
                args.forEach((it, idx) => {
                    string = string.replace(`\{${idx}\}`, args[idx])
                });
            } catch (e) {
            }
            return string + '\n';
        } else {
            return '';
        }
    },

    getWithoutNewLine(property) {
        return this.get(property).replace('\n', '');
    },

    setup: function () {
        this.setupCleanVal();
        this.setupUnaccent();
        this.setupUnaccentClean();
    },

    setupCleanVal: function () {
        if (!String().cleanVal) {
            Object.defineProperty(String.prototype, 'cleanVal', {
                value: function cleanVal() {
                    return this.split('\'').join('').split('.').join('').toLowerCase().split('-').join(' ');
                },
                writable: true,
                configurable: true
            });
        }
    },

    setupUnaccent: function () {
        const that = this;
        if (!String().unaccent) {
            Object.defineProperty(String.prototype, 'unaccent', {
                value: function unaccent() {
                    const reducer = (acc, [key]) =>
                        acc.replace(new RegExp(that.accentsMap.get(key), 'g'), key);
                    return [...that.accentsMap].reduce(reducer, this);
                },
                writable: true,
                configurable: true
            });
        }
    },

    setupUnaccentClean: function () {
        if (!String().unaccentClean) {
            Object.defineProperty(String.prototype, 'unaccentClean', {
                value: function unaccentClean() {
                    return this.unaccent().cleanVal();
                },
                writable: true,
                configurable: true
            });
        }
    }
};
