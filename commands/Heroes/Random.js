const { HeroRepository } = require('../../repositories/hero-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async () => {
    const heroes = HeroRepository.listHeroesBase();
    let randomIndex = Math.floor((Math.random() * heroes.length));
    const heroFromIndex = heroes[randomIndex];    
    return {
        ...HeroService.assembleBaseObject(heroFromIndex),
        data: {         
            overview: [
                {
                    name: StringUtils.get('role'),
                    value: HeroService.getHeroRole(heroFromIndex),
                    inline: false
                },
                {
                    name: StringUtils.get('universe'),
                    value: heroFromIndex.universe.capitalize(),
                    inline: true
                }
            ]
        }
    }
}

exports.help = {
    name: 'Random',
    displayName: StringUtils.get('suggested.hero'),
    hint: 'Suggest a random hero for you to play',
    acceptParams: false,
    defaultPermission: true,
    category: 'HEROES',
};
