const { StringService } = require('../../services/string-service');
const { HeroService } = require("../../services/hero-service");

exports.run = async (roleName) => {
    let role = null;
    if (roleName != null && roleName !== '') {
        role = HeroService.findRoleByName(roleName)
        if (role == null) {
            return StringService.get('role.not.found', roleName);
        }
    }

    const str = role !== null ? StringService.get('on.role', role.name) : '';

    return {
        data: {
            featureName: StringService.get('suggested.heroes', str),
            suggestions: HeroService.listHeroesSortedByScore(parseInt(role?.id)).map(it => {
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
    hint: 'Display the top 10 heroes sorted by their influence, based on the specified filters',
    argumentName: 'Role',
    argumentDescription: 'A role name',
    acceptParams: true,
    paramOptions: HeroService.getRoles()?.map(it => {
        return {
            name: it.name.toLowerCase(),
            description: it.name
        }
    }),
    requiredParam: false,
    defaultPermission: true,
    category: 'HEROES'
};
