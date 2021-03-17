
require('../utils/utils.ts')
class MapClass {
  maps = [
      {
        "id": 1,
        "name": "Alterac Pass",
        "localizedName": "Garganta de Alterac"
      },
      {
        "id": 2,
        "name": "Garden of Terror",
        "localizedName": "Jardim do Terror"
      },
      {
        "id": 3,
        "name": "Hanamura Temple",
        "localizedName": "Templo de Hanamura"
      },
      {
        "id": 4,
        "name": "Volskaya Foundry",
        "localizedName": "Fundição Volskaya"
      },
      {
        "id": 5,
        "name": "Haunted Mines",
        "localizedName": "Mina Assombrada"
      },
      {
        "id": 6,
        "name": "Towers of Doom",
        "localizedName": "Torres da Perdição"
      },
      {
        "id": 7,
        "name": "Infernal Shrines",
        "localizedName": "Santuários Infernais"
      },
      {
        "id": 8,
        "name": "Battlefield of Eternity",
        "localizedName": "Campo de Batalha da Eternidade"
      },
      {
        "id": 9,
        "name": "Tomb of The Spider Queen",
        "localizedName": "Tuma da Aranha Rainha"
      },
      {
        "id": 10,
        "name": "Sky Temple",
        "localizedName": "Templo Celeste"
      },
      {
        "id": 11,
        "name": "Blackheart's Bay",
        "localizedName": "Baía do Coração Negro"
      },
      {
        "id": 12,
        "name": "Dragon Shire",
        "localizedName": "Condado do Dragão"
      },
      {
        "id": 13,
        "name": "Cursed Hollow",
        "localizedName": "Clareira Maldita"
      },
      {
        "id": 14,
        "name": "Braxis Holdout",
        "localizedName": "Resistência de Braxis"
      },
      {
        "id": 15,
        "name": "Warhead Junction",
        "localizedName": "Junção da Ogiva"
      }
    ];

  /*function getMapInfos(mapName) {
    if (mapName != null && mapName.trim().length > 0) {
      let map = findMap(mapName);
      let bestHeroes = [];
      if (map != null) {
        for (i in heroesInfos) {
          for (j in heroesInfos[i].strongerMaps) {
            if (heroesInfos[i].strongerMaps[j] === `${map.name} (${map.localizedName})`) {
              bestHeroes.push(heroesInfos[i].name)
            }
          }
        }
        assembleReturnMessage('map', bestHeroes);
      } else {
        msg.reply(`The specified map was not found\nType "${config.prefix}help map" to get a list with the available maps`);
      }
    } else {
      assembleReturnMessage('map', maps.map(it => it.name + ' ( ' + it.localizedName + ' )'))
    }
  }*/

  findMap(mapName) {
    let mapLowerCase = mapName.cleanVal();
    return this.maps.find(map =>
    (map.name.cleanVal() === mapLowerCase ||
      map.localizedName.cleanVal() === mapLowerCase));
  }
}

module.exports = MapClass;

exports.findMap = (name)=> {
    this.findMap(name)
}

exports.maps = this.maps;