const { FileUtils } = require('../utils/file-utils.js');
const roles = FileUtils.openJsonSync('./data/constant/roles.json');

exports.RoleRepository = {
    
    getRoles: function () {
        return roles;
    },

    findRoleById: function (roleId) {
        let role = roles.find(role => (role.id.toString().cleanVal() === roleId.toString().cleanVal()));
        if (role) {
            return role;
        }
    },

    findRoleByName: function (roleName) {
        let role = roles.find(role => role.name.cleanVal() === roleName.cleanVal());
        if (role) {
            return role;
        }
    }
}