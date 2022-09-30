const {StringService} = require('../services/string-service');

exports.run = async (roleName) => {
    let role = null;
    if (roleName != null && roleName !== '') {
        role = this.findRoleByName(roleName)
        if (role == null) {
            return StringService.get('role.not.found', roleName);
        }
    }

    const str = role !== null ? StringService.get('on.role', role.name) : ''

    return {
        data: {
            featureName: StringService.get('suggested.heroes', str),
            suggestions: this.findHeroesByScore(parseInt(role?.id)).map(it => {
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
    acceptParams: true,
    requiredParam: false,
    defaultPermission: true,
    category: 'HEROES'
};
