import {missionView,CHAPTER_TITLE} from './content/missions.js';
import {BUILDINGS,CATEGORIES,type Kind,type Operation} from './content/buildings.js';
import {dispatch,nextDay,report} from './sim/engine.js';
import {initialCity,type City} from './sim/model.js';
import {ground,key,parcelKey,PARCEL} from './sim/world.js';
const app=document.getElementById('app')!;
app.innerHTML=`<canvas id="map"></canvas><header><div class="brand">🌿 <b>我的迷你城市</b><small>第一章 · v0.1</small></div><div id="stats"></div><button id="toggle">☰ 工作区</button></header><section id="mission" aria-label="当前市长目标"></section><aside id="workspace"><div class="tabs"><button data-tab="build" class="selected">建造</button><button data-tab="finance">财政</button><button data-tab="service">民生</button><button data-tab="land">土地</button><button data-tab="guide">引导</button></div><div id="panel"></div></aside><footer><span id="mode"></span><button id="undo">↶ 撤销</button><button id="pause">⏸ 暂停</button><button id="advance">⏩ 过一天</button><button id="speed" title="切换自动推进速度">1×</button><button id="save">💾 保存</button><button id="export">↓ 导出</button><button id="import">↑ 导入</button><input type="file" id="upload" accept=".json" hidden><span>空格拖动地图 · 道路拖动铺设 · R 道路 · I 检查</span></footer><div id="toast" role="status"></div>`;
const canvas=document.querySelector<HTMLCanvasElement>('#map')!, ctx=canvas.getContext('2d')!;
let dragStart:{x:number;y:number}|null=null,dragButton=0,panDrag=false;
let city:City=initialCity(),tab='build',selected:Kind|'inspect'|'demolish'|'pan'='road',hover:{x:number;y:number}|null=null,scale=40,cam={x:-10,y:-7},drag:{x:number;y:number;cx:number;cy:number;move:boolean}|null=null,space=false,hidden=false,flash=0,speed=1,inspected:{x:number;y:number}|null=null,previewPath:{x:number;y:number}[]=[];
const stats=document.getElementById('stats')!,panel=document.getElementById('panel')!,toast=document.getElementById('toast')!;

function renderMission(){
  const m=missionView(city,report(city)),done=Math.min(city.mission??0,5);
  const root=document.getElementById('mission')!;
  root.innerHTML=`<div class="mission-eyebrow">📜 ${CHAPTER_TITLE}<b>${done}/5</b></div>
  <h2>${m.title}</h2><p>${m.description}</p>
  <div class="mission-progress">${m.progress}</div>
  <small>${m.hint}</small>
  <button id="mission-action">${done>=5?'继续建设':m.suggested==='inspect'?'打开城市诊断':`选择「${BUILDINGS[m.suggested].name}」`}</button>`;
  document.getElementById('mission-action')!.onclick=()=>{
    if(m.suggested==='inspect'||done>=5)tab='service';
    else{tab='build';selected=m.suggested;}
    hidden=false;document.getElementById('workspace')!.classList.remove('hidden');renderPanels();draw();
  };
}
function persist(){try{localStorage.setItem('mc-v0.1',JSON.stringify({...city,history:[]}))}catch{}}
function inspectorHtml(){
  if(!inspected)return '';
  const b=city.buildings[key(inspected.x,inspected.y)];
  if(!b)return `<div class="inspect-card"><b>📍 地块 ${inspected.x},${inspected.y}</b><p>地形：${ground(inspected.x,inspected.y,city.seed)}</p><small>选择建造工具后可在这里建设。</small></div>`;
  const spec=BUILDINGS[b.kind],publicFacility=spec.category==='services'||spec.category==='utilities';
  return `<div class="inspect-card"><h3>🔎 ${spec.icon} ${spec.name}</h3><p>坐标 ${b.x},${b.y} · 日常市政成本 ${spec.daily} 金币</p>
  ${publicFacility?`<p>运营状态：${b.operation==='full'?'正常':b.operation==='reduced'?'低负荷':'停运'}</p>
  <div class="operation-controls">${(['full','reduced','closed'] as Operation[]).map(op=>`<button data-operation="${op}" class="${b.operation===op?'selected':''}">${op==='full'?'正常':op==='reduced'?'低负荷':'停运'}</button>`).join('')}</div>`:'<small>私人建筑的日常维护不计入市政府账本。</small>'}</div>`;
}
function lineCells(start:{x:number;y:number},end:{x:number;y:number}){
  const output:{x:number;y:number}[]=[],dx=Math.abs(end.x-start.x),dy=Math.abs(end.y-start.y);
  const sx=start.x<end.x?1:-1,sy=start.y<end.y?1:-1;let x=start.x,y=start.y,err=dx-dy;
  for(let i=0;i<150;i++){output.push({x,y});if(x===end.x&&y===end.y)break;const e=2*err;
    if(e>-dy){err-=dy;x+=sx;}if(e<dx){err+=dx;y+=sy;}
  }return output;
}
function notify(message:string){toast.textContent=message;toast.classList.add('visible');flash=performance.now()+2500}
function apply(cmd:Parameters<typeof dispatch>[1]){
  const oldMission=city.mission??0,r=dispatch(city,cmd);
  if(r.ok){city=r.city;persist();renderPanels();draw();}
  notify(r.ok&&(city.mission??0)>oldMission?'🎉 完成目标！奖励已发放':r.message);
}
function save(){persist();notify('💾 已保存当前城市')}
try{const s=localStorage.getItem('mc-v0.1');if(s){const v=JSON.parse(s);if(v.version===1&&v.buildings&&Array.isArray(v.parcels)){city={...initialCity(),...v,history:[]};}}}catch{}
function selectedName(){return selected in BUILDINGS?BUILDINGS[selected as Kind].name:selected==='inspect'?'检查':selected==='demolish'?'拆除':'平移'}
function renderPanels(){const r=report(city);renderMission();stats.innerHTML=`<span>🪙 <b>${city.cash.toLocaleString()}</b> <small>${r.net>=0?'+':''}${r.net}/天</small></span><span>🏘️ <b>${city.population}/${r.capacity}</b></span><span>🙂 <b>${r.happiness}%</b></span><span>📅 <b>${city.day} 天</b></span>`;
  if(tab==='build'){
    panel.innerHTML=`<h2>城市建造</h2><p class="sub">道路按住拖动即可连续铺设；其他建筑单击放置。</p><div class="quick"><button data-tool="inspect">🔎 检查</button><button data-tool="demolish">🧹 拆除</button><button data-tool="pan">✋ 平移</button></div>`+CATEGORIES.map(([category,name])=>`<h3>${name}</h3><div class="tools">${Object.values(BUILDINGS).filter(b=>b.category===category).map(b=>`<button class="tool ${selected===b.id?'active':''}" data-tool="${b.id}"><span>${b.icon}</span><b>${b.name}</b><small>${b.cost} 金币</small></button>`).join('')}</div>`).join('')+inspectorHtml();
  }else if(tab==='finance'){
    panel.innerHTML=`<h2>市政财政</h2><p class="sub">私人建筑日常维护费不计入市政府账本。</p><div class="finance"><div>居民税 <strong>+${r.income.resident}</strong></div><div>商贸及产业税 <strong>+${r.income.commerce}</strong></div><div>道路维护 <strong>-${r.expenses.transport}</strong></div><div>公共服务 <strong>-${r.expenses.services}</strong></div><div>水电设施 <strong>-${r.expenses.utilities}</strong></div><div class="net">预计每日结余 <strong>${r.net>=0?'+':''}${r.net}</strong></div></div><label>居民税率 ${city.taxRate}% <input id="tax" type="range" min="0" max="25" value="${city.taxRate}"></label><p class="sub">收入按日初人口结算。税率不会立即改变居民数量。</p>`;
  }else if(tab==='service'){
    const coverage=(label:string,c:typeof r.education)=>`<div class="service"><h3>${label}</h3><b>${c.served} / ${c.demand} 人已服务</b><p>设施名额 ${c.capacity} · 满足率 ${Math.round(c.ratio*100)}%</p>${c.missing.length?`<p class="warning">有 ${c.missing.length} 个住宅片区存在缺口</p>`:'<p class="ok">目前没有明显的服务缺口</p>'}</div>`;
    panel.innerHTML=`<h2>城市诊断</h2><p class="sub">按实际居住人口、设施有效容量及距离分配服务。</p>${coverage('🎓 教育',r.education)}${coverage('🏥 医疗',r.health)}<div class="service"><h3>⚡ 水电</h3><p>供电：${r.power.supply} / ${r.power.demand}</p><p>供水：${r.water.supply} / ${r.water.demand}</p></div><div class="service"><h3>👷 就业</h3><p>${r.filledJobs} 名劳动者 / ${r.jobs} 个岗位</p></div><p class="sub">选择「检查」并点击公共设施，可以改变运营状态。低负荷减少名额和费用，停运则为零。</p>`;
  }else if(tab==='land'){
    const parcels=[];const candidates=new Set<string>();for(const owned of city.parcels){const [px,py]=owned.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=key(px+dx,py+dy);if(!city.parcels.includes(n))candidates.add(n)}}for(const k of [...candidates].sort((a,b)=>{const aa=a.split(',').map(Number),bb=b.split(',').map(Number);return Math.hypot(...aa)-Math.hypot(...bb)}).slice(0,16)){const [px,py]=k.split(',').map(Number),price=120+Math.round(35*Math.hypot(px,py));parcels.push(`<button class="parcel" data-parcel="${k}"><span>📍 区块 ${px},${py}</span><b>${price} 金币</b></button>`)}
    panel.innerHTML=`<h2>土地开发局</h2><p class="sub">按 6×6 格购买，东南西北可持续扩建。对角地块需先从共享边界进入。</p><div class="parcel-list">${parcels.join('')}</div><p class="sub">已购买 ${city.parcels.length} 块土地。选择待售区块后，视野会前往新区。</p>`;
  }else panel.innerHTML=`<h2>小镇生活手册</h2><p class="sub">第一章 · 让小镇住进第一批居民</p><ol><li>选「道路」，从中心十字路附近铺设道路。</li><li>在道路旁建住宅、商店和农场。</li><li>建发电站、水塔，让居民搬入。</li><li>建学校和诊所，打开「民生」查看实际服务人数。</li><li>连续推进游戏日，观察收入是否能够覆盖公共设施支出。</li><li>河流要建桥、山地要建隧道；土地开发局购买新区。</li></ol><button id="new-city" style="width:100%;margin:10px 0">↺ 开始新的城市</button><h3>城市日志</h3><div class="logs">${city.log.slice(0,12).map(s=>`<p>${s}</p>`).join('')}</div>`;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>b.onclick=()=>{selected=b.dataset.tool as typeof selected;renderPanels();draw()});
  document.querySelectorAll<HTMLButtonElement>('[data-parcel]').forEach(b=>b.onclick=()=>{const [px,py]=b.dataset.parcel!.split(',').map(Number);apply({type:'parcel',px,py});cam.x=px*PARCEL-6;cam.y=py*PARCEL-6;draw()});
  document.querySelectorAll<HTMLButtonElement>('[data-operation]').forEach(b=>b.onclick=()=>{
    if(!inspected)return;apply({type:'operate',x:inspected.x,y:inspected.y,operation:b.dataset.operation as Operation});
  });
  const reset=document.getElementById('new-city');
  if(reset)reset.onclick=()=>{
    if(!confirm('确定重新开始？当前城市会被新的进度覆盖。建议先导出 JSON 备份。'))return;
    city=initialCity();inspected=null;persist();tab='build';selected='road';cam={x:-10,y:-7};
    renderPanels();draw();notify('🌱 新的小镇已准备好');
  };
  const tax=document.querySelector<HTMLInputElement>('#tax');if(tax)tax.onchange=()=>apply({type:'tax',value:+tax.value});
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));document.getElementById('mode')!.textContent=`🖱️ ${selectedName()}`;
  document.getElementById('pause')!.textContent=city.paused?'▶ 继续':'⏸ 暂停';
  canvas.style.cursor=selected==='pan'?'grab':selected==='inspect'?'help':selected==='demolish'?'not-allowed':'crosshair';
}
function size(){const w=window.innerWidth,h=window.innerHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
const pos=(sx:number,sy:number)=>({x:Math.floor(cam.x+sx/scale),y:Math.floor(cam.y+sy/scale)});
function draw(){const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);const minX=Math.floor(cam.x)-1,minY=Math.floor(cam.y)-1,maxX=Math.ceil(cam.x+w/scale)+1,maxY=Math.ceil(cam.y+h/scale)+1;const r=report(city);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const sx=(x-cam.x)*scale,sy=(y-cam.y)*scale,terrain=ground(x,y,city.seed),owned=city.parcels.includes(parcelKey(x,y));ctx.fillStyle=({grass:'#90bb8a',forest:'#6da487',water:'#68afc6',mountain:'#a2a9a5'})[terrain];ctx.fillRect(sx,sy,scale+.5,scale+.5);if(terrain==='water'){ctx.strokeStyle='#9fdae4';ctx.beginPath();ctx.moveTo(sx+scale*.18,sy+scale*.66);ctx.lineTo(sx+scale*.72,sy+scale*.66);ctx.stroke()}if(terrain==='forest'&&scale>18){ctx.font=`${scale*.38}px sans-serif`;ctx.fillText('♣',sx+scale*.35,sy+scale*.65)}if(terrain==='mountain'&&scale>18){ctx.font=`${scale*.4}px sans-serif`;ctx.fillText('▲',sx+scale*.31,sy+scale*.68)}if(!owned){ctx.fillStyle='rgba(12,30,40,.53)';ctx.fillRect(sx,sy,scale+.5,scale+.5)}ctx.strokeStyle='rgba(255,255,255,.13)';ctx.strokeRect(sx,sy,scale,scale)}
  for(const b of Object.values(city.buildings)){if(b.x<minX||b.x>maxX||b.y<minY||b.y>maxY)continue;const sx=(b.x-cam.x)*scale,sy=(b.y-cam.y)*scale;if(['road','bridge','tunnel'].includes(b.kind)){ctx.fillStyle=b.kind==='road'?'#697c83':b.kind==='bridge'?'#d5c19b':'#596875';ctx.fillRect(sx+1,sy+1,scale-2,scale-2);ctx.strokeStyle='#dce2dc';ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(sx,sy+scale/2);ctx.lineTo(sx+scale,sy+scale/2);ctx.stroke();ctx.setLineDash([])}else{ctx.fillStyle='rgba(255,255,255,.23)';ctx.fillRect(sx+3,sy+3,scale-6,scale-6);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.min(scale*.64,37)}px sans-serif`;ctx.fillText(BUILDINGS[b.kind].icon,sx+scale/2,sy+scale/2);ctx.textAlign='start';ctx.textBaseline='alphabetic';if(b.operation!=='full'){ctx.fillStyle='#23343e';ctx.font='11px sans-serif';ctx.fillText(b.operation==='closed'?'关闭':'低负荷',sx+2,sy+scale-2)}}}
  if(previewPath.length){
    for(const tile of previewPath){const sx=(tile.x-cam.x)*scale,sy=(tile.y-cam.y)*scale;
      const terrain=ground(tile.x,tile.y,city.seed);
      const good=city.parcels.includes(parcelKey(tile.x,tile.y))&&!city.buildings[key(tile.x,tile.y)];
      ctx.fillStyle=good?(terrain==='water'?'rgba(180,230,255,.52)':'rgba(105,240,165,.48)'):'rgba(243,94,96,.45)';
      ctx.fillRect(sx+2,sy+2,scale-4,scale-4);
    }
  }
  if(hover){const sx=(hover.x-cam.x)*scale,sy=(hover.y-cam.y)*scale;
    if(selected in BUILDINGS&&!previewPath.length){
      const test=dispatch(city,{type:'build',x:hover.x,y:hover.y,kind:selected as Kind});
      ctx.fillStyle=test.ok?'rgba(102,237,164,.38)':'rgba(246,92,103,.32)';
      ctx.fillRect(sx+2,sy+2,scale-4,scale-4);
    }
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(sx+1,sy+1,scale-2,scale-2);ctx.lineWidth=1}
  ctx.textAlign='center';ctx.font='bold 14px sans-serif';ctx.fillStyle='#f3fff6';const sx=(-cam.x)*scale,sy=(-cam.y)*scale;if(sx>-50&&sx<w+50&&sy>-50&&sy<h+50){ctx.fillText('✦ 市中心',sx+scale/2,sy-10)}ctx.textAlign='start';
}
function inspect(x:number,y:number){
  inspected={x,y};tab='build';selected='inspect';hidden=false;
  document.getElementById('workspace')!.classList.remove('hidden');renderPanels();
  draw();
}

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1&&e.button!==2)return;
  canvas.setPointerCapture(e.pointerId);
  const origin=pos(e.clientX,e.clientY);
  drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,move:false};
  dragStart=origin;dragButton=e.button;
  panDrag=space||selected==='pan'||e.button===1||selected==='inspect';
  previewPath=[];
});
canvas.addEventListener('pointermove',e=>{
  const p=pos(e.clientX,e.clientY);
  if(drag){
    const moved=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;
    if(moved)drag.move=true;
    if(panDrag&&drag.move){cam.x=drag.cx-(e.clientX-drag.x)/scale;cam.y=drag.cy-(e.clientY-drag.y)/scale;}
    else if(drag.move&&selected==='road'&&dragStart){previewPath=lineCells(dragStart,p);}
    else if(drag.move&&selected!=='road'&&!panDrag){cam.x=drag.cx-(e.clientX-drag.x)/scale;cam.y=drag.cy-(e.clientY-drag.y)/scale;}
  }
  hover=pos(e.clientX,e.clientY);draw();
});
canvas.addEventListener('pointercancel',()=>{drag=null;previewPath=[];draw()});
canvas.addEventListener('pointerup',e=>{
  if(!drag)return;
  const moved=drag.move,wasPan=panDrag,button=dragButton,from=dragStart;
  drag=null;previewPath=[];
  if(button===2){if(!moved)inspect(pos(e.clientX,e.clientY).x,pos(e.clientX,e.clientY).y);return;}
  if((wasPan&&moved)||selected==='pan')return;
  if(selected==='road'&&from){
    const cells=lineCells(from,pos(e.clientX,e.clientY));
    apply({type:'build-path',cells});return;
  }
  if(moved)return;
  const p=pos(e.clientX,e.clientY);
  if(selected==='inspect')inspect(p.x,p.y);
  else if(selected==='demolish')apply({type:'demolish',...p});
  else apply({type:'build',...p,kind:selected});
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const worldX=cam.x+e.clientX/scale,worldY=cam.y+e.clientY/scale;
  scale=Math.max(18,Math.min(84,scale*(e.deltaY>0?.9:1.1)));
  cam.x=worldX-e.clientX/scale;cam.y=worldY-e.clientY/scale;draw();
},{passive:false});
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab!;hidden=false;document.getElementById('workspace')!.classList.remove('hidden');renderPanels()});
document.getElementById('toggle')!.onclick=()=>{hidden=!hidden;document.getElementById('workspace')!.classList.toggle('hidden',hidden)};
document.getElementById('undo')!.onclick=()=>apply({type:'undo'});
document.getElementById('pause')!.onclick=()=>{city.paused=!city.paused;renderPanels()};
document.getElementById('speed')!.onclick=()=>{
  speed=speed===1?2:speed===2?4:1;
  document.getElementById('speed')!.textContent=speed+'×';
  notify('⏱️ 城市运行速度：'+speed+'×');
};
function step(){if(city.paused||document.hidden)return;const oldMission=city.mission??0,r=nextDay(city);
  city=r.city;persist();renderPanels();draw();
  if((city.mission??0)>oldMission)notify('🎉 城市目标完成，已获得奖励');
}
document.getElementById('advance')!.onclick=step;document.getElementById('save')!.onclick=save;
document.getElementById('export')!.onclick=()=>{const blob=new Blob([JSON.stringify({...city,history:[]})],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mini-city-day-${city.day}.json`;a.click();URL.revokeObjectURL(a.href)};
document.getElementById('import')!.onclick=()=>document.querySelector<HTMLInputElement>('#upload')!.click();document.querySelector<HTMLInputElement>('#upload')!.onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.parcels)||!data.buildings||!Number.isFinite(data.cash))throw new Error('格式不兼容');city={...initialCity(),...data,history:[]};renderPanels();draw();persist();notify('已导入 v0.1 存档')}catch{notify('无法导入：仅支持 v0.1 JSON 存档')}};
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(e.key===' '){e.preventDefault();space=true}if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();apply({type:'undo'})}if(e.key.toLowerCase()==='r'){selected='road';renderPanels()}if(e.key.toLowerCase()==='i'){selected='inspect';renderPanels()}if(e.key.toLowerCase()==='p'){city.paused=!city.paused;renderPanels()}if(e.key.toLowerCase()==='f'){cam={x:-10,y:-7};draw()}if(e.key.toLowerCase()==='h'){hidden=!hidden;document.getElementById('workspace')!.classList.toggle('hidden',hidden)}});window.addEventListener('keyup',e=>{if(e.key===' ')space=false});window.addEventListener('resize',size);
renderPanels();size();
let elapsed=0;
setInterval(()=>{
  if(city.paused||document.hidden)return;
  elapsed+=500;
  if(elapsed>=9000/speed){elapsed=0;step();}
},500);
setInterval(()=>{if(performance.now()>flash)toast.classList.remove('visible')},250);
