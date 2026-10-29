import type {Kind,Operation} from '../content/buildings.js';
export interface Building {id:string;x:number;y:number;kind:Kind;operation:Operation}
export interface City {version:1;seed:number;day:number;cash:number;taxRate:number;buildings:Record<string,Building>;parcels:string[];population:number;paused:boolean;nextId:number;history:Change[];log:string[]}
export type Change={kind:'build'|'demolish'|'operate'|'parcel'|'tax';before:CitySnapshot;day:number};
export type CitySnapshot=Pick<City,'cash'|'taxRate'|'buildings'|'parcels'|'nextId'>;
export type Command={type:'build';x:number;y:number;kind:Kind}|{type:'demolish';x:number;y:number}|{type:'operate';x:number;y:number;operation:Operation}|{type:'parcel';px:number;py:number}|{type:'tax';value:number}|{type:'undo'};
export const initialCity=():City=>({version:1,seed:17,day:1,cash:1850,taxRate:10,buildings:{},parcels:['0,0','-1,0','0,-1','-1,-1'],population:0,paused:false,nextId:1,history:[],log:['欢迎来到山河小镇。先规划道路和新住宅。']});
export const clone=<T>(v:T):T=>structuredClone(v);
