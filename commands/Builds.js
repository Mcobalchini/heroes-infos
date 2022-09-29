const {StringService} = require('../services/string-service');

exports.run = async (hero) => {
    return {
        featureName: StringService.get('builds'),
        builds: hero.infos.builds.map(build => {
            return {
                name: build.skills,
                value: build.name,
                inline: false
            }
        })
    };
}

exports.help = {
    name: 'Builds',
    hint: 'Display the known builds for the specified hero!',
    acceptParams: true,
    requiredParam: true,
    defaultPermission: true,
    category: 'HEROES'
};
