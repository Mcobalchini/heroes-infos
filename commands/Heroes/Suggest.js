const { RoleRepository } = require('../../repositories/role-repository');
const { HeroService } = require('../../services/hero-service');
const { StringUtils } = require('../../utils/string-utils');
//TODO fix me
exports.run = async (roleName) => {
    let role = null;
    if (roleName != null && roleName !== '') {
        role = RoleRepository.findRoleByName(roleName)
        if (role == null) {
            return StringUtils.get('role.not.found', roleName);
        }
    }

    const str = role !== null ? StringUtils.get('on.role', role.name) : '';

    return {
        featureName: StringUtils.get('suggested.heroes', str),
        data: {            
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
    paramOptions: RoleRepository.getRoles()?.map(it => {
        return {
            name: it.name.toLowerCase(),
            description: it.name
        }
    }),
    requiredParam: false,
    defaultPermission: true,
    category: 'HEROES'
};
