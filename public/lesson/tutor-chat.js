import {sameOriginFetch as fetch} from '../request.js';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons={
 chat:'<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',
 expand:'<path d="M14 4h6v6m-10 10H4v-6m16-10-6 6M4 20l6-6"/>',
 collapse:'<path d="M4 14h6v6m10-10h-6V4m0 6 6-6M4 20l6-6"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 send:'<path d="m3 11 18-8-8 18-2-8-8-2Zm8 2L21 3"/>'
};
const icon=name=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+icons[name]+'</svg>';
const modes={explain:'Hỏi & giải thích',correct:'Sửa câu',dialogue:'Luyện hội thoại'};
const suggestions={
 explain:['“的” và “得” khác nhau thế nào?','Cho mình 3 câu ví dụ ở trình độ này.'],
 correct:['Sửa câu tiếng Trung mình viết.','Giải thích thứ tự từ trong câu của mình.'],
 dialogue:['Luyện hội thoại gọi món với mình.','Luyện hội thoại hỏi đường với mình.']
};
const date=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
const byId=id=>document.getElementById(id);

export function createTutorChat({courseId,courseName,lessonAt,lessonOptions,navigate}){
 const state={open:false,mode:'explain',context:'auto',turns:[],threads:[],id:null,draft:'',pending:'',error:'',loading:false,historyBusy:false,hasHistory:false,hasOlder:false};
 let previousPage='',previousLessonPage='';
 const mobile=matchMedia('(max-width: 640px)');
 const viewport=window.visualViewport;
 function positionMini(){
  const host=byId('chat-widget');
  if(!host||!viewport)return;
  host.style.setProperty('--tutor-viewport-height',viewport.height+'px');
  host.style.setProperty('--tutor-keyboard-offset',Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)+'px');
 }
 viewport?.addEventListener('resize',positionMini);
 viewport?.addEventListener('scroll',positionMini);
 const expanded=()=>location.hash==='#chat';
 const visible=()=>expanded()||state.open;
 const context=()=>{
  const lesson=state.context==='auto'?lessonAt(expanded()?previousLessonPage:location.hash.slice(1)):state.context==='course'||state.context==='free'?null:Number(state.context);
  return {course:state.context==='free'?null:courseId,lesson:lesson??null};
 };
 const contextLabel=()=>{
  const scope=context();
  return scope.course===null?'Hỏi tự do':courseName+(scope.lesson===null?'':' · Bài '+scope.lesson);
 };
 const button=(label,action,css='btn',glyph='')=>'<button type="button" class="'+css+'" data-tutor="'+action+'"'+(glyph?' aria-label="'+label+'" title="'+label+'"':'')+'>'+(glyph?icon(glyph):label)+'</button>';
 const avatar=()=>'<span class="tutor-avatar" aria-hidden="true">师</span>';
 const message=(role,content)=>'<article class="chat-message '+role+'" aria-label="'+(role==='mine'?'Bạn':'Trợ giảng FangSchool')+'">'+
  (role==='theirs'?avatar():'')+'<p class="lines">'+escapeHtml(content)+'</p></article>';
 const threadList=()=>'<aside class="tutor-history" aria-label="Lịch sử chat">'+
  button('+ Cuộc trò chuyện mới','new','btn primary')+
  '<section class="panel tutor-recent"><h2>Gần đây</h2>'+
  (state.threads.length?state.threads.map(thread=>'<button type="button" data-tutor="thread" data-thread="'+escapeHtml(thread.id)+'"'+(thread.id===state.id?' aria-current="true"':'')+
   '><strong>'+escapeHtml(thread.title)+'</strong><small>'+date.format(thread.updatedAt)+'</small></button>').join(''):state.historyBusy?'<p>Đang tải lịch sử…</p>':'<p>Chưa có cuộc trò chuyện.</p>')+
  (state.hasHistory?button('Xem thêm','more-history'):'')+'</section></aside>';
 const contextSelect=()=>'<label class="sr" for="tutor-context">Ngữ cảnh</label><select id="tutor-context">'+
  [['auto','Bài đang học'],['course','Toàn khóa '+courseName],['free','Hỏi tự do'],...lessonOptions()].map(([key,label])=>
   '<option value="'+key+'"'+(key===state.context?' selected':'')+'>'+escapeHtml(label)+'</option>').join('')+'</select>';

 function panel(full){
  const turns=state.turns.map(turn=>message('mine',turn.question)+message('theirs',turn.answer)).join('');
  const waiting=state.pending?message('mine',state.pending)+message('theirs','Đang soạn câu trả lời…'):'';
  const empty=state.loading?'Đang mở cuộc trò chuyện…':'Bạn muốn hỏi gì về tiếng Trung?';
  const lock=state.pending||state.loading?' disabled':'';
  return '<section class="panel chat-panel'+(full?'':' tutor-mini')+'" id="tutor-panel" aria-label="Trợ giảng FangSchool">'+
   '<header class="tutor-panel-header">'+avatar()+'<div class="tutor-panel-title"><strong>Trợ giảng FangSchool</strong><small>'+escapeHtml(contextLabel())+'</small></div>'+
   (full?contextSelect()+button('Thu nhỏ','minimize','tutor-icon','collapse'):button('Phóng to','expand','tutor-icon','expand')+button('Đóng chat','close','tutor-icon','close'))+'</header>'+
   '<div class="chat-thread" id="chat-thread" role="log" aria-label="Cuộc trò chuyện" aria-live="polite">'+
   (state.hasOlder?button('Xem tin nhắn cũ hơn','older'):'')+(turns+waiting||'<p class="chat-example">'+empty+'</p>')+'</div>'+
   (state.error?'<p role="alert" class="chat-error">'+escapeHtml(state.error)+'</p>':'')+
   '<form id="chat-form" class="chat-form">'+
    (full&&!state.turns.length&&!state.pending?'<div class="tutor-suggestions">'+suggestions[state.mode].map((label,i)=>button(label,'suggest-'+i)).join('')+'</div>':'')+
    '<label class="sr" for="chat-input">Câu hỏi của bạn</label><textarea id="chat-input" name="message" rows="'+(full?3:2)+'" maxlength="500" required'+
    ' placeholder="Nhập câu hỏi của bạn…"'+lock+'>'+escapeHtml(state.draft)+'</textarea>'+
    '<div class="tutor-compose"><small>AI có thể nhầm. Hãy đối chiếu với bài học.</small><button type="submit" class="btn primary"'+lock+'>'+icon('send')+' Gửi</button></div>'+
   '</form></section>';
 }

 function page(){
  return '<header class="page-head"><div><h1>Hỏi AI</h1><p>Hỏi về từ vựng, ngữ pháp, sửa câu và luyện hội thoại tiếng Trung.</p></div></header>'+
   '<div class="tutor-modes" role="group" aria-label="Chế độ hỏi">'+Object.entries(modes).map(([mode,label])=>
    '<button type="button" class="btn" data-tutor="mode-'+mode+'" aria-pressed="'+(state.mode===mode)+'">'+label+'</button>').join('')+'</div>'+
   '<div class="tutor-layout">'+threadList()+panel(true)+'</div>';
 }

 function sync(){
  const host=byId('chat-widget');
  if(!host)return;
  host.classList.toggle('tutor-open',state.open&&!expanded());
  if(state.open)positionMini();
  if(expanded()){
   host.innerHTML='';
   byId('app').innerHTML=page();
  }else{
   host.innerHTML=(state.open?panel(false):'')+'<button type="button" class="tutor-launcher" data-tutor="'+(state.open?'close':'open')+'" aria-expanded="'+state.open+'"'+
    (state.open?' aria-controls="tutor-panel"':'')+' aria-label="'+(state.open?'Thu gọn trợ giảng AI':'Hỏi trợ giảng AI')+'" title="Hỏi trợ giảng AI">'+icon(state.open?'close':'chat')+
    (state.open?'':'<span aria-hidden="true">AI</span>')+'</button>';
  }
  const thread=byId('chat-thread');
  if(thread)thread.scrollTop=thread.scrollHeight;
 }

 function onPage(pageKey){
  if(pageKey==='chat'&&previousPage!=='chat'){
   state.open=false;
   void loadHistory();
  }
  previousPage=pageKey;
  sync();
 }

 async function request(path,options){
  const response=await fetch('/api/ai/'+path,{...options,headers:{Accept:'application/json',...options?.headers}});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error??result.message??'Không kết nối được với trợ giảng AI.');
  return result;
 }

 async function loadHistory(more=false){
  if(state.historyBusy)return;
  state.historyBusy=true;
  try{
   const response=await request('history?offset='+(more?state.threads.length:0));
   state.threads=more?[...new Map([...state.threads,...response.conversations].map(thread=>[thread.id,thread])).values()]:response.conversations;
   state.hasHistory=response.hasMore;
  }catch(error){state.error=error.message}
  finally{
   state.historyBusy=false;
   if(expanded())sync();
  }
 }

 async function loadThread(id,older=false){
  if(state.pending||state.loading)return;
  state.loading=true;
  state.error='';
  const thread=byId('chat-thread');
  const distance=thread?thread.scrollHeight-thread.scrollTop:0;
  if(!older)sync();
  try{
   const response=await request('history?id='+encodeURIComponent(id)+(older?'&before='+state.turns[0].id:''));
   state.id=id;
   state.turns=older?[...response.turns,...state.turns]:response.turns;
   state.hasOlder=response.hasMore;
   if(!older)state.draft='';
  }catch(error){state.error=error.message}
  finally{
   state.loading=false;
   if(visible()){
    sync();
    if(older&&byId('chat-thread'))byId('chat-thread').scrollTop=byId('chat-thread').scrollHeight-distance;
   }
  }
 }

 async function send(){
  const value=state.draft.trim();
  if(!value||state.pending||state.loading)return;
  state.pending=value;
  state.draft='';
  state.error='';
  sync();
  try{
   const response=await request('chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:value,id:state.id,mode:state.mode,...context()})});
   state.id=response.conversation.id;
   state.turns.push(response.turn);
   state.threads=[response.conversation,...state.threads.filter(item=>item.id!==state.id)];
  }catch(error){
   state.draft=value;
   state.error=error instanceof TypeError?'Không kết nối được. Vui lòng thử lại.':error.message;
  }finally{
   state.pending='';
   if(visible()){
    sync();
    if(expanded()||!mobile.matches)byId('chat-input')?.focus({preventScroll:true});
   }
  }
 }

 function toggle(open){
  state.open=open;
  sync();
  if(open){
   const target=mobile.matches?document.querySelector('.tutor-mini .tutor-icon'):byId('chat-input');
   target?.focus({preventScroll:true});
  }
  else document.querySelector('.tutor-launcher')?.focus({preventScroll:true});
 }

 document.addEventListener('click',event=>{
  const trigger=event.target.closest?.('[data-tutor]');
  if(!trigger)return;
  const action=trigger.dataset.tutor;
  if(action==='open')toggle(true)
  else if(action==='close')toggle(false);
  else if(action==='expand'){navigate('chat')}
  else if(action==='minimize')navigate(previousLessonPage||'home',true);
  else if(action==='new'&&!state.pending&&!state.loading){
   Object.assign(state,{id:null,turns:[],draft:'',error:'',hasOlder:false});
   sync();
   byId('chat-input')?.focus();
  }else if(action==='thread')void loadThread(trigger.dataset.thread);
  else if(action==='more-history')void loadHistory(true);
  else if(action==='older'&&state.id&&state.turns[0]?.id)void loadThread(state.id,true);
  else if(action.startsWith('mode-')&&Object.hasOwn(modes,action.slice(5))){
   state.mode=action.slice(5);
   sync();
   document.querySelector('[data-tutor="'+action+'"]')?.focus();
  }else if(action.startsWith('suggest-')){
   state.draft=suggestions[state.mode][Number(action.slice(8))]??'';
   sync();
   byId('chat-input')?.focus();
  }
 });
 document.addEventListener('input',event=>{if(event.target.id==='chat-input')state.draft=event.target.value});
 document.addEventListener('change',event=>{
  if(event.target.id==='tutor-context'){
   state.context=event.target.value;
   sync();
   byId('tutor-context')?.focus();
  }
 });
 document.addEventListener('submit',event=>{
  if(event.target.id==='chat-form'){event.preventDefault();void send()}
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&state.open&&!expanded())toggle(false);
 });

 function update(pageKey,hash){
  if(pageKey!=='chat')previousLessonPage=hash;
  onPage(pageKey);
 }
 return {update,showMini:()=>toggle(true)};
}
