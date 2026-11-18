import {sameOriginFetch as fetch} from '../request.js';
import {createVoice} from './tutor-voice.js?v=1';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons={
 chat:'<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',
 expand:'<path d="M14 4h6v6m-10 10H4v-6m16-10-6 6M4 20l6-6"/>',
 collapse:'<path d="M4 14h6v6m10-10h-6V4m0 6 6-6M4 20l6-6"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 send:'<path d="m3 11 18-8-8 18-2-8-8-2Zm8 2L21 3"/>',
 speaker:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
 slow:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>'
};
const say=text=>'<button type="button" class="dlg-say" data-tutor="say" data-text="'+escapeHtml(text)+'" aria-label="Nghe câu này" aria-pressed="false" title="Nghe">'+icon('speaker')+'</button>';
const VOICE_KEY='fangschool-tutor-voice';
const voiceSettings=(()=>{
 try{return {auto:true,slow:false,...JSON.parse(localStorage.getItem(VOICE_KEY)??'{}')}}catch{return {auto:true,slow:false}}
})();
const saveVoice=()=>{try{localStorage.setItem(VOICE_KEY,JSON.stringify(voiceSettings))}catch{}};
const icon=name=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+icons[name]+'</svg>';
const modes={explain:'Hỏi & giải thích',correct:'Sửa câu',dialogue:'Luyện hội thoại'};
const suggestions={
 explain:['“的” và “得” khác nhau thế nào?','Cho mình 3 câu ví dụ ở trình độ này.'],
 correct:['Sửa câu tiếng Trung mình viết.','Giải thích thứ tự từ trong câu của mình.'],
 dialogue:['Luyện hội thoại gọi món với mình.','Luyện hội thoại hỏi đường với mình.']
};
const placeholders={
 explain:'Nhập câu hỏi của bạn…',
 correct:'Dán câu tiếng Trung cần sửa…',
 dialogue:'Trả lời bằng tiếng Trung (chữ Hán hoặc pinyin)…'
};
const scenarios=[
 {zh:'点菜',label:'Gọi món ở nhà hàng',note:'Bạn là khách, AI là phục vụ'},
 {zh:'问路',label:'Hỏi đường',note:'Hỏi cách đi đến nơi cần tới'},
 {zh:'买东西',label:'Mua sắm & trả giá',note:'Hỏi giá, chọn hàng, mặc cả'},
 {zh:'认识朋友',label:'Làm quen bạn mới',note:'Giới thiệu bản thân, sở thích'},
 {zh:'打车',label:'Đi taxi',note:'Báo điểm đến, hỏi giá cước'},
 {zh:'住酒店',label:'Nhận phòng khách sạn',note:'Đặt phòng, hỏi tiện ích'}
];
const workplaceScenarios={
 41:[{zh:'车间',label:'Nhận việc ở xưởng',note:'Nhận việc, báo tiến độ với tổ trưởng'},{zh:'安全',label:'An toàn lao động',note:'Hỏi và nhắc quy định an toàn'}],
 42:[{zh:'开会',label:'Họp & báo cáo',note:'Báo cáo công việc với quản lý'},{zh:'打电话',label:'Gọi điện công việc',note:'Hẹn lịch, nhận và chuyển lời'}]
};
const START='Bắt đầu tình huống:';
const FINISH='Kết thúc buổi luyện và nhận xét giúp mình.';
// AI trả lời hội thoại theo nhãn [Bối cảnh] [Sửa] [中] [拼] [Việt] [Gợi ý] [Tổng kết]; tin cũ hoặc trả lời lệch định dạng thì hiện như chữ thường.
const dialogueTags={'Bối cảnh':'scene','Sửa':'fix','中':'zh','拼':'py','Việt':'vi','Gợi ý':'hint','Tổng kết':'summary'};
const tagPattern=/^\s*(?:[-*]\s*)?\**\[(Bối cảnh|Sửa|中|拼|Việt|Gợi ý|Tổng kết)\]\**\s*[:：]?\s*/;
function parseDialogue(text){
 const parts=[];
 for(const raw of String(text??'').split('\n')){
  const match=raw.match(tagPattern);
  if(match)parts.push({kind:dialogueTags[match[1]],text:raw.slice(match[0].length).trim()});
  else if(parts.length)parts.at(-1).text+=(parts.at(-1).text?'\n':'')+raw.trim();
  else if(raw.trim())parts.push({kind:'note',text:raw.trim()});
 }
 for(const part of parts)part.text=part.text.trim();
 return parts.some(part=>part.kind==='zh'||part.kind==='summary')?parts.filter(part=>part.text):null;
}
const hintText=text=>text.split('\n')[0].replace(/\s*[（(][^）)]*[）)]\s*$/u,'').trim();
function dialogueCard(parts,latest){
 let html='',line=null;
 const flush=()=>{
  if(!line)return;
  html+='<div class="dlg-line">'+(line.zh?'<div class="dlg-zh-row"><p class="dlg-zh han" lang="zh-CN">'+escapeHtml(line.zh)+'</p>'+say(line.zh)+'</div>':'')+
   (line.py?'<p class="dlg-py">'+escapeHtml(line.py)+'</p>':'')+(line.vi?'<p class="dlg-vi">'+escapeHtml(line.vi)+'</p>':'')+'</div>';
  line=null;
 };
 for(const part of parts){
  if(part.kind==='zh'){flush();line={zh:part.text}}
  else if(part.kind==='py'||part.kind==='vi'){if(line?.[part.kind])flush();line??={};line[part.kind]=part.text}
  else{
   flush();
   if(part.kind==='scene')html+='<p class="dlg-scene"><span class="dlg-tag">Bối cảnh</span><span>'+escapeHtml(part.text)+'</span></p>';
   else if(part.kind==='fix')html+='<div class="dlg-fix"><strong>Sửa câu</strong><p class="lines">'+escapeHtml(part.text)+'</p></div>';
   else if(part.kind==='summary')html+='<div class="dlg-summary"><strong>Tổng kết buổi luyện</strong><p class="lines">'+escapeHtml(part.text)+'</p></div>';
   else if(part.kind==='hint')html+=latest
    ?'<div class="dlg-hint"><button type="button" class="dlg-hint-use" data-tutor="hint" data-text="'+escapeHtml(hintText(part.text))+'" title="Dùng câu này làm câu trả lời"><small>Gợi ý trả lời · bấm để dùng</small><span class="han" lang="zh-CN">'+escapeHtml(part.text)+'</span></button>'+say(hintText(part.text))+'</div>'
    :'<div class="dlg-hint static"><div class="dlg-hint-use"><small>Gợi ý trả lời</small><span class="han" lang="zh-CN">'+escapeHtml(part.text)+'</span></div>'+say(hintText(part.text))+'</div>';
   else html+='<p class="lines">'+escapeHtml(part.text)+'</p>';
  }
 }
 flush();
 return html;
}
const date=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
const byId=id=>document.getElementById(id);

// weakWords(n): từ của bài n người học còn chưa vững (để AI lồng vào hội thoại);
// onDialogue(): báo cho trang học biết đã luyện hội thoại hôm nay.
export function createTutorChat({courseId,courseName,lessonAt,lessonOptions,navigate,weakWords=()=>[],onDialogue=()=>{}}){
 const state={open:false,mode:'explain',context:'auto',turns:[],threads:[],id:null,draft:'',pending:'',error:'',loading:false,historyBusy:false,hasHistory:false,hasOlder:false};
 let previousPage='',previousLessonPage='';
 const voice=createVoice({onChange:paintVoice});
 voice.setRate(voiceSettings.slow?.75:1);
 const setError=text=>{state.error=text;if(visible())sync()};
 const speak=texts=>voice.play(texts).catch(error=>setError(error.message));
 // Cập nhật nút nghe và micro tại chỗ, không vẽ lại cả khung chat (giữ nguyên vị trí cuộn).
 function paintVoice(){
  for(const item of document.querySelectorAll('[data-tutor="say"]')){
   const active=item.dataset.text===voice.speaking;
   item.classList.toggle('playing',active);
   item.setAttribute('aria-pressed',String(active));
  }
  const mic=document.querySelector('[data-tutor="mic"]');
  if(mic){
   const mode=voice.listening;
   mic.classList.toggle('live',mode==='listening');
   mic.setAttribute('aria-pressed',String(mode==='listening'));
   mic.disabled=mode==='processing'||Boolean(state.pending||state.loading);
   mic.innerHTML=icon(mode==='listening'?'stop':'mic')+'<span>'+(mode==='listening'?'Dừng':mode==='processing'?'Đang nhận dạng…':'Nói')+'</span>';
  }
  const input=byId('chat-input');
  if(input&&state.mode==='dialogue')input.placeholder=voice.listening==='listening'?'Đang nghe… hãy nói bằng tiếng Trung':voice.listening==='processing'?'Đang nhận dạng giọng nói…':placeholders.dialogue;
 }
 function quiet(){voice.stop();voice.cancelListening()}
 function startListening(){
  if(state.error){state.error='';sync()}
  const fill=text=>{
   state.draft=text;
   const input=byId('chat-input');
   if(input)input.value=text;
   return input;
  };
  voice.listen({
   onText:fill,
   onDone:text=>{
    const input=fill(text);
    input?.focus({preventScroll:true});
    input?.setSelectionRange(text.length,text.length);
   },
   onError:setError
  });
 }
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
 const message=(role,content,latest=false)=>{
  const text=String(content??'');
  if(role==='mine'&&text.startsWith(START))return '<div class="dlg-start" role="note" aria-label="Bắt đầu tình huống"><span>'+escapeHtml(text.slice(START.length).trim())+'</span></div>';
  const parts=role==='theirs'?parseDialogue(text):null;
  if(parts)return '<article class="chat-message theirs dialogue" aria-label="Trợ giảng FangSchool">'+avatar()+'<div class="dlg-card">'+dialogueCard(parts,latest)+'</div></article>';
  return '<article class="chat-message '+role+'" aria-label="'+(role==='mine'?'Bạn':'Trợ giảng FangSchool')+'">'+
   (role==='theirs'?avatar():'')+'<p class="lines">'+escapeHtml(text)+'</p></article>';
 };
 // Lời mở hội thoại theo bài, kèm tối đa 6 từ người học còn yếu để AI dùng lại trong hội thoại.
 const lessonStart=lesson=>{
  const words=(weakWords(lesson)??[]).slice(0,6);
  return 'theo bài đang học (Bài '+lesson+')'+(words.length?' · từ cần ôn: '+words.join('、'):'');
 };
 const scenarioList=()=>{
  const lesson=context().lesson;
  return [...(lesson===null?[]:[{zh:'课文',label:'Theo bài đang học',note:'Dùng từ và mẫu câu của bài '+lesson,start:lessonStart(lesson),featured:true}]),
   ...(workplaceScenarios[courseId]??[]),...scenarios];
 };
 const scenarioPicker=()=>'<div class="dlg-scenarios"><p><strong>Chọn tình huống để bắt đầu.</strong> AI sẽ đóng vai, nói theo trình độ '+escapeHtml(courseName)+', sửa lỗi và gợi ý câu trả lời cho bạn. Bạn cũng có thể tự mô tả tình huống ở ô bên dưới.</p>'+
  '<div class="dlg-grid">'+scenarioList().map((item,i)=>'<button type="button" data-tutor="scenario-'+i+'"'+(item.featured?' class="featured"':'')+'><span class="han" lang="zh-CN">'+escapeHtml(item.zh)+'</span><strong>'+escapeHtml(item.label)+'</strong><small>'+escapeHtml(item.note)+'</small></button>').join('')+'</div></div>';
 const finished=()=>parseDialogue(state.turns.at(-1)?.answer)?.some(part=>part.kind==='summary')??false;
 const threadList=()=>'<aside class="tutor-history" aria-label="Lịch sử chat">'+
  button('+ Cuộc trò chuyện mới','new','btn primary')+
  '<section class="panel tutor-recent"><h2>Gần đây</h2>'+
  (state.threads.length?state.threads.map(thread=>'<button type="button" data-tutor="thread" data-thread="'+escapeHtml(thread.id)+'"'+(thread.id===state.id?' aria-current="true"':'')+
   '><strong>'+escapeHtml(thread.title)+'</strong><small>'+escapeHtml(modes[thread.mode]??modes.explain)+' · '+date.format(thread.updatedAt)+'</small></button>').join(''):state.historyBusy?'<p>Đang tải lịch sử…</p>':'<p>Chưa có cuộc trò chuyện.</p>')+
  (state.hasHistory?button('Xem thêm','more-history'):'')+'</section></aside>';
 const contextSelect=()=>'<label class="sr" for="tutor-context">Ngữ cảnh</label><select id="tutor-context">'+
  [['auto','Bài đang học'],['course','Toàn khóa '+courseName],['free','Hỏi tự do'],...lessonOptions()].map(([key,label])=>
   '<option value="'+key+'"'+(key===state.context?' selected':'')+'>'+escapeHtml(label)+'</option>').join('')+'</select>';

 function panel(full){
  const last=state.turns.length-1;
  const turns=state.turns.map((turn,i)=>message('mine',turn.question)+message('theirs',turn.answer,i===last&&!state.pending)).join('');
  const dialogue=state.mode==='dialogue';
  const waiting=state.pending?message('mine',state.pending)+message('theirs',dialogue?'Đang trả lời…':'Đang soạn câu trả lời…'):'';
  const empty=state.loading?'<p class="chat-example">Đang mở cuộc trò chuyện…</p>':dialogue?scenarioPicker():'<p class="chat-example">Bạn muốn hỏi gì về tiếng Trung?</p>';
  const lock=state.pending||state.loading?' disabled':'';
  const finish=dialogue&&state.turns.length&&!finished()?'<button type="button" class="btn" data-tutor="finish"'+lock+'>Kết thúc & nhận xét</button>':'';
  return '<section class="panel chat-panel'+(full?'':' tutor-mini')+'" id="tutor-panel" aria-label="Trợ giảng FangSchool">'+
   '<header class="tutor-panel-header">'+avatar()+'<div class="tutor-panel-title"><strong>Trợ giảng FangSchool</strong><small>'+escapeHtml(contextLabel())+'</small></div>'+
   (full?contextSelect()+button('Thu nhỏ','minimize','tutor-icon','collapse'):button('Phóng to','expand','tutor-icon','expand')+button('Đóng chat','close','tutor-icon','close'))+'</header>'+
   '<div class="chat-thread" id="chat-thread" role="log" aria-label="Cuộc trò chuyện" aria-live="polite">'+
   (state.hasOlder?button('Xem tin nhắn cũ hơn','older'):'')+(turns+waiting||empty)+'</div>'+
   (state.error?'<p role="alert" class="chat-error">'+escapeHtml(state.error)+'</p>':'')+
   '<form id="chat-form" class="chat-form">'+
    (full&&!dialogue&&!state.turns.length&&!state.pending?'<div class="tutor-suggestions">'+suggestions[state.mode].map((label,i)=>button(label,'suggest-'+i)).join('')+'</div>':'')+
    '<label class="sr" for="chat-input">Câu hỏi của bạn</label><textarea id="chat-input" name="message" rows="'+(full?3:2)+'" maxlength="500" required'+
    ' placeholder="'+placeholders[state.mode]+'"'+lock+'>'+escapeHtml(state.draft)+'</textarea>'+
    '<div class="tutor-compose">'+(dialogue
     ?'<div class="tutor-voice">'+(voice.canListen()?'<button type="button" class="btn tutor-mic" data-tutor="mic" aria-pressed="false" title="Nói câu trả lời bằng tiếng Trung"'+lock+'>'+icon('mic')+'<span>Nói</span></button>':'')+
      '<button type="button" class="tutor-toggle" data-tutor="voice-auto" aria-pressed="'+voiceSettings.auto+'" title="Tự đọc câu trả lời của AI">'+icon('speaker')+'Tự đọc</button>'+
      '<button type="button" class="tutor-toggle" data-tutor="voice-slow" aria-pressed="'+voiceSettings.slow+'" title="Đọc chậm hơn">'+icon('slow')+'Chậm</button></div>'
     :'<small>Enter để gửi · Shift+Enter xuống dòng. AI có thể nhầm, hãy đối chiếu với bài học.</small>')+finish+'<button type="submit" class="btn primary"'+lock+'>'+icon('send')+' Gửi</button></div>'+
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
  paintVoice();
 }

 function onPage(pageKey){
  if(pageKey==='chat'&&previousPage!=='chat'){
   state.open=false;
   void loadHistory();
  }
  previousPage=pageKey;
  if(!visible())quiet();
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
  if(!older)quiet();
  state.loading=true;
  state.error='';
  const thread=byId('chat-thread');
  const distance=thread?thread.scrollHeight-thread.scrollTop:0;
  if(!older)sync();
  try{
   const response=await request('history?id='+encodeURIComponent(id)+(older?'&before='+state.turns[0].id:''));
   state.id=id;
   if(Object.hasOwn(modes,response.conversation?.mode))state.mode=response.conversation.mode;
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

 async function send(text){
  if(text!==undefined){
   if(state.pending||state.loading)return;
   state.draft=text;
  }
  const value=state.draft.trim();
  if(!value||state.pending||state.loading)return;
  const mode=state.mode;
  let readAloud=[];
  quiet();
  if(mode==='dialogue'&&voiceSettings.auto)voice.unlock();
  state.pending=value;
  state.draft='';
  state.error='';
  sync();
  try{
   const response=await request('chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:value,id:state.id,mode,...context()})});
   state.id=response.conversation.id;
   state.turns.push(response.turn);
   state.threads=[response.conversation,...state.threads.filter(item=>item.id!==state.id)];
   if(mode==='dialogue')onDialogue();
   if(mode==='dialogue'&&voiceSettings.auto)readAloud=parseDialogue(response.turn.answer)?.filter(part=>part.kind==='zh').map(part=>part.text)??[];
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
  if(readAloud.length&&visible())void speak(readAloud);
 }

 function toggle(open){
  state.open=open;
  if(!open)quiet();
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
   quiet();
   Object.assign(state,{id:null,turns:[],draft:'',error:'',hasOlder:false});
   sync();
   byId('chat-input')?.focus();
  }else if(action==='thread')void loadThread(trigger.dataset.thread);
  else if(action==='more-history')void loadHistory(true);
  else if(action==='older'&&state.id&&state.turns[0]?.id)void loadThread(state.id,true);
  else if(action.startsWith('mode-')&&Object.hasOwn(modes,action.slice(5))){
   const mode=action.slice(5);
   // Mỗi cuộc trò chuyện gắn với một chế độ; đổi chế độ thì mở cuộc mới.
   if(mode!==state.mode&&(state.id||state.turns.length)&&!state.pending&&!state.loading){
    quiet();
    Object.assign(state,{id:null,turns:[],error:'',hasOlder:false});
   }
   if(!state.pending&&!state.loading)state.mode=mode;
   sync();
   document.querySelector('[data-tutor="'+action+'"]')?.focus();
  }else if(action.startsWith('suggest-')){
   state.draft=suggestions[state.mode][Number(action.slice(8))]??'';
   sync();
   byId('chat-input')?.focus();
  }else if(action.startsWith('scenario-')){
   const item=scenarioList()[Number(action.slice(9))];
   if(item)void send(START+' '+(item.start??item.label+' ('+item.zh+')'));
  }else if(action==='finish')void send(FINISH);
  else if(action==='say'&&trigger.dataset.text)void speak([trigger.dataset.text]);
  else if(action==='mic'&&!state.pending&&!state.loading)startListening();
  else if(action==='voice-auto'||action==='voice-slow'){
   const key=action==='voice-auto'?'auto':'slow';
   voiceSettings[key]=!voiceSettings[key];
   saveVoice();
   trigger.setAttribute('aria-pressed',String(voiceSettings[key]));
   if(key==='slow')voice.setRate(voiceSettings.slow?.75:1);
   else if(!voiceSettings.auto)voice.stop();
  }
  else if(action==='hint'&&trigger.dataset.text){
   state.draft=trigger.dataset.text;
   sync();
   const input=byId('chat-input');
   input?.focus();
   input?.setSelectionRange(input.value.length,input.value.length);
  }
 });
 document.addEventListener('input',event=>{if(event.target.id==='chat-input')state.draft=event.target.value});
 document.addEventListener('keydown',event=>{
  // Enter gửi, Shift+Enter xuống dòng; bỏ qua khi đang gõ bộ gõ tiếng Trung (IME) và trên điện thoại.
  if(event.target.id!=='chat-input'||event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229||mobile.matches)return;
  event.preventDefault();
  void send();
 });
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
 // Mở cuộc trò chuyện mới với một câu hỏi soạn sẵn (ví dụ "Vì sao câu này sai?") ngay trên trang đang học.
 function startFresh(mode,lesson){
  if(state.pending||state.loading)return false;
  quiet();
  Object.assign(state,{mode,id:null,turns:[],draft:'',error:'',hasOlder:false});
  if(lesson!==null&&lesson!==undefined&&lessonOptions().some(([key])=>key===String(lesson)))state.context=String(lesson);
  return true;
 }
 function ask(text,{lesson=null,mode='explain'}={}){
  if(!startFresh(mode,lesson))return false;
  if(!expanded())state.open=true;
  sync();
  void send(String(text).slice(0,500));
  return true;
 }
 // Mở trang Hỏi AI ở chế độ hội thoại và bắt đầu ngay tình huống theo bài.
 function startLessonDialogue(lesson){
  if(!startFresh('dialogue',lesson))return false;
  state.open=false;
  navigate('chat');
  void send(START+' '+lessonStart(lesson));
  return true;
 }
 return {update,showMini:()=>toggle(true),ask,startLessonDialogue};
}
