const { FileUtils } = require('../utils/file-utils.js');
const roles = FileUtils.openJsonSync('./data/constant/roles.json');

exports.RoleRepository = {
    
    getRoles: function () {
        return roles;
    },

    findRoleById: function (roleId) {
        return roles.find(role => (role.id === roleId));    
    },

    findRoleByName: function (roleName) {
        return roles.find(role => role.name.cleanVal() === roleName.cleanVal());    
    }
}