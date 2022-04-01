const fs = require('fs');
const strings = JSON.parse(fs.readFileSync('./data/constant/strings.json'), { encoding: 'utf8', flag: 'r' });

exports.StringUtils = {
	EN_US: 'en-us',
	PT_BR: 'pt-br',
	language: this.EN_US,

	accentsMap: new Map([
		["A", "Á|À|Ã|Â|Ä"],
		["a", "á|à|ã|â|ä"],
		["E", "É|È|Ê|Ë"],
		["e", "é|è|ê|ë"],
		["I", "Í|Ì|Î|Ï"],
		["i", "í|ì|î|ï"],
		["O", "Ó|Ò|Ô|Õ|Ö"],
		["o", "ó|ò|ô|õ|ö"],
		["U", "Ú|Ù|Û|Ü"],
		["u", "ú|ù|û|ü"],
		["C", "Ç"],
		["c", "ç"],
		["N", "Ñ"],
		["n", "ñ"]
	]),

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

	getWithoutNewLine(property) {
		return this.get(property).replace("\n", "")
	},

	setLanguage: function (language) {
		this.language = language;
	},

	isEn: function () {
		return this.language === this.EN_US;
	},

	setup: function (){
		this.setupCleanVal();
		this.setupUnaccent();
		this.setupUnaccentClean();
	},

	setupCleanVal: function () {
		if(!String().cleanVal) {
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
		if(!String().unaccent) {
			Object.defineProperty(String.prototype, 'unaccent', {
				value: function unaccent() {
					const reducer = (acc, [key]) =>
						acc.replace(new RegExp(that.accentsMap.get(key), "g"), key);
					return [...that.accentsMap].reduce(reducer, this);
				},
				writable: true,
				configurable: true
			});
		}
	},

	setupUnaccentClean: function () {
		if(!String().unaccentClean) {
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