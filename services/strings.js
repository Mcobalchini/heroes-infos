const fs = require('fs');
const strings = JSON.parse(fs.readFileSync('./data/constant/strings.json'), { encoding: 'utf8', flag: 'r' });

exports.StringUtils = {
	EN_US: 'en-us',
	PT_BR: 'pt-br',
	language: this.EN_US,

	get: function (property) {
        let args = Array.prototype.slice.call(arguments, 1);
        
		if (property != null) {
			let string = property
			try {
				string = Object.values(strings[this.language].find(it => Object.keys(it) == property))[0];
				args.forEach((it, idx) => {					
					string = string.replace(`\{${idx}\}`, args[idx])
				});
			} catch (e) {}
            return string + '\n';
		} else {
			return ''
		}
	},

	setLanguage: function (language) {
		this.language = language;
	},

	getLanguage: function () {
		return this.language;
	},

	isEn: function () {
		return this.language === this.EN_US;
	},

	defineCleanVal: function () {
		if(!String().cleanVal) {
			Object.defineProperty(String.prototype, 'cleanVal', {
				value: function cleanVal() {
					return this.split('\'').join('').split('.').join('').toLowerCase().split('-').join(' ');
				},
				writable: true,
				configurable: true
			});
		}
	}
};