import type {City} from '../sim/model.js';
import type {Report} from '../sim/engine.js';

export interface MissionView {
  title:string; description:string; hint:string; progress:string; complete:boolean; reward:number;
  suggested:'road'|'home'|'shop'|'power'|'water'|'school'|'clinic'|'inspect';
}
export const CHAPTER_TITLE='第一章 · 山河小镇的第一批居民';
export const MISSION_TITLES=['连接世界','有人住，也有工作','让生活运转','让孩子和居民安心','让小镇站稳脚跟'];
const count=(c:City,k:string)=>Object.values(c.buildings).filter(b=>b.kind===k).length;
export function missionView(c:City,r:Report):MissionView {
  const homes=count(c,'home'), jobs=count(c,'shop')+count(c,'farm');
  const base={complete:false,reward:0};
  switch(c.mission??0){
    case 0: {
      const roads=Object.values(c.buildings).filter(b=>['road','bridge','tunnel'].includes(b.kind)).length;
      return {...base,title:MISSION_TITLES[0],description:'从市中心修出一条不少于 4 格的连通道路。',hint:'选择「道路」，从中央有白色标记的路口开始铺设。按住拖动可以连续铺路。',progress:`${Math.min(roads,4)} / 4 格道路`,complete:roads>=4,reward:120,suggested:'road'};
    }
    case 1:return {...base,title:MISSION_TITLES[1],description:'建造至少 2 栋住宅和 1 处工作场所。',hint:'住宅提供人口容量；商店或农场提供岗位。都需要靠近连通道路。',progress:`住宅 ${homes}/2 · 工作场所 ${jobs}/1`,complete:homes>=2&&jobs>=1,reward:200,suggested:homes<2?'home':'shop'};
    case 2:{
      const hasPower=count(c,'power')>0,hasWater=count(c,'water')>0;
      return {...base,title:MISSION_TITLES[2],description:'建水电设施，吸引至少 8 位居民搬入。',hint:'建成后点击「过一天」观察人口迁入。水电供应要足以覆盖需求。',progress:`供电 ${hasPower?'✓':'×'} · 供水 ${hasWater?'✓':'×'} · 居民 ${Math.min(c.population,8)}/8`,complete:hasPower&&hasWater&&c.population>=8&&r.power.supply>=r.power.demand&&r.water.supply>=r.water.demand,reward:240,suggested:!hasPower?'power':!hasWater?'water':'inspect'};
    }
    case 3:{
      const school=count(c,'school')>0,clinic=count(c,'clinic')>0;
      return {...base,title:MISSION_TITLES[3],description:'建立学校与诊所，让教育、医疗满足率都达到 70%。',hint:'设施需要靠近道路和住宅；公共设施会持续产生日常开支。',progress:`教育 ${Math.round(r.education.ratio*100)}% · 医疗 ${Math.round(r.health.ratio*100)}%`,complete:school&&clinic&&r.education.ratio>=.7&&r.health.ratio>=.7,reward:260,suggested:!school?'school':!clinic?'clinic':'inspect'};
    }
    case 4:return {...base,title:MISSION_TITLES[4],description:'人口达到 20，并连续 2 天保持财政不亏损。',hint:'适量增加住宅与岗位、控制公共设施数量。财政面板能解释每天的收入与成本。',progress:`人口 ${Math.min(c.population,20)}/20 · 盈利天数 ${Math.min(c.stableDays??0,2)}/2`,complete:c.population>=20&&(c.stableDays??0)>=2,reward:480,suggested:'inspect'};
    default:return {title:'第一章完成！',description:'小镇已经有居民、工作、基础设施与持续经营能力。接下来由你决定如何扩大。',hint:'可以购买新区、跨河修桥，或者挑战更宜居、更高效的城市。',progress:'5 / 5 项目标完成',complete:true,reward:0,suggested:'inspect'};
  }
}
