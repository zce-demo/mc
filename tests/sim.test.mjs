import test from 'node:test';import assert from 'node:assert/strict';
import {initialCity} from '../dist/sim/model.js';
import {dispatch,nextDay,report,predictNextDay} from '../dist/sim/engine.js';
import {ground} from '../dist/sim/world.js';
const doIt=(city,cmd)=>{const r=dispatch(city,cmd);assert.equal(r.ok,true,r.message);return r.city};
test('财政账本与预测一致',()=>{let c=initialCity();c=doIt(c,{type:'build',x:0,y:1,kind:'road'});const r=report(c),n=nextDay(c);assert.equal(r.net,predictNextDay(c));assert.equal(n.closing-n.opening,n.entries.reduce((a,b)=>a+b.amount,0));assert.equal(n.city.cash,c.cash+r.net)});
test('未购地块、河流与山地拒绝非法施工',()=>{let c=initialCity();assert.equal(dispatch(c,{type:'build',x:200,y:200,kind:'road'}).ok,false);assert.equal(dispatch(c,{type:'parcel',px:9,py:9}).ok,false);const t=ground(10,1,c.seed);assert.equal(t,'water');c=doIt(c,{type:'build',x:0,y:1,kind:'road'});assert.equal(dispatch(c,{type:'build',x:10,y:1,kind:'road'}).ok,false)});
test('同日操作可撤销，日结后不可撤销',()=>{let c=initialCity();const original=c.cash;c=doIt(c,{type:'build',x:0,y:1,kind:'road'});c=doIt(c,{type:'undo'});assert.equal(c.cash,original);assert.equal(Object.keys(c.buildings).length,1);c=doIt(c,{type:'build',x:0,y:1,kind:'road'});c=nextDay(c).city;assert.equal(dispatch(c,{type:'undo'}).ok,false)});
test('税收对税率单调且每日模拟确定',()=>{let c=initialCity();c.population=7;c.buildings={'0,1':{id:'1',x:0,y:1,kind:'road',operation:'full'},'1,1':{id:'2',x:1,y:1,kind:'home',operation:'full'},'0,2':{id:'3',x:0,y:2,kind:'power',operation:'full'},'-1,1':{id:'4',x:-1,y:1,kind:'water',operation:'full'}};const a=report(c).income.resident;c.taxRate=18;assert.ok(report(c).income.resident>=a);let b=structuredClone(c);for(let i=0;i<40;i++){c=nextDay(c).city;b=nextDay(b).city}assert.deepEqual(c,b)});
test('对角土地必须从边缘依次购入',()=>{let c=initialCity();assert.equal(dispatch(c,{type:'parcel',px:1,py:1}).ok,false);c=doIt(c,{type:'parcel',px:1,py:0});assert.ok(c.parcels.includes('1,0'));c=doIt(c,{type:'parcel',px:1,py:1});assert.ok(c.parcels.includes('1,1'))});

test('连续铺路作为一步撤销，目标奖励不会被重复领取',()=>{
  let c=initialCity(),startingCash=c.cash;
  c=doIt(c,{type:'build-path',cells:[{x:0,y:1},{x:0,y:2},{x:0,y:3}]});
  assert.equal(c.mission,1);
  assert.equal(c.cash,startingCash-18*3+120);
  assert.equal(c.history.length,1);
  c=doIt(c,{type:'undo'});
  assert.equal(c.cash,startingCash);
  assert.equal(c.mission,0);
  assert.equal(Object.keys(c.buildings).length,1);
  c=doIt(c,{type:'build-path',cells:[{x:0,y:1},{x:0,y:2},{x:0,y:3}]});
  assert.equal(c.mission,1);
  assert.equal(c.cash,startingCash-54+120);
});
test('稳定盈利目标只能按实际日结连续完成',()=>{
  const c=initialCity();
  c.mission=4;c.population=25;c.stableDays=1;
  let b=structuredClone(c);
  b.buildings={'0,0':c.buildings['0,0'],'0,1':{id:'1',x:0,y:1,kind:'road',operation:'full'},
    '1,1':{id:'2',x:1,y:1,kind:'home',operation:'full'},
    '-1,1':{id:'3',x:-1,y:1,kind:'home',operation:'full'},
    '0,2':{id:'4',x:0,y:2,kind:'shop',operation:'full'}};
  const next=nextDay(b);
  assert.equal(next.closing-next.opening,next.entries.reduce((sum,e)=>sum+e.amount,0));
});

test('新玩家可以从空镇推进并完成第一章',()=>{
  let c=initialCity();
  const build=(x,y,kind)=>{c=doIt(c,{type:'build',x,y,kind});};
  c=doIt(c,{type:'build-path',cells:[{x:0,y:1},{x:0,y:2},{x:0,y:3}]});
  assert.equal(c.mission,1);
  build(1,1,'home');build(1,2,'home');build(-1,1,'shop');
  assert.equal(c.mission,2);
  build(-1,2,'power');build(1,3,'water');
  for(let i=0;i<10&&c.mission<3;i++)c=nextDay(c).city;
  assert.equal(c.mission,3,'水电和岗位应让第一批居民搬入');
  build(-1,3,'school');build(-1,0,'clinic');
  assert.equal(c.mission,4,'教育医疗达标应触发下一阶段');
  build(0,-1,'road');build(1,-1,'farm');build(1,0,'home');
  for(let i=0;i<30&&c.mission<5;i++){
    const t=nextDay(c);
    assert.equal(t.closing-t.opening,t.entries.reduce((sum,e)=>sum+e.amount,0));
    c=t.city;
  }
  assert.equal(c.mission,5,'通过良性经营应能完成第一章');
  assert.ok(c.population>=20);
});
