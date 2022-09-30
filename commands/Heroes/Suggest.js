const {StringService} = require('../../services/string-service');
const {HeroService} = require("../../services/hero-service");

exports.run = async (roleName) => {
    let role = null;
    if (roleName != null && roleName !== '') {
        role = HeroService.findRoleByName(roleName)
        if (role == null) {
            return StringService.get('role.not.found', roleName);
        }
    }

    const str = role !== null ? StringService.get('on.role', role.name) : ''

    return {
        data: {
            featureName: StringService.get('suggested.heroes', str),
            suggestions: HeroService.findHeroesByScore(parseInt(role?.id)).map(it => {
                return {
                    name: it.name,
                    value: it.score,
                    inline: true
                };
            })
        }
    }
}

exports.help = {
    name: 'Suggest',
    hint: 'Find the top 10 heroes by filters sorted by their influence',
    argumentName: 'Role',
    argumentDescription: 'A role name',
    acceptParams: true,
    requiredParam: false,
    defaultPermission: true,
    category: 'HEROES'
};
