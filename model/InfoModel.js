class InfoModel {
    constructor(hero: HeroModel,
                builds: Array<BuildModel>,
                synergies: Array<HeroModel>,
                counters: Array<HeroModel>,
                strongerMaps: Array<MapModel>,
                tips: String,
                winRate: Number,
                games: Number) {

        this.hero = hero
        this.builds = builds
        this.synergies = synergies
        this.counters = counters
        this.strongerMaps = strongerMaps
        this.tips = tips
        this.winRate = winRate
        this.games = games
    }
}