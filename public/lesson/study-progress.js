import {sameOriginFetch as fetch} from '../request.js';
const blank=()=>({attempts:[],words:{},marks:{},history:[],last:1});
const copy=state=>structuredClone(state);
const append=(remote,local)=>{
 const rows=new Map([...remote,...local].map(value=>[JSON.stringify(value),value]));
 return [...rows.values()].sort((a,b)=>a.at-b.at);
};
const changes=(map,previous)=>Object.fromEntries(Object.entries(map).filter(([key,value])=>previous[key]!==value));
function merge(remote,local,base){
 return {
  attempts:append(remote.attempts,local.attempts),history:append(remote.history,local.history),
  words:{...remote.words,...changes(local.words,base.words)},marks:{...remote.marks,...changes(local.marks,base.marks)},
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
 return {state,save(){cache(state);pending=true;void flush()}};
}
