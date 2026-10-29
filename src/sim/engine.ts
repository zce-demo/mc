import {BUILDINGS,type Kind,type Operation} from '../content/buildings.js';
import {ground,key,neighbours,parcelKey} from './world.js';
import {clone,type City,type CitySnapshot,type Command,type Building} from './model.js';
export interface Coverage {demand:number;served:number;capacity:number;ratio:number;missing:{x:number;y:number}[]}
export interface Report {population:number;capacity:number;jobs:number;filledJobs:number;power:{supply:number;demand:number};water:{supply:number;demand:number};education:Coverage;health:Coverage;connected:Set<string>;income:{resident:number;commerce:number};expenses:{transport:number;services:number;utilities:number};net:number;happiness:number}
const opFactor=(b:Building)=>b.operation==='closed'?0:b.operation==='reduced'?.6:1;
const isRoad=(b?:Building)=>!!b&&['road','bridge','tunnel'].includes(b.kind);
export function roadNetwork(city:City):Set<string>{const set=new Set<string>(),queue:[number,number][]=[[0,0]];while(queue.length){const [x,y]=queue.shift()!;const k=key(x,y);if(set.has(k))continue;const b=city.buildings[k];if(k!=='0,0'&&!isRoad(b))continue;set.add(k);for(const [nx,ny] of neighbours(x,y))if(isRoad(city.buildings[key(nx,ny)])&&!set.has(key(nx,ny)))queue.push([nx,ny]);}return set;}
function accessible(b:Building,connected:Set<string>){return neighbours(b.x,b.y).some(([x,y])=>connected.has(key(x,y)))}
function allocation(res:Building[], facilities:Building[], people:number, share:number, connected:Set<string>):Coverage {const demand=Math.ceil(people*share),missing:{x:number;y:number}[]=[];let rem=demand, served=0,capacity=0;const active=facilities.filter(f=>accessible(f,connected)).map(f=>({f,left:Math.floor((BUILDINGS[f.kind].capacity??0)*opFactor(f))}));capacity=active.reduce((v,a)=>v+a.left,0);for(const h of res.sort((a,b)=>a.id.localeCompare(b.id))){const hNeed=people===0?0:Math.min(rem,Math.ceil((BUILDINGS[h.kind].capacity??0)*share*people/Math.max(1,res.length*12)));let need=hNeed;for(const a of active.sort((a,b)=>{const da=Math.abs(h.x-a.f.x)+Math.abs(h.y-a.f.y),db=Math.abs(h.x-b.f.x)+Math.abs(h.y-b.f.y);return da-db||a.f.id.localeCompare(b.f.id)})){if(need===0)break;if(!accessible(h,connected)||Math.abs(h.x-a.f.x)+Math.abs(h.y-a.f.y)>8)continue;const n=Math.min(need,a.left);a.left-=n;need-=n;served+=n;}if(need)missing.push({x:h.x,y:h.y});rem-=hNeed;}return {demand,served:Math.min(served,demand),capacity,ratio:demand?Math.min(1,served/demand):1,missing};}
export function report(city:City):Report{
  const bs=Object.values(city.buildings), connected=roadNetwork(city);
  const active=bs.filter(b=>accessible(b,connected)&&opFactor(b)>0);
  const homes=active.filter(b=>b.kind==='home'); const capacity=homes.length*12;
  const population=Math.min(city.population,capacity);
  const jobs=active.reduce((s,b)=>s+(BUILDINGS[b.kind].jobs??0),0), workers=Math.floor(population*.6),filledJobs=Math.min(workers,jobs);
  const supplyPower=active.reduce((s,b)=>s+(BUILDINGS[b.kind].power??0)*opFactor(b),0),supplyWater=active.reduce((s,b)=>s+(BUILDINGS[b.kind].water??0)*opFactor(b),0);
  const demandPower=active.reduce((s,b)=>s+(BUILDINGS[b.kind].demandPower??0)*opFactor(b),0),demandWater=active.reduce((s,b)=>s+(BUILDINGS[b.kind].demandWater??0)*opFactor(b),0);
  const power={supply:Math.floor(supplyPower),demand:Math.ceil(demandPower)},water={supply:Math.floor(supplyWater),demand:Math.ceil(demandWater)};
  const serviceFactor=Math.min(1,power.supply/Math.max(1,power.demand),water.supply/Math.max(1,water.demand));
  const education=allocation(homes,active.filter(b=>b.kind==='school'),population,.2,connected),health=allocation(homes,active.filter(b=>b.kind==='clinic'),population,.24,connected);
  const resident=Math.floor(population*city.taxRate*.3*serviceFactor);
  const commerce=Math.floor(active.reduce((s,b)=>s+(BUILDINGS[b.kind].tax??0),0)*Math.min(1,workers/Math.max(1,jobs))*serviceFactor);
  const expenses={transport:bs.filter(b=>isRoad(b)).reduce((s,b)=>s+BUILDINGS[b.kind].daily,0),services:active.filter(b=>BUILDINGS[b.kind].category==='services').reduce((s,b)=>s+Math.round(BUILDINGS[b.kind].daily*opFactor(b)),0),utilities:active.filter(b=>BUILDINGS[b.kind].category==='utilities').reduce((s,b)=>s+Math.round(BUILDINGS[b.kind].daily*opFactor(b)),0)};
  const net=resident+commerce-expenses.transport-expenses.services-expenses.utilities;
  const happiness=Math.round(25+education.ratio*22+health.ratio*22+serviceFactor*20+Math.max(0,11-city.taxRate));
  return {population,capacity,jobs,filledJobs,power,water,education,health,connected,income:{resident,commerce},expenses,net,happiness:Math.min(100,happiness)};
}
export function predictNextDay(city:City){return report(city).net}
function snapshot(c:City):CitySnapshot{return clone({cash:c.cash,taxRate:c.taxRate,buildings:c.buildings,parcels:c.parcels,nextId:c.nextId})}
export function dispatch(city:City,cmd:Command):{ok:true;city:City;message:string}|{ok:false;message:string}{
  const c=clone(city);if(cmd.type==='undo'){const last=c.history.pop();if(!last)return {ok:false,message:'当前没有可撤销的操作'};if(last.day!==c.day)return {ok:false,message:'跨日操作不可撤销'};Object.assign(c,last.before);return {ok:true,city:c,message:'已撤销最近一次操作'};}
  const before=snapshot(c);let message='';
  if(cmd.type==='parcel'){
    const k=key(cmd.px,cmd.py);if(c.parcels.includes(k))return {ok:false,message:'已经购买这块土地'};
    const adjacent=neighbours(cmd.px,cmd.py).some(([x,y])=>c.parcels.includes(key(x,y)));if(!adjacent)return {ok:false,message:'只能购买共享边界的相邻土地'};
    const cost=120+Math.round(35*Math.hypot(cmd.px,cmd.py));if(c.cash<cost)return {ok:false,message:'购买土地的资金不足'};c.cash-=cost;c.parcels.push(k);message='购买新区 -'+cost+' 金币';
  }else if(cmd.type==='tax'){if(cmd.value<0||cmd.value>25)return {ok:false,message:'税率只能设置在 0–25%'};c.taxRate=cmd.value;message='居民税率设为 '+cmd.value+'%';
  }else{
    const k=key(cmd.x,cmd.y),existing=c.buildings[k];
    if(cmd.type==='build'){
      const spec=BUILDINGS[cmd.kind];if(existing)return {ok:false,message:'当前位置已有建筑'};
      if(!c.parcels.includes(parcelKey(cmd.x,cmd.y)))return {ok:false,message:'需要先购买土地'};
      if(!spec.terrain.includes(ground(cmd.x,cmd.y,c.seed)))return {ok:false,message:'这里的地形不能建造该设施'};
      if(cmd.kind!=='road'&&cmd.kind!=='bridge'&&cmd.kind!=='tunnel'&&!neighbours(cmd.x,cmd.y).some(([x,y])=>roadNetwork(c).has(key(x,y))))return {ok:false,message:'建筑需要靠近已连通的道路'};
      if(['road','bridge','tunnel'].includes(cmd.kind)&&!neighbours(cmd.x,cmd.y).some(([x,y])=>roadNetwork(c).has(key(x,y))))return {ok:false,message:'新道路需要接入现有道路'};
      if(c.cash<spec.cost)return {ok:false,message:'余额不足，需要 '+spec.cost+' 金币'};c.cash-=spec.cost;c.buildings[k]={id:String(c.nextId++),x:cmd.x,y:cmd.y,kind:cmd.kind,operation:'full'};message='建设'+spec.name+' -'+spec.cost;
    }else if(cmd.type==='demolish'){
      if(!existing)return {ok:false,message:'这里没有建筑'};delete c.buildings[k];message='拆除了'+BUILDINGS[existing.kind].name;
    }else if(cmd.type==='operate'){
      if(!existing)return {ok:false,message:'这里没有设施'};
      if(!['services','utilities'].includes(BUILDINGS[existing.kind].category))return {ok:false,message:'只能调整公共设施的运营状态'};
      existing.operation=cmd.operation;message=BUILDINGS[existing.kind].name+'运营状态：'+cmd.operation;
    }
  }
  c.history.push({kind:cmd.type,before,day:c.day});if(c.history.length>10)c.history.shift();c.log.unshift('第 '+c.day+' 天 · '+message);c.log=c.log.slice(0,100);return {ok:true,city:c,message};
}
export function nextDay(city:City):{city:City;opening:number;entries:{name:string;amount:number}[];closing:number}{
  const c=clone(city),opening=c.cash,pre=report(c);
  const entries=[{name:'居民税',amount:pre.income.resident},{name:'商贸税',amount:pre.income.commerce},{name:'道路维护',amount:-pre.expenses.transport},{name:'公共服务',amount:-pre.expenses.services},{name:'水电基础设施',amount:-pre.expenses.utilities}];
  c.cash+=entries.reduce((s,e)=>s+e.amount,0);
  const ready=pre.capacity>c.population&&pre.power.supply>=pre.power.demand&&pre.water.supply>=pre.water.demand&&pre.jobs>Math.floor(c.population*.5);
  if(ready)c.population=Math.min(pre.capacity,c.population+Math.max(1,Math.ceil(pre.happiness/35)));else if((pre.happiness<36||pre.power.supply<pre.power.demand||pre.water.supply<pre.water.demand)&&c.population>0)c.population=Math.max(0,c.population-1);
  c.day++;c.history=[];c.log.unshift('第 '+(c.day-1)+' 天结算：'+(pre.net>=0?'+':'')+pre.net+' 金币 · 人口 '+pre.population+' → '+c.population);c.log=c.log.slice(0,100);
  return {city:c,opening,entries,closing:c.cash};
}
