const { logger } = require("../log-service");

exports.PsionicStormIntegrationService = {
    baseUrl: `https://psionic-storm.com/pt/wp-json/psionic/v0/`,    

    getHeroBasicInfo: async function (heroName, skip = false) {
        const psionicUrl = this.getUrl(`units/${heroName.toLowerCase()}`);
        try {                   
            const response = await fetch(psionicUrl);
            let result = null;
            if (!response.ok) {                
                logger.error(`error while gathering psionic data`, response.statusText);
                heroName = heroName.replaceAll('-', '');
                return await getHeroBasicInfo(heroName, true);
            } else {
                result = await response.json();
                if (result) {                   
                    base = result.live;
                    return {
                        hp_base: base.hp_base,                
                        hp_scaling: base.hp_scaling,
                        hp_regen_base: base.hp_regen_base,
                        mana_base: base.mana_base,                
                        mana_regen_base: base.mana_base,
                        aa_dmg_base: base.aa_dmg_base,
                        aa_dmg_scaling: base.aa_dmg_scaling,                    
                        aa_speed: base.aa_speed,
                        aa_range: base.aa_range,
                    };
                }
            }            
        } catch (ex) {
            if (skip) {
                return null;
            }
            logger.error(`error while fetching psionic data ${psionicUrl}`, ex);
            heroName = heroName.replaceAll('-', '');
            return await this.getHeroBasicInfo(heroName, true);        
        }
    },

    getHeroesBanRates: async function (heroName, skip = false) {
        const psionicUrl = this.getUrl(``);
        try {                   
            const response = await fetch(`${this.baseUrl}wp-json/psionic/v0/stats/?post_id=None&source=HP&mode=SL`);
            let result = null;
            if (!response.ok) {                
                logger.error(`error while psionic ban data`, response.statusText);                
                return [];
            } else {
                result = await response.json();
                if (result) {                   
                    return result.dataStats.map((stat) => {
                        return {
                            heroName: stat.slug,                        
                            banrate: stat.banrate,                            
                        };
                    });                    
                }
            }            
        } catch (ex) {
            logger.error(`error while fetching psionic data ${psionicUrl}`, ex);
            return [];
        }
    },
    
    getUrl: function (heroName) {
        return this.baseUrl.replace('{0}', heroName);
    }
}