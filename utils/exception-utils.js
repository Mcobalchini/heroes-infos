class HeroNotFoundException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.HeroNotFoundException = HeroNotFoundException;