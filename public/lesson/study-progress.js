import {sameOriginFetch as fetch} from '../request.js';
import {blankStudy,mergeStudy} from './study-habits.js?v=4';
const viewLimits={questions:2500,examPages:1000};
const blank=()=>({attempts:[],words:{},marks:{},history:[],last:1,views:mergeViews(),study:blankStudy()});
const copy=state=>structuredClone(state);
// Một lượt trả lời / một lượt nộp được nhận diện theo câu (hoặc tên lượt) và thời điểm.
// Lượt được chấm lại sau đó (tự chấm, AI chấm) mang gradedAt; khi gộp giữ bản chấm mới nhất thay vì giữ cả hai.
const rowKey=value=>value&&typeof value==='object'&&Number.isFinite(value.at)
 ?[value.id??'',value.title??'',value.examCode??'',value.final??'',value.at].join('|'):JSON.stringify(value);
const append=(remote,local)=>{
 const rows=new Map();
 for(const value of [...remote,...local]){
  const key=rowKey(value),previous=rows.get(key);
  if(!previous||(value?.gradedAt??0)>=(previous?.gradedAt??0))rows.set(key,value);
 }
 return [...rows.values()].sort((a,b)=>a.at-b.at);
};
const changes=(map,previous)=>Object.fromEntries(Object.entries(map).filter(([key,value])=>previous[key]!==value));
function mergeViews(left,right){
 return Object.fromEntries(Object.entries(viewLimits).map(([category,limit])=>{
  const output=new Map();
  for(const view of [left?.[category],right?.[category]]){
   for(const [key,time] of Object.entries(view??{})){
    if(Number.isSafeInteger(time)&&time>0)output.set(key,Math.max(time,output.get(key)??0));
   }
  }
  const entries=[...output];
  if(entries.length>limit)entries.sort((a,b)=>b[1]-a[1]);
  return [category,Object.fromEntries(entries.slice(0,limit))];
 }));
}
function merge(remote,local,base){
 return {
  attempts:append(remote.attempts,local.attempts),history:append(remote.history,local.history),
  words:{...remote.words,...changes(local.words,base.words)},marks:{...remote.marks,...changes(local.marks,base.marks)},
  views:mergeViews(remote.views,local.views),
  study:mergeStudy(remote.study,local.study,base.study),
  last:local.last===base.last?remote.last:local.last
 };
}
export async function openProgress(level,restore,cache,onExpired,onError){
 const url='/api/progress/'+level;
 const request=async data=>{
  const payload=data===undefined?undefined:JSON.stringify(data);
  const response=await fetch(url,payload===undefined?undefined:{
   method:'PUT',headers:{'Content-Type':'application/json'},body:payload,keepalive:payload.length<20_000
  });
  if(response.status===401||response.status===403){onExpired();throw new Error('Quyền học đã thay đổi')}
  if(!response.ok&&response.status!==409)throw new Error('Chưa đồng bộ được tiến độ');
  return {conflict:response.status===409,...await response.json()};
 };
 let revision=0,base=blank(),initial;
 try{
  const result=await request();
  revision=result.revision;
  if(result.state){base=copy(result.state);initial=result.state}
 }catch{onError()}
 const local=restore(),state=initial??local??blank();
 state.views=mergeViews(initial?.views,local?.views);
 let pending=false,saving=false;
 async function flush(){
  if(!pending||saving)return;
  saving=true;
  try{
   while(pending){
    pending=false;
    const local=copy(state);
    let candidate=local;
    for(let attempt=0;attempt<4;attempt++){
     const result=await request({state:candidate,revision});
     revision=result.revision;
     if(result.conflict){
      candidate=merge(result.state??blank(),local,base);
      if(attempt===3)throw new Error('Có thay đổi đồng thời');
      continue;
     }
     Object.assign(state,merge(candidate,state,local));
     base=copy(candidate);
     cache(state);
     break;
    }
   }
  }catch{pending=true;onError()}
  finally{saving=false}
 }
 window.addEventListener('online',flush);
 function save(){cache(state);pending=true;void flush()}
 function recordView(category,key){
  if(!Object.hasOwn(viewLimits,category)||typeof key!=='string'||!key||key.length>160)return;
  const views=state.views[category],now=Date.now();
  if(Object.hasOwn(views,key)&&now-views[key]<60_000)return;
  state.views=mergeViews(state.views,{[category]:{[key]:now}});
  save();
 }
 if(Object.entries(state.views).some(([category,items])=>Object.entries(items).some(([key,time])=>time>(base.views?.[category]?.[key]??0))))save();
 return {state,save,recordView};
}
