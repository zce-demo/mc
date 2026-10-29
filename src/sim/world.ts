import type {Terrain} from '../content/buildings.js';
export const PARCEL=6;
export const key=(x:number,y:number)=>`${x},${y}`;
export const parcelKey=(x:number,y:number)=>key(Math.floor(x/PARCEL),Math.floor(y/PARCEL));
export const neighbours=(x:number,y:number):[number,number][]=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
function hash(x:number,y:number,seed:number){let v=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,1442695041);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967296}
export function ground(x:number,y:number,seed=17):Terrain {
  if (Math.abs(x)<4 && Math.abs(y)<4)return 'grass';
  const river=Math.sin(y*.18+seed)*2+Math.sin(y*.055)*3+11;
  if(Math.abs(x-river)<1.45)return 'water';
  if(x< -10 && y>5 && y<13)return 'water';
  if(y< -9 && x<8 && hash(Math.floor(x/2),Math.floor(y/2),seed)>.28)return 'mountain';
  const n=hash(Math.floor(x/3),Math.floor(y/3),seed);
  return n>.78?'forest':'grass';
}
