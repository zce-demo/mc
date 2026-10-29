export type Kind = 'road'|'bridge'|'tunnel'|'home'|'shop'|'farm'|'school'|'clinic'|'park'|'power'|'water';
export type Terrain = 'grass'|'forest'|'water'|'mountain';
export type Operation = 'full'|'reduced'|'closed';
export interface BuildingSpec {id:Kind;name:string;icon:string;cost:number; daily:number; category:'transport'|'housing'|'commerce'|'services'|'utilities';terrain:Terrain[]; capacity?:number; jobs?:number; tax?:number; service?:'education'|'health'; power?:number; water?:number; demandPower?:number; demandWater?:number}
export const BUILDINGS: Record<Kind,BuildingSpec>={
  road:{id:'road',name:'道路',icon:'🛣️',cost:18,daily:1,category:'transport',terrain:['grass','forest']},
  bridge:{id:'bridge',name:'桥梁',icon:'🌉',cost:65,daily:3,category:'transport',terrain:['water']},
  tunnel:{id:'tunnel',name:'隧道',icon:'🚇',cost:95,daily:5,category:'transport',terrain:['mountain']},
  home:{id:'home',name:'住宅',icon:'🏠',cost:100,daily:0,category:'housing',terrain:['grass','forest'],capacity:12,demandPower:2,demandWater:2},
  shop:{id:'shop',name:'商店',icon:'🏪',cost:160,daily:0,category:'commerce',terrain:['grass','forest'],jobs:9,tax:25,demandPower:4,demandWater:1},
  farm:{id:'farm',name:'农场',icon:'🌾',cost:140,daily:0,category:'commerce',terrain:['grass','forest'],jobs:6,tax:18,demandPower:1,demandWater:2},
  school:{id:'school',name:'学校',icon:'🏫',cost:240,daily:26,category:'services',terrain:['grass','forest'],capacity:35,service:'education',demandPower:3,demandWater:2},
  clinic:{id:'clinic',name:'诊所',icon:'🏥',cost:280,daily:30,category:'services',terrain:['grass','forest'],capacity:30,service:'health',demandPower:4,demandWater:3},
  park:{id:'park',name:'公园',icon:'🌳',cost:85,daily:4,category:'services',terrain:['grass','forest']},
  power:{id:'power',name:'发电站',icon:'⚡',cost:360,daily:30,category:'utilities',terrain:['grass','forest'],power:90},
  water:{id:'water',name:'水塔',icon:'🚰',cost:300,daily:22,category:'utilities',terrain:['grass','forest'],water:80},
};
export const CATEGORIES=[['transport','交通'],['housing','住宅'],['commerce','商业'],['services','公共服务'],['utilities','基础设施']] as const;
