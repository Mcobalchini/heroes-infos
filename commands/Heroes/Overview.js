const { HeroRepository } = require('../../repositories/hero-repository');
const { SourceRepository } = require('../../repositories/source-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');

exports.run = async (heroName) => {
    const hero = HeroRepository.findHeroOrThrow(heroName, true);
    let overviewText = StringUtils.get('quick.overview.about.hero');
    psionicStorm = SourceRepository.findSourceById('PSIONIC_STORM');
    if (hero.infos.overviewText) {
        icyVeins = SourceRepository.findSourceById('ICY_VEINS');
        overviewText = StringUtils.get('via.source', `${icyVeins.name} ${icyVeins.icon}`, hero.infos.overviewText);
    }
    return {
        ...HeroService.assembleBaseObject(hero),
        featureDescription: overviewText,
        data: {
            overview: [
                {
                    name: StringUtils.get('role'),
                    value: HeroService.getHeroRole(hero),
                    inline: true
                },
                {
                    name: StringUtils.get('universe'),
                    value: hero.universe.capitalize(),
                    inline: true
                },
                {
                    name: StringUtils.get('score'),
                    value: hero.infos.tierPosition.toString(),
                    inline: true
                },
                {
                    name: `_ _`,
                    value: '_ _',
                    inline: false
                },
                {
                    name: `${StringUtils.getWithoutNewLine('hero.basic.stats')}, ${StringUtils.get('via.source', `${psionicStorm.name} ${psionicStorm.icon}`, '')}`,
                    value: '_ _',
                    inline: false
                },
                {
                    name: StringUtils.get('health.points'),
                    value: `${hero.infos.hpBase.toString()} (+${(hero.infos.hpScaling * 100).toString()}%/lvl)`,
                    inline: true
                },
                {
                    name: StringUtils.get('mana.points'),
                    value: `${hero.infos.manaBase.toString()} (+10%/lvl)`,
                    inline: true
                },
                {
                    name: StringUtils.get('damage.per.attack'),
                    value: `${hero.infos.aaDmgBase.toString()} (+${(hero.infos.aaDmgScaling * 100).toString()}%/lvl)`,
                    inline: true
                },
                {
                    name: StringUtils.get('dps'),
                    value: ` ${hero.infos.aaDmgBase * Math.pow(1 + hero.infos.aaDmgScaling, 0) * hero.infos.aaSpeed}`,
                    inline: true
                },
                {
                    name: StringUtils.get('attack.speed'),
                    value: `${hero.infos.aaSpeed.toString()}/second`,
                    inline: true
                },
                {
                    name: StringUtils.get('attack.range'),
                    value: `${hero.infos.aaRange.toString()}`,
                    inline: true
                },                
            ]
        }
    }
}

exports.autoComplete = (heroName) => {
    const heroes = HeroService.autoCompleteHeroes(heroName);
    return heroes.map(hero => (
        {
            name: hero.name,
            value: hero.name
        }
    ));
}

exports.help = {
    name: 'Overview',
    displayName: StringUtils.get('overview'),
    hint: 'Display a simple overview for the specified hero!',
    argumentName: 'Hero',
    argumentDescription: 'Enter the hero\'s full name or a partial match of its name.',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};
