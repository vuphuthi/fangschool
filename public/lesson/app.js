import {createTutorChat} from './tutor-chat.js';
import {sameOriginFetch as fetch} from '../request.js';
import {createExamCenter} from './exams.js?v=12';
import {openProgress} from './study-progress.js?v=3';
import {goalChoices,ensureStudy,addMinute,streak,lastWeek,todayMinutes,heatmap,nextStep,rateCard,dueQueue,predictScore} from './study-habits.js?v=1';
import {assessmentPlan,lessonSkill,lessonSkills,grammarModes,bankGroups,bankNames,kinds} from './study-common.js';
import {playRecording, setAudioRate, stopAudio} from './audio-player.js?v=4';
import {flashcardReaderKey,flashcardReaders} from './reader-options.js';
const sessionResponse=await fetch('/api/session');
if(!sessionResponse.ok){
 if(sessionResponse.status===401)location.reload();
 else document.getElementById('app').textContent='Chưa xác minh được phiên học. Vui lòng tải lại trang.';
 throw new Error('Chưa xác minh được phiên học.');
}
const viewer=await sessionResponse.json();
let audioFiles={};
const $=id=>document.getElementById(id);
const icons={book:'<path d="M12 7v14M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>',home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-6h6v6"/>',shuffle:'<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>',bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',chart:'<path d="M3 3v18h18M8 16v-5m5 5V6m5 10V9"/>',teacher:'<path d="m2 9 10-5 10 5-10 5zM6 11v5c4 4 8 4 12 0v-5m4-2v8"/>',moon:'<path d="M20 15a8.5 8.5 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',chev:'<path d="m9 6 6 6-6 6"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',check:'<path d="m5 12 5 5 9-10"/>',text:'<path d="M3 6V4h18v2M12 4v16m-4 0h8"/>',head:'<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 13h4v7H5a2 2 0 0 1-2-2zm18 0h-4v7h2a2 2 0 0 0 2-2z"/>',audio:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'};
const svg=(s,css='')=>'<svg aria-hidden="true" class="'+css+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'+(icons[s]??icons.book)+'</svg>';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const course=params.has('hsk')?Number(params.get('hsk')):Math.min(viewer.maxLevel,2);
const track=params.get('track');
const trackNames={factory:'Công xưởng',office:'Văn phòng'};
const trackIds={factory:41,office:42};
const isWorkplace=Object.hasOwn(trackIds,track);
const isEdition30=params.get('edition')==='3.0';
const courseId=isWorkplace?trackIds[track]:isEdition30?30+course:course;
const courseName=isWorkplace?trackNames[track]:'HSK '+course+(isEdition30?' · 3.0':'');
const lessonCount=()=>lessons.filter(l=>l.n<100).length;
const lessonLabel=n=>n>=100?'Ngữ âm '+(n-100):'Bài '+n;
const locationLabel=q=>q.origin==='bank'?esc(q.topic):lessonLabel(q.lesson);
const baseQuery=isWorkplace?'?track='+track:'?hsk='+course+(isEdition30?'&edition=3.0':'');
const examDestination=()=>location.hash.startsWith('#exams')?'#exams':'';
const courseTabs=()=>'<nav class="course-tabs" aria-label="Khóa học">'+[1,2,3,4,31,32].filter(id=>(id>30?id-30:id)<=viewer.maxLevel).map(id=>{
 const updated=id>30,level=updated?id-30:id,active=id===courseId;
 return '<a class="course-tab'+(active?' active':'')+'" href="/?hsk='+level+(updated?'&amp;edition=3.0'+examDestination():examDestination())+'"'+(active?' aria-current="page"':'')+'>HSK '+level+(updated?' 3.0':'')+'</a>';
}).join('')+Object.keys(trackNames).filter(id=>viewer.tracks?.includes(id)).map(id=>'<a class="course-tab'+(id===track?' active':'')+'" href="/?track='+id+'"'+(id===track?' aria-current="page"':'')+'>'+trackNames[id]+'</a>').join('')+'</nav>';
const storageKey=key=>'bao-hsk'+(key==='settings'?2:courseId)+':'+viewer.email+':'+key;
function storage(key,fallback){try{return JSON.parse(localStorage.getItem(storageKey(key)))??fallback}catch{return fallback}}
function persist(key,val){try{localStorage.setItem(storageKey(key),JSON.stringify(val));return true}catch{notify('Trình duyệt đang chặn lưu dữ liệu.');return false}}
let state,syncProgress;
const settings=storage('settings',{theme:'light',lang:'vi',rate:1,hideZh:false,hidePy:false,showVi:false});
let catalog,exams,wordlist=[],levelQuestions=[],lessons=[],questions=[],quiz=storage('session',null),flash=0,flip=false,expanded=false,timeout,teacherLesson=1;
const edits=storage('content',{});
const names={listening:['Luyện nghe','Listening','听力练习'],exams:['Đề ôn thi','Mock exams','模拟试卷'],bank:['Luyện theo cấp HSK','Practice by HSK level','按HSK等级练习'],home:['Tổng quan','Overview','首页'],lessons:['Bài học','Lessons','课程'],practice:['Ôn tập tổng hợp','Mixed review','综合复习'],review:['Cần ôn lại','Review list','待复习'],progress:['Tiến độ','Progress','学习进度'],teacher:['Câu hỏi & lượt ôn','Questions & review sets','题目与复习'],lesson:['Ôn theo bài','Lesson review','单课复习'],quiz:['Làm câu hỏi','Practice','答题']};
const tr=(vi,en,zh)=>({vi,en,zh}[settings.lang]||vi);
const save=()=>syncProgress.save();
const saveQuiz=()=>persist('session',quiz);
const button=(label,action,icon='',type='',attrs='')=>'<button type="button" class="btn '+type+'" '+attrs+' data-action="'+esc(action)+'">'+(icon?svg(icon):'')+esc(label)+'</button>';
const badge=(x,cl='')=>'<span class="label '+cl+'">'+esc(x)+'</span>';
const meter=(p)=>'<div class="meter" role="progressbar" aria-label="Tiến độ" aria-valuenow="'+p+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+p+'%"></i></div>';
const heading=(h,p='')=>'<div class="heading"><h1>'+esc(h)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</div>';
const inform=(s,ty='')=>'<div class="info '+ty+'">'+esc(s)+'</div>';
const go=(page)=>{if(location.hash==='#'+page){render();return}location.hash=page};
const getLesson=n=>lessons.find(l=>l.n===+n)??lessons[0];
const getQuestion=id=>questions.find(q=>q.id===id);
function notify(s){$('toast').textContent=s;clearTimeout(timeout);timeout=setTimeout(()=>$('toast').textContent='',4300)}
function refreshData(){
 lessons=catalog.lessons.map(lesson=>({...lesson}));
 for(const l of lessons){
  const o=edits[l.n];
  if(!o)continue;
  const custom=o.questions??[];
  l.questions=[...l.questions.filter(q=>!custom.some(c=>c.id===q.id)),...custom.map(q=>({...q,lesson:l.n,origin:'teacher'}))];
  if(o.vocab)l.vocab=o.vocab;
 }
 levelQuestions=catalog.levelQuestions;
 questions=[...lessons.flatMap(l=>l.questions),...levelQuestions];
}
const navs=[['home','home'],['lessons','book'],['bank','target'],['listening','head'],['exams','text'],['practice','shuffle'],['review','bookmark'],['progress','chart']];
function chrome(page){
 document.documentElement.dataset.theme=settings.theme;
 document.documentElement.lang=settings.lang==='zh'?'zh-CN':settings.lang;
 const title=k=>k==='chat'?tr('Hỏi AI','Ask AI','AI 助教'):isWorkplace&&k==='bank'?'Ngân hàng luyện tập':tr(...(names[k]??names.home));
 $('sidebar').innerHTML='<div class="brand"><span class="brand-mark">'+svg('book')+'</span><span>Fang<em>School</em></span></div><div class="nav-label">'+tr('HỌC TẬP','STUDY','学习')+'</div>'+
 navs.filter(([k])=>k!=='exams'&&k!=='listening'||k==='exams'&&catalog?.examCatalog||k==='listening'&&isWorkplace).map(([k,i])=>'<button class="nav '+((page===k||(page==='lesson'&&k==='lessons'))?'active':'')+'" data-action="go:'+k+'">'+svg(i)+esc(title(k))+'</button>').join('')+
 (tutor?'<button class="nav '+(page==='chat'?'active':'')+'" data-action="go:chat">'+svg('text')+esc(title('chat'))+'</button>':'')+
 (viewer.admin?'<div class="nav-label">QUẢN LÝ</div><a class="nav" href="/admin">'+svg('teacher')+'Quyền truy cập</a><a class="nav" href="/admin/progress">'+svg('chart')+'Tiến độ học viên</a><a class="nav" href="/admin/sources">'+svg('text')+'Nguồn học liệu</a><button class="nav '+(page==='teacher'?'active':'')+'" data-action="go:teacher">'+svg('book')+esc(title('teacher'))+'</button>':'')+
 '<div class="side-foot side-user"><div class="row"><span class="avatar" aria-hidden="true">'+esc((viewer.email[0]||'?').toUpperCase())+'</span><div class="grow"><b>'+esc(viewer.email)+'</b><small>'+(viewer.admin?'Quản trị viên':'Học viên')+'</small></div></div>'+button('Đăng xuất','logout')+'</div>';

 $('top').innerHTML='<div class="crumb"><button class="iconbtn mobile" data-action="drawer" aria-label="Menu">'+svg('menu')+'</button><span class="crumb-brand">FangSchool</span><span aria-hidden="true">/</span><b>'+esc(title(page))+'</b></div>'+courseTabs()+'<div class="top-actions"><label class="row" aria-label="Ngôn ngữ">'+svg('globe')+'<select id="language" aria-label="Ngôn ngữ"><option value="vi">VI</option><option value="en">EN</option><option value="zh">中文</option></select></label><button class="iconbtn" data-action="theme" aria-label="Giao diện sáng/tối">'+svg(settings.theme==='dark'?'sun':'moon')+'</button></div>';
 $('language').value=settings.lang;
}
const graded=()=>state.attempts.filter(a=>a.grade===true||a.grade===false);
const stats=()=>{
 const gs=graded(),correct=gs.filter(a=>a.grade).length;
 return [[state.history.filter((a,i,arr)=>a.final&&a.final<100&&arr.findIndex(b=>b.final===a.final)===i).length+'/'+lessonCount(),tr('Bài hoàn thành','Lessons completed','已完成课程'),'book'],[state.attempts.length,tr('Câu đã luyện','Answers submitted','已练习题目'),'bolt'],[gs.length?Math.round(100*correct/gs.length)+'%':'—',tr('Tỷ lệ đúng','Accuracy','正确率'),'target'],[Object.values(state.words).filter(w=>w==='known').length,tr('Từ đã thuộc','Words learned','已掌握词汇'),'check']];
};
const statCards=()=>'<div class="grid4 stats">'+stats().map(([v,l,i])=>'<div class="stat"><div class="iconbox">'+svg(i)+'</div><div><strong>'+esc(v)+'</strong><small>'+esc(l)+'</small></div></div>').join('')+'</div>';
const lessonCard=l=>'<button class="lesson" data-action="go:lesson/'+l.n+'"><span class="num">'+(l.n>=100?'Â'+(l.n-100):String(l.n).padStart(2,'0'))+'</span><div><h3 class="han" lang="zh-CN">'+esc(l.zh)+'</h3><small>'+esc(l.vi)+'</small></div>'+svg('chev','chevron')+'</button>';
const skillNames=[0,1,2,4];
const skills=()=>'<section class="skills"><div class="section-head"><h2>'+tr('Luyện theo kỹ năng','Practice by skill','分技能练习')+'</h2></div><div class="grid4">'+skillNames.map((i,j)=>({i,j})).map(({i,j})=>'<button class="skill" data-action="'+(isWorkplace&&i===2?'go:listening':'preset:'+i)+'"><span class="iconbox">'+svg(['text','book','head','shuffle'][j])+'</span><b>'+esc(kinds[i])+'</b></button>').join('')+'</div></section>';
// ===== Mục tiêu hôm nay, chuỗi ngày và ôn thẻ lặp lại ngắt quãng =====

// ===== Nhịp học 16 tuần và dự đoán điểm =====

// Đếm phút học khi tab đang mở và có thao tác trong 2 phút gần nhất.
let lastInput=Date.now(),unsavedMinutes=0;
for(const type of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(type,()=>{lastInput=Date.now()},{passive:true,capture:true});
function tickMinute(){
 if(!state||document.visibilityState!=='visible'||Date.now()-lastInput>120_000)return;
 const before=todayMinutes(state),minutes=addMinute(state),goal=ensureStudy(state).goal;
 unsavedMinutes++;
 if(before<goal&&minutes>=goal){notify(tr('Đạt mục tiêu hôm nay! 太棒了！','Daily goal reached! 太棒了！','今日目标达成！'));unsavedMinutes=3}
 if(unsavedMinutes>=3){unsavedMinutes=0;save()}
 const card=$('goal-card');if(card)card.outerHTML=goalCard();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&unsavedMinutes&&state){unsavedMinutes=0;save()}});

const voiceKey=(text,pinyin)=>flashcardReaderKey({zh:text,pinyin});
const selectedReader=()=>Object.hasOwn(flashcardReaders,settings.flashcardReader)?settings.flashcardReader:'current';
function readerSource(text,reader){
 const {readers,sequences}=catalog.flashcardAudio;
 const files=readers[reader];
 const direct=Object.hasOwn(files,text)?files[text]:undefined;
 if(direct)return direct;
 if(reader==='current'&&Object.hasOwn(audioFiles,text))return audioFiles[text];
 const parts=Object.hasOwn(sequences,text)?sequences[text]:null;
 const clips=parts?.map(part=>Object.hasOwn(files,part)?files[part]:reader==='current'&&Object.hasOwn(audioFiles,part)?audioFiles[part]:undefined);
 return clips?.length&&clips.every(Boolean)?(clips.length===1?clips[0]:clips):undefined;
}
function audioChoice(text,reader=selectedReader()){
 if(!text)return null;
 for(const candidate of new Set([reader,'current','a','b'])){
  const source=readerSource(text,candidate);
  if(source)return {source,reader:candidate};
 }
 return null;
}
const canPlay=(text,pinyin)=>Boolean(audioChoice(voiceKey(text,pinyin)));
const audioButton=(text,label='Phát âm',type='',requireReader=false)=>{
 if(!text)return '';
 const reader=selectedReader();
 const choice=audioChoice(text);
 if(!choice||requireReader&&choice.reader!==reader)return requireReader?'':'<small>Chưa có bản đọc.</small>';
 const name=text.startsWith('hsk4-recording:')&&choice.reader==='current'?'Bản thu gốc':flashcardReaders[choice.reader];
 const caption=choice.reader===reader&&!text.startsWith('hsk4-recording:')?label:label+' · '+name;
 return button(caption,'speak:'+text,'audio',type,'aria-pressed="false" title="'+esc(name)+'"');
};
const mastery=(items)=>{
 const attempts=new Map(state.attempts.map(a=>[a.id,a]));
 return {done:items.filter(q=>attempts.has(q.id)).length,wrong:items.filter(q=>attempts.get(q.id)?.grade===false).length};
};
const courseQuiz=(lesson,suffix)=>lesson.questions.find(q=>q.id==='guided-'+course+'-'+lesson.n+'-'+suffix);
const questionAction=(q,label,type='')=>q?button(label,'one:'+q.id,'arrow',type):'';
const nextStage=(l,tab,label)=>'<div class="stage-next">'+button(label,'go:lesson/'+l.n+'/'+tab,'arrow','primary')+'</div>';
const playbackRate=()=>'<div class="wrap audio-controls"><label>Tốc độ <select id="rate" aria-label="Tốc độ phát">'+[.75,1,1.25].map(x=>'<option '+(settings.rate===x?'selected':'')+' value="'+x+'">'+x+'×</option>').join('')+'</select></label></div>';
function readerControls(){
 const reader=selectedReader();
 return '<div class="reader-settings"><div class="wrap"><label for="flashcard-reader">Người đọc <select id="flashcard-reader">'+
  Object.entries(flashcardReaders).map(([id,label])=>'<option value="'+id+'"'+(id===reader?' selected':'')+'>'+esc(label)+'</option>').join('')+
  '</select></label>'+button('Nghe thử','reader-preview','audio','','aria-pressed="false"')+'</div>'+playbackRate()+'</div>';
}
function questionAudio(q,label){
 const text=voiceKey(q.audio??q.zh,q.pinyin);
 if(!text?.startsWith('hsk4-recording:'))return audioButton(text,label);
 const [,lesson,part]=text.split(':');
 const original=getLesson(lesson).dialogues.find(d=>d.part===+part&&(d.recording||Object.hasOwn(audioFiles,'original-'+lesson+'-'+d.i+'.mp3')));
 return (original?button('Nghe bản thu gốc','original-audio:'+lesson+':'+original.i,'audio','','aria-pressed="false"'):'')+
  (selectedReader()==='current'?'':audioButton(text,'Nghe bản đọc bài khóa','',true));
}
const flashcardVoiceControls=word=>readerControls()+'<div class="wrap" aria-live="polite">'+audioButton(voiceKey(word.zh,word.pinyin),'Phát âm','primary')+'</div>';
const dialogueAudio=(lesson,dialogue)=>{
 const text=dialogue.utterances.map(x=>x.zh).join(' ');
 const original=Boolean(dialogue.recording)||course===2&&!isEdition30&&Object.hasOwn(audioFiles,'original-'+lesson.n+'-'+dialogue.i+'.mp3');
 const recorded='hsk4-recording:'+lesson.n+':'+dialogue.part;
 const selected=selectedReader();
 const alternate=dialogue.recording&&selected==='current'?'':audioButton(dialogue.recording?recorded:text,'Nghe toàn bài',original?'':'primary',original);
 return alternate+(original?button('Nghe bản thu gốc','original-audio:'+lesson.n+':'+dialogue.i,'audio','primary','aria-pressed="false"'):'');
};
const curriculumItems=(l,mode)=>l.questions.filter(q=>q.origin==='curriculum'&&q.mode===mode&&(!q.audio||canPlay(q.audio,q.pinyin)));
const workplaceAudioQuestions=(items)=>items.filter(q=>q.kind===2&&q.audio&&canPlay(q.audio,q.pinyin));
function workplaceListeningPage(){
 if(!isWorkplace)return home();
 const items=workplaceAudioQuestions(lessons.flatMap(lesson=>lesson.questions));
 const dictation=items.filter(q=>!q.options?.length&&q.answers?.length);
 const listenCards=lessons.filter(l=>l.extension).map(l=>'<section class="panel"><div class="row split"><div><h3>'+esc(l.zh)+'</h3><small>'+esc(l.subtitle)+'</small></div>'+
  button('Nghe theo bài','go:lesson/'+l.n+'/listen','head')+'</div></section>').join('');
 return heading('Luyện nghe · '+courseName,'Nghe Quan thoại, trả lời theo tình huống hoặc gõ lại câu vừa nghe.')+
  '<section class="panel"><div class="row split"><div><h2>Luyện theo dạng</h2><p>'+items.length+' câu có audio · '+dictation.length+' câu chép chính tả</p></div>'+readerControls()+'</div>'+
  '<div class="wrap form-actions">'+button('Nghe và chọn đáp án','workplace-listen:choice','head','primary')+
  (dictation.length?button('Nghe chép chính tả','workplace-listen:dictation','text'):'')+'</div></section>'+
  '<div class="section-head form-actions"><h2>Nghe theo chủ đề</h2></div><div class="stage-grid">'+listenCards+'</div>';
}
function exerciseStage(l){
 const items=original(l).filter(q=>!q.resource);
 const closed=items.filter(q=>q.answers?.length),open=items.filter(q=>!q.answers?.length);
 const section=(title,description,items)=>items.length?'<details class="panel source"><summary>'+esc(title)+' · '+items.length+'</summary><p>'+esc(description)+'</p><div class="list-items">'+items.map(q=>'<button class="list-item" data-action="one:'+q.id+'"><span><small>'+esc(kinds[q.kind])+'</small><br>'+esc(q.prompt.replace(/\n/g,' ').slice(0,140))+'</span>'+svg('chev')+'</button>').join('')+'</div></details>':'';
 return stageInfo('Bước 3','Làm bài trực tuyến','Làm từng câu để nhận phản hồi hoặc đối chiếu với bài giải mẫu.')+
 '<div class="panel row split"><div><h3>'+mastery(items).done+' câu trong bài đã thử</h3><p>'+closed.length+' câu có đáp án mẫu · '+open.length+' câu tự luận</p></div><div class="wrap">'+(closed.length?button('Làm câu có đáp án','slide-closed:'+l.n,'arrow','primary'):'')+(open.length?button('Làm câu tự luận','slide-open:'+l.n):'')+(l.grammarPoints?.length?button('Luyện ngữ pháp','grammar-mode:'+l.n+':mixed'):'')+'</div></div>'+
 '<div class="stack form-actions">'+section('Có đáp án mẫu','Xem cách viết và giải thích sau khi nộp.',closed)+section('Tự luận và bài về nhà','Lưu câu trả lời để tự đối chiếu.',open)+'</div>'+nextStage(l,'extra','Tiếp theo · Luyện vận dụng');
}
function transferStage(l){
 const read=courseQuiz(l,'read'),apply=courseQuiz(l,'apply'),write=courseQuiz(l,'produce');
 const items=l.questions.filter(q=>q.origin==='extra');
 const translations=curriculumItems(l,'translate');
 return stageInfo('Bước 4','Vận dụng trong tình huống mới','Đọc để hiểu ý, chọn mẫu phù hợp rồi tự đặt câu. Các tình huống được soạn theo chủ điểm của bài.')+
 '<div class="stage-grid">'+[[read,'Hiểu ý','Tìm thông tin cần thiết trong đoạn ngắn.','Làm câu đọc'],[apply,'Chọn cách nói','Nhận ra mẫu câu phù hợp với ý cần diễn đạt.','Chọn mẫu câu'],[write,'Tự đặt câu','Viết theo yêu cầu, rồi đối chiếu câu mẫu và cách dùng.','Viết câu']].filter(([q])=>q).map(([q,title,description,label])=>'<article class="panel"><h3>'+title+'</h3><p>'+description+'</p><div class="form-actions">'+questionAction(q,label,'primary')+'</div></article>').join('')+'</div>'+
 (translations.length?'<section class="panel form-actions row split"><div><h3>Dịch theo mẫu câu của bài</h3><p>Viết bằng chữ Hán rồi so cách diễn đạt và trật tự từ với câu tham khảo.</p></div>'+button('Bắt đầu dịch · '+translations.length+' câu','grammar-mode:'+l.n+':translate','arrow')+'</section>':'')+
 '<section class="panel form-actions"><div class="row split"><div><h3>Bài luyện thêm · '+esc(l.topic??'')+'</h3><p>'+items.length+' câu tăng cường từ vựng và mẫu câu.</p></div>'+button('Luyện thêm','extra:'+l.n,'arrow')+'</div><div class="list-items">'+items.map(q=>'<button class="list-item" data-action="one:'+q.id+'"><span><small>'+esc(kinds[q.kind])+'</small><br>'+esc(q.prompt.trim())+'</span>'+svg('chev')+'</button>').join('')+'</div></section>'+
 (l.n<100?nextStage(l,'final','Tiếp theo · Kiểm tra cuối bài'):'');
}
function finalStage(l){
 const plan=assessmentPlan(l,canPlay);
 const last=state.history.filter(h=>h.final===l.n).at(-1);
 const running=quiz?.final===l.n&&!quiz.done;
 const counts=Object.entries(lessonSkills).map(([key,label])=>({label,count:plan.filter(q=>lessonSkill(q)===key).length})).filter(x=>x.count);
 return stageInfo('Bước 5','Kiểm tra cuối bài','Làm đề theo kỹ năng. Sau khi nộp toàn bộ, bạn sẽ nhận điểm, lời giải và có thể làm lại riêng các câu sai.')+
 '<section class="panel"><div class="row split"><div><h3>'+plan.length+' câu · '+lessonLabel(l.n)+'</h3><p>'+(last?'Lượt gần nhất: '+last.correct+'/'+last.graded+' câu đúng.':'Chưa có lượt kiểm tra hoàn thành.')+'</p></div>'+button(running?'Tiếp tục kiểm tra':last?'Làm đề mới':'Bắt đầu kiểm tra',running?'go:quiz':'final:'+l.n,'arrow','primary',plan.length?'':'disabled')+'</div>'+
 '<div class="stage-grid form-actions">'+counts.map(x=>'<div class="example-block"><strong>'+x.count+' câu</strong><small>'+esc(x.label)+'</small></div>').join('')+'</div>'+
 (plan.some(q=>q.kind===2)?'':'<p class="form-actions">Đề này dùng câu đọc hiểu khi bài chưa có bản thu phù hợp cho phần nghe.</p>')+
 (last?.skills?'<div class="wrap form-actions">'+Object.entries(last.skills).filter(([,v])=>v.correct<v.total||v.skipped).map(([k])=>button('Ôn lại '+lessonSkills[k].toLowerCase(),'lesson-weak:'+l.n+':'+k,'target')).join('')+'</div>':'')+'</section>';
}
function audioToggles(){return [['hideZh','Ẩn chữ Hán'],['hidePy','Ẩn pinyin'],['showVi','Xem bản dịch']].map(([k,l])=>'<label class="check"><input type="checkbox" data-setting="'+k+'" '+(settings[k]?'checked':'')+'>'+l+'</label>').join('')}
let preset=null;
const wrongQuestions=()=>{
 const last=new Map(state.attempts.filter(a=>a.grade!==null).map(a=>[a.id,a.grade]));
 return questions.filter(q=>last.get(q.id)===false);
};
const dueWords=()=>lessons.flatMap(l=>l.vocab.map((w,i)=>({...w,n:l.n,i}))).filter(w=>state.words[w.id]==='unknown');
const searchText=text=>text.toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/\p{M}|\s/gu,'');

const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const ranked=items=>{
 const last=new Map(state.attempts.map(a=>[a.id,a]));
 const weak=new Map();
 for(const a of state.attempts.slice(-120)){const q=getQuestion(a.id);if(q&&a.grade===false)weak.set(q.kind,(weak.get(q.kind)??0)+1)}
 const weight=q=>{const a=last.get(q.id);return (a?.grade===false?50:0)+(state.words[q.word]==='unknown'?35:0)+(weak.get(q.kind)??0)+(!a?8:Math.min(8,(Date.now()-a.at)/86400000))};
 return shuffle(items).sort((a,b)=>weight(b)-weight(a));
};
function balanceBySkill(pool){
 const groups=shuffle(bankNames).map(group=>shuffle(pool.filter(q=>q.group===group)));
 const result=[];
 while(groups.some(group=>group.length)){
  for(const group of groups)if(group.length)result.push(group.pop());
 }
 return result;
}
function start(items,title,count=items.length,mode='random',final=null,returnTo=null,practicePaper=null){
 const page=location.hash.slice(1);
 returnTo??=page.startsWith('lesson/')?page:null;
 const pool=[...new Map(items.filter(Boolean).filter(q=>!q.resource&&(!q.audio||lessonSkill(q)!=='listen'||canPlay(q.audio,q.pinyin))).map(q=>[q.id,q])).values()];
 if(!pool.length){notify('Chưa có câu tương tác cho bộ lọc này.');return}
 if(quiz&&!quiz.done&&quiz.answers.length&&!confirm('Bắt đầu lượt mới và kết thúc lượt đang làm?'))return;
 const order=(mode==='smart'?ranked(pool):mode==='balanced'?balanceBySkill(pool):mode==='exam'?pool:shuffle(pool)).slice(0,count);
 quiz={title,ids:order.map(q=>q.id),options:Object.fromEntries(order.filter(q=>q.options).map(q=>[q.id,shuffle(q.options)])),chunks:Object.fromEntries(order.filter(q=>q.order).map(q=>[q.id,shuffle(q.order)])),index:0,answers:[],selection:'',final,assessment:mode==='exam',returnTo,practicePaper,done:false};
 saveQuiz();go('quiz');window.scrollTo(0,0);
 if(order.length<count)notify('Có '+order.length+' câu phù hợp với lựa chọn này.');
}
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
function grade(q,value){
 if(!q.answers?.length)return null;
 if(q.answers.some(a=>normalize(a)===normalize(value)))return true;
 return q.kind===4||q.origin==='teacher'&&!q.options?.length||(['bank','curriculum'].includes(q.origin)&&q.order||q.mode==='correct')?null:false;
}
function submitAnswer(value){
 const q=getQuestion(quiz?.ids[quiz.index]);
 if(!q||!value.trim()||quiz.answers[quiz.index])return;
 const a={id:q.id,value,grade:grade(q,value),at:Date.now()};
 quiz.answers[quiz.index]=a;
 if(!quiz.assessment){state.attempts.push(a);save()}
 saveQuiz();render();
}
function scoreSkills(answers){
 const skills={};
 for(const answer of answers){
  const q=getQuestion(answer.id);
  if(!q)continue;
  const skill=lessonSkill(q);
  const result=skills[skill]??={correct:0,total:0,skipped:0};
  if(answer.skipped){result.skipped++;continue}
  if(answer.grade===null)continue;
  result.total++;if(answer.grade)result.correct++;
 }
 return skills;
}
function practiceScores(paper,answers){
 const byId=new Map(answers.map(answer=>[answer.id,answer]));
 return paper.sections.map(section=>{
  const attempted=section.ids.map(id=>byId.get(id)).filter(Boolean);
  return {name:section.name,correct:attempted.filter(answer=>answer.grade===true).length,
   graded:attempted.filter(answer=>answer.grade!==null&&!answer.skipped).length,total:section.ids.length};
 });
}
function finish(){
 if(quiz.done)return;
 quiz.done=true;
 if(quiz.assessment)state.attempts.push(...quiz.answers.filter(a=>a&&!a.skipped));
 const graded=quiz.answers.filter(a=>a.grade!==null),correct=graded.filter(a=>a.grade).length;
 state.history.push({title:quiz.title,final:quiz.final,count:quiz.answers.length,correct,graded:graded.length,skills:quiz.final?scoreSkills(quiz.answers):undefined,practicePaper:quiz.practicePaper?.id,at:Date.now()});
 save();saveQuiz();render();window.scrollTo(0,0);
}
const jsonExample={questions:[{kind:4,slide:32,level:'Khó',prompt:'Dịch sang tiếng Trung…',answers:['Câu trả lời mẫu'],explanation:'Giải thích bằng tiếng Việt.',pinyin:'',vi:'',zh:''}]};
// ===== Trang theo thiết kế canvas "Ôn tập HSK 1–4" =====
let srsFlip=false,vocabMode='card',vocabPick=null,vocabOpts=null,gPoint=0,listenTab='dialog',reviewTab='words',quizFilter='all';
const DAY_MS=86_400_000;
const dayWord=n=>n===1?'1 ngày':n+' ngày';
const pct=(a,b)=>b?Math.round(a/b*100):0;
const barHtml=(p,cls='')=>'<div class="bar '+cls+'" role="progressbar" aria-valuenow="'+p+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+p+'%"></i></div>';
const seg=(items,label,role='tab')=>'<div class="segmented" role="'+(role==='tab'?'tablist':'group')+'" aria-label="'+esc(label)+'">'+items.map(([action,text,on])=>'<button type="button" class="btn" '+(role==='tab'?'role="tab" aria-selected':'aria-pressed')+'="'+Boolean(on)+'" data-action="'+esc(action)+'">'+text+'</button>').join('')+'</div>';
const pageHead=(title,desc='',extra='',chips='')=>'<header class="page-head"><div>'+(chips?'<div class="chips">'+chips+'</div>':'')+'<h1>'+esc(title)+'</h1>'+(desc?'<p>'+esc(desc)+'</p>':'')+'</div>'+extra+'</header>';
const chip=(text,cls='')=>'<span class="chip '+cls+'">'+text+'</span>';
const note=(html,k='',icon='')=>'<div class="note" '+(k?'data-k="'+k+'"':'')+' role="status">'+(icon?svg(icon):'')+'<div>'+html+'</div></div>';
const iconAudio=(text,label='Nghe')=>text&&audioChoice(text)?'<button type="button" class="iconbtn play" data-action="speak:'+esc(text)+'" aria-label="'+esc(label)+'" aria-pressed="false">'+svg('audio')+'</button>':'';
const lessonNum=l=>l.n>=100?'Â'+(l.n-100):String(l.n).padStart(2,'0');
const attemptedSet=()=>new Set(state.attempts.map(a=>a.id));
const fmtDate=t=>new Date(t).toLocaleDateString('vi-VN');
const fmtDateTime=t=>new Date(t).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});

// Sáu mục của bài: Từ vựng · Ngữ pháp · Hội thoại & nghe · Bài luyện · Luyện mở rộng · Kiểm tra cuối bài
function lessonSteps(l,tried=attemptedSet()){
 const has=f=>l.questions.some(q=>f(q)&&tried.has(q.id));
 const srs=state.study?.srs??{};
 const marked=l.vocab.filter(w=>state.words[w.id]||srs[w.id]).length;
 const all=[
  ['vocab',l.vocab.length?marked>=Math.ceil(l.vocab.length/2):false],
  ['grammar',has(q=>lessonSkill(q)==='grammar')],
  ['listen',has(q=>q.kind===2||/-(listen|listen2|read)$/.test(q.id??''))],
  ['ex',has(q=>q.origin==='original'||q.origin==='teacher')],
  ['extra',has(q=>q.origin==='extra'||/-(apply|produce)$/.test(q.id??''))],
  ['final',state.history.some(h=>h.final===l.n)]];
 return (l.n>=100?all.filter(([k])=>['grammar','ex','extra'].includes(k)):all).map(([,v])=>v);
}
function lessonStatus(l,tried){
 const steps=lessonSteps(l,tried),done=steps.filter(Boolean).length,total=steps.length;
 const missing=!l.questions.length&&!l.vocab.length;
 return {steps,done,total,missing,k:missing?'bad':done===total?'ok':done?'warn':'muted',
  label:missing?'Chưa có học liệu':done===total?'Hoàn thành':done?'Đang học '+done+'/'+total:'Chưa học'};
}
const roadCard=(l,tried)=>{const s=lessonStatus(l,tried);return '<button type="button" class="lcard col" data-action="go:lesson/'+l.n+'"><div class="row"><span class="lnum'+(s.done===s.total?' done':'')+'">'+lessonNum(l)+'</span><div class="grow"><strong class="han" lang="zh-CN">'+esc(l.zh)+'</strong><small class="muted">'+esc(l.vi)+'</small></div><span class="badge" data-k="'+s.k+'">'+s.label+'</span></div>'+barHtml(pct(s.done,s.total),'thin')+'</button>'};
const levelCard=(l,tried)=>{const s=lessonStatus(l,tried);return '<button type="button" class="lcard" data-action="go:lesson/'+l.n+'"><span class="lnum'+(s.done===s.total?' done':'')+'">'+lessonNum(l)+'</span><div class="grow"><strong class="han" lang="zh-CN">'+esc(l.zh)+'</strong><small class="muted">'+esc(l.vi)+'</small><div class="steps" aria-label="'+s.done+' trên '+s.total+' mục đã xong">'+s.steps.map(on=>'<i class="'+(on?'on':'')+'"></i>').join('')+'</div></div><span class="badge" data-k="'+s.k+'">'+s.label+'</span></button>'};
const grantName=g=>g.kind==='hsk'?'HSK tối đa HSK '+g.maxLevel:(trackNames[g.track]??g.track);
const editionNote=()=>isEdition30&&course===1?note('<strong>Bài 12 chưa có học liệu riêng</strong><span>Chưa có tệp PowerPoint riêng cho Bài 12 của HSK 1 bản 3.0.</span>','warn'):'';

// ----- Tổng quan -----
function goalCard(){
 const study=ensureStudy(state),minutes=todayMinutes(state),goal=study.goal,days=streak(state),c=2*Math.PI*50,dash=Math.min(1,minutes/goal)*c;
 const week=lastWeek(state).map(d=>'<li class="day '+d.state+(d.today?' today':'')+'" title="'+esc(d.key+' · '+d.minutes+' phút')+'"><span>'+(d.state==='done'?svg('check'):'')+'</span><small>'+d.label+'</small></li>').join('');
 return '<section class="panel goal-card" id="goal-card"><div class="row split"><h2>'+tr('Mục tiêu hôm nay','Today’s goal','今日目标')+'</h2><span class="chip warm">'+svg('bolt')+tr('Chuỗi ','Streak ','连续 ')+dayWord(days)+'</span></div>'+
  '<div class="goal-body"><div class="goal-ring" role="img" aria-label="'+esc('Đã học '+minutes+' trên '+goal+' phút hôm nay')+'"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="track"/><circle cx="60" cy="60" r="50" class="fill" stroke-dasharray="'+dash.toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 60 60)"/></svg><div><b>'+minutes+'</b><small>/ '+goal+' phút</small></div></div>'+
  '<div class="goal-side"><ol class="week" aria-label="7 ngày gần nhất">'+week+'</ol><div class="row goal-pick"><span id="goal-label">'+tr('Mục tiêu','Goal','目标')+'</span>'+seg(goalChoices.map(g=>['goal:'+g,g+'′',g===goal]),'Mục tiêu phút mỗi ngày','group')+'</div></div></div>'+
  (minutes>=goal?note('<strong>'+tr('Đạt mục tiêu hôm nay! 太棒了！','Goal reached! 太棒了！','今日目标达成！太棒了！')+'</strong><span>Chuỗi học hiện tại: '+dayWord(days)+'.</span>','ok','check'):'<p class="goal-hint">'+tr('Thời gian được tính khi bạn đang học trên trang (tab đang mở và có thao tác).','Minutes count while you actively study on this page.','在本页学习时自动计时。')+'</p>')+'</section>';
}
function srsCard(){
 const queue=dueQueue(state,lessons),w=queue.cards[0],card=w&&ensureStudy(state).srs[w.id];
 const head='<div class="row split"><h2>'+tr('Hôm nay cần ôn','Due today','今日复习')+'</h2>'+(queue.cards.length?'<span class="badge" data-k="warn">'+queue.cards.length+' '+tr('thẻ đến hạn','due','张')+'</span>':'<span class="badge" data-k="ok">Đã xong</span>')+'</div><p class="srs-hint">'+tr('Lặp lại ngắt quãng: quên gặp lại sau 1 ngày, nhớ mang máng sau 3 ngày, nhớ rõ giãn dần 7 → 14 → 30 ngày.','Spaced repetition: forgotten cards return tomorrow, known cards space out 7 → 14 → 30 days.','间隔重复：忘记的词明天再见，记住的词间隔 7 → 14 → 30 天。')+'</p>';
 if(!w)return '<section class="panel srs-card" id="srs-card">'+head+'<div class="srs-empty" tabindex="-1">'+svg('check')+'<b>'+tr('Đã ôn xong hôm nay','All caught up','今天已复习完')+'</b><small>'+queue.reviewedToday+' '+tr('thẻ đã ôn hôm nay','cards reviewed today','张今日已复习')+'</small></div></section>';
 const tag=card?'Đến hạn':state.words[w.id]==='unknown'?'Chưa thuộc':'Từ mới';
 return '<section class="panel srs-card" id="srs-card">'+head+'<button type="button" class="srs-flash" data-action="srs-flip" aria-label="'+(srsFlip?'Úp thẻ':'Lật thẻ')+'"><span class="srs-tag">'+esc(lessonLabel(w.n))+' · '+tag+'</span><b class="han" lang="zh-CN">'+esc(w.zh)+'</b>'+(srsFlip?'<span class="py">'+esc(w.pinyin)+'</span><span>'+esc(w.vi)+'</span>':'<small>'+tr('Chạm để lật','Tap to flip','点击翻卡')+'</small>')+'</button>'+
  (srsFlip?'<div class="srs-rate">'+[['hard','Quên','danger'],['ok','Nhớ mang máng',''],['easy','Nhớ rõ','primary']].map(([k,label,t])=>'<button type="button" class="btn '+t+'" data-action="srs-rate:'+k+':'+esc(w.id)+'"><span>'+label+'</span><small>'+dayWord(nextStep(card,k))+'</small></button>').join('')+'</div>':'<div class="srs-rate placeholder"><button type="button" class="btn primary" data-action="srs-flip">'+tr('Lật thẻ để chấm','Flip to rate','翻卡评分')+'</button></div>')+'</section>';
}
function predictionPanel(compact=false){
 if(isWorkplace)return '';
 const p=predictScore(state,{course,getQuestion,lessonSkill});
 if(!p)return '';
 const passed=p.total!==null&&p.total>=p.pass;
 const level={none:['Chưa đủ dữ liệu','muted'],low:['Độ tin cậy thấp','warn'],medium:['Độ tin cậy vừa','warn'],high:[passed?'Khả năng đạt cao':'Độ tin cậy cao','ok']}[p.confidence];
 const weakest=p.parts.filter(x=>x.score!==null).sort((a,b)=>a.score/a.max-b.score/b.max)[0];
 return '<section class="panel predict"><div class="row split"><h2>'+tr('Dự đoán điểm ','Predicted score · ','预测分数 · ')+courseName+'</h2><span class="badge" data-k="'+level[1]+'">'+level[0]+'</span></div>'+
  (p.total===null?'<p>Làm thêm câu luyện tập hoặc một đề ôn thi để FangSchool ước lượng điểm của bạn.</p>':
  '<div class="predict-total"><b>'+p.total+'</b><span>/ '+p.max+' · cần '+p.pass+' để đạt</span><span class="badge" data-k="'+(passed?'ok':'warn')+'">'+(passed?'Dự kiến ĐẠT':'Chưa đạt')+'</span></div>')+
  '<div class="predict-parts">'+p.parts.map(x=>'<div><div class="row split"><span>'+x.name+'</span><small>'+(x.score===null?'—':x.score+'/'+x.max)+'</small></div>'+barHtml(x.score===null?0:pct(x.score,x.max),'thin')+'</div>').join('')+'</div>'+
  (compact&&weakest?button('Luyện kỹ năng yếu nhất: '+weakest.name,'preset:'+({Nghe:2,'Đọc':3,'Viết':4}[weakest.name]??1),'target'):'<p class="predict-note">Ước lượng từ '+p.evidence+' câu đã chấm gần đây'+(p.mock?', có tính kết quả đề ôn thi mới nhất':'')+'. Điểm đạt: '+p.pass+'/'+p.max+'. Chỉ mang tính tham khảo.</p>')+'</section>';
}
const todayPanels=()=>'<div class="today-grid">'+goalCard()+srsCard()+predictionPanel(true)+'</div>';
function rhythmPanel(){
 const map=heatmap(state),months=[];
 map.cells.filter(c=>c.day===0).forEach(c=>{const d=new Date(c.time);if(d.getDate()<=7)months.push('<span style="grid-column:'+(c.week+1)+'">Th'+(d.getMonth()+1)+'</span>')});
 const cells=map.cells.map(c=>'<i class="l'+(c.future?' future':c.level)+'" title="'+esc(fmtDate(c.time)+(c.future?'':' · '+c.minutes+' phút · '+c.answers+' câu'))+'"></i>').join('');
 return '<section class="panel rhythm"><div class="row split"><h2>'+tr('Nhịp học 16 tuần','16-week rhythm','16周学习节奏')+'</h2><small>'+map.minutes+' phút · '+map.activeDays+' ngày có học · '+Math.round(map.answers)+' câu</small></div>'+
  '<div class="heat-wrap"><div class="heat-days" aria-hidden="true"><span>T2</span><span></span><span>T4</span><span></span><span>T6</span><span></span><span>CN</span></div><div><div class="heat-months" aria-hidden="true">'+months.join('')+'</div><div class="heat" role="img" aria-label="'+esc('Bản đồ hoạt động 16 tuần: '+map.activeDays+' ngày có học, chuỗi hiện tại '+dayWord(streak(state)))+'">'+cells+'</div></div></div>'+
  '<div class="heat-legend" aria-hidden="true"><small>Ít</small><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><small>Nhiều</small></div></section>';
}
function grantNotes(){
 const soon=(viewer.grants??[]).filter(g=>g.expiresAt-Date.now()<7*DAY_MS);
 if(!soon.length)return '';
 const others=(viewer.grants??[]).filter(g=>!soon.includes(g)).map(g=>grantName(g)+' đến '+fmtDate(g.expiresAt)).join(' · ');
 return soon.map(g=>{const left=Math.max(0,Math.ceil((g.expiresAt-Date.now())/DAY_MS));return note('<span><strong>Quyền '+esc(grantName(g))+' còn '+dayWord(left)+'</strong> (hết hạn '+esc(fmtDateTime(g.expiresAt))+').'+(others?' '+esc(others)+'.':'')+'</span><button type="button" class="kv" style="padding:0;border:0;width:auto;font-weight:650;color:inherit" data-action="go:progress">Xem quyền học →</button>','warn','bolt')}).join('');
}
function home(){
 const tried=attemptedSet(),wrong=wrongQuestions().length,unknown=Object.values(state.words).filter(x=>x==='unknown').length,marked=Object.values(state.marks).filter(Boolean).length;
 const cur=lessons.find(l=>l.n===state.last)??lessons[0],cs=cur?lessonStatus(cur,tried):null,resume=quiz&&!quiz.done;
 const main=lessons.filter(l=>l.n<100||isWorkplace);
 const skillIcons=['词','语','听','译'];
 const skillCards=skillNames.map((i,j)=>'<button type="button" class="lcard" data-action="'+(isWorkplace&&i===2?'go:listening':'preset:'+i)+'"><span class="iconbox hz">'+skillIcons[j]+'</span><div class="grow"><strong>'+esc(kinds[i])+'</strong><small class="muted">'+questions.filter(q=>q.kind===i&&!q.resource).length+' câu</small></div></button>').join('');
 const history=state.history.slice(-4).reverse().map(h=>'<div class="kv"><div class="grow"><strong>'+esc(catalog.examCatalog?.papers?.find(paper=>paper.id===h.examCode)?.title??h.title)+'</strong><small class="muted">'+esc(fmtDateTime(h.at))+'</small></div><strong>'+h.correct+'/'+h.graded+'</strong></div>').join('');
 return '<section class="hero"><div><span class="eyebrow">FANGSCHOOL · TIẾNG TRUNG</span><h1>'+courseName+tr(' — Trung tâm ôn tập',' — Review center',' — 复习中心')+'</h1><p>'+tr('Ôn '+lessonCount()+' bài và luyện thêm từ vựng, ngữ pháp, nghe và đọc theo cấp độ.','Review '+lessonCount()+' lessons and practice with new examples.','复习 '+lessonCount()+' 课，并用新例句练习。')+'</p>'+
  (cur?'<div class="hero-current"><b class="han" lang="zh-CN">'+esc(lessonLabel(cur.n))+' · '+esc(cur.zh)+'</b><small>'+(resume?'Đang làm: '+esc(quiz.title):'Đã xong '+cs.done+'/'+cs.total+' mục')+'</small></div>':'')+
  '<div class="wrap">'+button(resume?tr('Tiếp tục lượt ôn','Resume practice','继续答题'):tr('Tiếp tục học','Continue learning','继续学习'),resume?'go:quiz':'go:lesson/'+state.last,'arrow','primary')+button('Ngân hàng luyện tập','go:bank','target','secondary')+(isWorkplace?button('Luyện nghe','go:listening','head','secondary'):'')+'</div></div><div class="hero-art" aria-hidden="true"><i class="orbit"></i><i class="orbit two"></i><div class="tile back">习</div><div class="tile front">复</div><span class="spark">✦</span><span class="spark bottom">✦</span></div></section>'+
  statCards()+todayPanels()+'<div class="section">'+rhythmPanel()+grantNotes()+'</div>'+
  '<div class="main-split"><section class="main" aria-labelledby="road-h"><div class="section-head"><div><h2 id="road-h" class="section-title">'+tr('Lộ trình '+lessonCount()+' bài',lessonCount()+'-lesson course','课程路线')+'</h2><p>'+tr('Chọn bài để xem lại nội dung đã học','Choose a lesson to review','选择一课开始复习')+'</p></div>'+button(expanded?'Thu gọn':'Xem tất cả','expand','chev')+'</div>'+
  '<div class="grid-auto">'+main.slice(0,expanded?main.length:6).map(l=>roadCard(l,tried)).join('')+'</div>'+
  '<h2 class="section-title" style="margin-top:14px">'+tr('Luyện theo kỹ năng','Practice by skill','分技能练习')+'</h2><div class="grid-auto">'+skillCards+'</div>'+editionNote()+'</section>'+
  '<aside class="side-col"><section class="panel quick"><div class="iconbox warm">'+svg('bolt')+'</div><h3>'+tr('Ôn tập nhanh','Quick practice','快速复习')+'</h3><p>'+tr('10 câu có chấm điểm, trộn từ nhiều bài.','10 scored questions from several lessons.','十道来自不同课程的评分题。')+'</p>'+button(tr('Bắt đầu ôn nhanh','Start practice','开始复习'),'quick','arrow','primary')+'</section>'+
  '<section class="panel"><h3>'+tr('Cần ôn lại','Review list','待复习')+'</h3><div class="form-actions"><button type="button" class="kv" data-action="rtab:words"><span>'+svg('bookmark')+' Những từ chưa thuộc</span><strong>'+unknown+'</strong></button><button type="button" class="kv" data-action="rtab:wrong"><span>'+svg('target')+' Câu trả lời sai</span><strong style="color:var(--bad)">'+wrong+'</strong></button><button type="button" class="kv" data-action="rtab:marked"><span>'+svg('check')+' Câu đã đánh dấu</span><strong>'+marked+'</strong></button></div></section>'+
  '<section class="panel"><h3>Lịch sử nộp đề</h3><div class="form-actions">'+(history||'<p>Chưa có lượt kiểm tra hoặc đề nào.</p>')+'</div>'+(catalog.examCatalog?'<div class="form-actions">'+button('Tất cả đề ôn thi','go:exams','text')+'</div>':'')+'</section></aside></div>';
}

// ----- Danh sách bài -----
function lessonDirectory(){
 const tried=attemptedSet(),main=lessons.filter(l=>l.n<100),list=isWorkplace?lessons:main;
 const finished=list.filter(l=>{const s=lessonStatus(l,tried);return s.total&&s.done===s.total}).length;
 const words=lessons.reduce((n,l)=>n+l.vocab.length,0),count=questions.filter(q=>q.origin!=='bank'&&!q.resource).length;
 const group=isWorkplace?'Chuyên mục':isEdition30?'HSK 3.0':'HSK 2.0';
 const cur=lessons.find(l=>l.n===state.last)??lessons[0];
 const summary='<section class="panel summary"><div class="grow"><div class="row split"><span class="muted">Đã hoàn thành</span><strong>'+finished+'/'+list.length+' bài</strong></div>'+barHtml(pct(finished,list.length))+'</div><div class="facts"><span>'+words+' từ vựng</span><span>'+count+' câu luyện</span></div>'+(cur?button('Tiếp tục '+lessonLabel(cur.n),'go:lesson/'+cur.n,'arrow','primary'):'')+'</section>';
 const title=tr('Danh sách bài · '+courseName,'Lessons · '+courseName,'课程 · '+courseName);
 const grid=items=>'<div class="grid-wide">'+items.map(l=>levelCard(l,tried)).join('')+'</div>';
 const footer='<p class="form-actions"><small>Mỗi bài có 6 mục: Từ vựng · Ngữ pháp · Hội thoại &amp; nghe · Bài luyện · Luyện mở rộng · Kiểm tra cuối bài. Vạch xanh là mục bạn đã luyện.</small></p>';
 if(!isWorkplace)return pageHead(title,'Chọn bài để học theo chủ điểm và luyện các kỹ năng.','',chip(group))+summary+(editionNote()?'<div class="form-actions">'+editionNote()+'</div>':'')+'<div class="section"><h2>Bài học</h2>'+grid(main)+'</div>'+(lessons.some(l=>l.n>=100)?'<div class="section"><h2>Ngữ âm</h2>'+grid(lessons.filter(l=>l.n>=100))+'</div>':'')+footer;
 return pageHead(title,'Học theo tình huống công việc và tra từ ngay trong từng bài.',button('Luyện nghe','go:listening','head'),chip(group))+summary+
  '<div class="section"><h2>Chủ đề mở rộng</h2>'+grid(lessons.filter(l=>l.extension))+'</div><div class="section"><h2>Bài từ tài liệu gốc</h2>'+grid(lessons.filter(l=>!l.extension))+'</div>'+footer;
}

// ----- Trang bài học -----
const stageInfo=(label,title,description)=>'<div class="tab-head"><div><span class="chip">'+esc(label)+'</span><h2 style="margin-top:8px">'+esc(title)+'</h2><p>'+esc(description)+'</p></div></div>';
function lessonPage(n,tab='vocab'){
 const l=getLesson(n);
 if(l.n>=100&&tab==='vocab')tab='extra';
 const tabs=[['vocab','Từ vựng'],['grammar','Ngữ pháp'],['listen','Hội thoại & nghe'],['ex','Bài luyện'],['extra','Luyện mở rộng'],['final','Kiểm tra cuối bài']].filter(([key])=>l.n<100||!['vocab','listen','final'].includes(key));
 const body=tab==='vocab'?vocabStage(l):tab==='grammar'?grammarStage(l):tab==='listen'?listenStage(l):tab==='ex'?exerciseStage(l):tab==='extra'?transferStage(l):tab==='final'?finalStage(l):note('Chưa có nội dung cho mục này.');
 return button('‹ Tất cả bài học','go:lessons','','back')+pageHead(l.zh,l.vi+(l.topic?' · '+l.topic:''),'',chip(esc(lessonLabel(l.n)))+chip(esc(courseName))).replace('<h1>','<h1 class="han" lang="zh-CN">')+
  '<nav class="ltabs" aria-label="Mục trong bài">'+tabs.map(([k,t])=>button(t,'go:lesson/'+l.n+'/'+k,'',tab===k?'active':'',tab===k?'aria-current="page"':'')).join('')+'</nav>'+body;
}
function vocabOptions(l,w){
 const key=w.id+':'+vocabMode;
 if(vocabOpts?.key===key)return vocabOpts.items;
 vocabPick=null;
 const field=vocabMode==='meaning'?'vi':'zh';
 const seen=new Set([w[field]]);
 const pool=shuffle([...l.vocab,...lessons.flatMap(x=>x.vocab)]).filter(x=>x.id!==w.id&&x[field]&&!seen.has(x[field])&&seen.add(x[field]));
 vocabOpts={key,items:shuffle([w,...pool.slice(0,3)])};
 return vocabOpts.items;
}
function vocabStage(l){
 const w=l.vocab[flash]??l.vocab[0];
 if(!w)return note('Bài này chưa có danh sách từ vựng.');
 const known=l.vocab.filter(x=>state.words[x.id]==='known').length,unknown=l.vocab.filter(x=>state.words[x.id]==='unknown').length;
 const i=l.vocab.indexOf(w);
 const modes=[['card','Flashcard'],['meaning','Chọn nghĩa'],['recog','Nhận diện chữ'],['listen','Nghe chọn từ']];
 const head='<div class="tab-head"><h2>Từ vựng</h2>'+seg(modes.map(([k,t])=>['vmode:'+k,t,vocabMode===k]),'Kiểu luyện')+'</div>'+
  '<section class="panel reader-bar">'+readerControls()+'<div class="wrap" aria-live="polite">'+audioButton(voiceKey(w.zh,w.pinyin),'Phát âm','primary')+'</div></section>'+
  '<div class="pos-line"><span>Từ '+(i+1)+' / '+l.vocab.length+'</span><span>Đã thuộc <strong class="ok">'+known+'</strong> · Chưa thuộc <strong class="bad">'+unknown+'</strong></span></div>'+barHtml(pct(i+1,l.vocab.length));
 let main;
 if(vocabMode==='card'){
  main='<div class="form-actions"><button type="button" class="flash-big" data-action="flip" aria-pressed="'+flip+'" aria-label="Lật thẻ"><span class="side">'+(flip?'Mặt sau':'Mặt trước')+'</span><span class="zh han" lang="zh-CN">'+esc(w.zh)+'</span>'+(flip?'<span class="py">'+esc(w.pinyin)+'</span><span class="vi">'+esc(w.vi)+'</span>'+(w.examples?.length?'<span class="ex han">'+esc(w.examples.join('\n'))+'</span>':''):'<span class="muted">Nhấn để xem pinyin, nghĩa và ví dụ</span>')+'</button>'+
   '<div class="mark-row">'+button('Chưa thuộc','word:unknown:'+w.id,'bookmark','danger','aria-pressed="'+(state.words[w.id]==='unknown')+'"')+button('Đã thuộc','word:known:'+w.id,'check','primary','aria-pressed="'+(state.words[w.id]==='known')+'"')+'</div>'+
   '<div class="nav-row">'+button('‹ Từ trước','flash:-1')+button('Luyện từ của bài','lessonquiz:'+l.n+':0','shuffle')+button('Từ tiếp ›','flash:1')+'</div></div>';
 }else{
  const opts=vocabOptions(l,w),answered=vocabPick!==null,right=answered&&opts[vocabPick]?.id===w.id;
  const playable=canPlay(w.zh,w.pinyin),listenMode=vocabMode==='listen'&&playable;
  const prompt={meaning:'Chọn nghĩa đúng của từ:',recog:'Chọn chữ Hán đúng với nghĩa:',listen:'Nghe và chọn từ bạn nghe được:'}[vocabMode];
  const stem=vocabMode==='recog'?'<span class="stem vi">'+esc(w.vi)+'</span>':listenMode?'':'<span class="stem han" lang="zh-CN">'+esc(vocabMode==='listen'?w.pinyin:w.zh)+'</span>';
  main='<section class="panel qcard form-actions"><span class="muted">'+prompt+'</span>'+(vocabMode==='listen'&&!playable?note('Từ này chưa có bản đọc, tạm hiển thị pinyin.','warn'):'')+(listenMode?'<div>'+audioButton(voiceKey(w.zh,w.pinyin),'Nghe từ','primary')+'</div>':'')+stem+
   '<div class="opt-grid">'+opts.map((o,k)=>{const s=!answered?'':o.id===w.id?'good':k===vocabPick?'bad':'';return '<button type="button" class="option '+s+'" data-action="vpick:'+k+'" '+(answered?'disabled':'')+'><span>'+String.fromCharCode(65+k)+'</span><span class="'+(vocabMode==='meaning'?'':'zh-opt han')+'">'+esc(vocabMode==='meaning'?o.vi:o.zh)+'</span></button>'}).join('')+'</div>'+
   (answered?note('<strong>'+(right?'Chính xác!':'Chưa đúng — từ này đã được thêm vào “Cần ôn lại”.')+'</strong><span><span class="han">'+esc(w.zh)+'</span> · '+esc(w.pinyin)+' · '+esc(w.vi)+'</span>',right?'ok':'bad')+'<div class="nav-row" style="justify-content:flex-end">'+button('Câu tiếp theo','vnext','arrow','primary')+'</div>':'')+'</section>';
 }
 const list='<details class="panel source form-actions"><summary>Danh sách '+l.vocab.length+' từ của bài</summary><div class="list-items">'+l.vocab.map((x,k)=>'<button class="list-item '+(x.id===w.id?'active':'')+'" data-action="pickflash:'+k+'"><b class="han">'+esc(x.zh)+'</b><small>'+esc(x.pinyin)+' · '+esc(x.vi)+'</small>'+(state.words[x.id]==='known'?svg('check'):state.words[x.id]==='unknown'?svg('bookmark'):'')+'</button>').join('')+'</div></details>';
 return head+main+list+nextStage(l,'grammar','Tiếp theo · Ngữ pháp');
}
function grammarStage(l){
 const points=l.grammarPoints??[];
 const practice=l.questions.filter(q=>lessonSkill(q)==='grammar'&&[1,4].includes(q.kind)&&!q.resource&&q.answers?.length);
 const activity=mastery(practice);
 const exampleRow=(zh,py,vi)=>'<div class="ex-row">'+iconAudio(voiceKey(zh,py),'Nghe câu ví dụ')+'<div class="grow"><span class="zh han" lang="zh-CN">'+esc(zh)+'</span><span class="py">'+esc(py)+'</span><span class="muted">'+esc(vi)+'</span></div></div>';
 if(gPoint>=points.length)gPoint=0;
 const p=points[gPoint];
 const tip=l.note?note('<span><strong>Lưu ý · '+esc(l.note[0])+':</strong> '+esc(l.note[1])+(l.note[2]?' <strong>Điểm dễ nhầm:</strong> '+esc(l.note[2]):'')+'</span>','','book'):'';
 const card=p?'<article class="panel gcard">'+(points.length>1?seg(points.map((x,k)=>['gpoint:'+k,esc(x.pattern.length>22?x.pattern.slice(0,21)+'…':x.pattern),k===gPoint]),'Điểm ngữ pháp'):'')+
   '<h2 class="han" lang="zh-CN">'+esc(p.pattern)+'</h2><p>'+esc(p.explanation)+'</p><div class="pattern-box"><span class="k">Mẫu câu</span><b class="han" lang="zh-CN">'+esc(p.pattern)+'</b></div><div><span class="ex-label">Ví dụ</span><div class="ex-list">'+exampleRow(p.zh,p.pinyin,p.vi)+'</div></div>'+
   (p.questions?.[0]?'<div>'+questionAction(p.questions[0],'Thử mẫu này','primary')+'</div>':'')+tip+'</article>':(tip?'<article class="panel gcard">'+tip+'</article>':note('Bài này chưa có điểm ngữ pháp riêng.'));
 const modes=['apply','order','correct','translate'].map(mode=>{const items=curriculumItems(l,mode);return items.length?button(grammarModes[mode]+' · '+items.length,'grammar-mode:'+l.n+':'+mode):''}).join('');
 const apply='<section class="panel gcard"><div class="row split"><h2>Bài áp dụng</h2><span class="muted">'+activity.done+'/'+practice.length+' câu đã luyện</span></div>'+
  (practice.length?barHtml(pct(activity.done,practice.length),'thin')+'<p>Chọn dạng bài để áp dụng mẫu câu. Câu sai được lưu vào “Cần ôn lại”.</p><div class="chips-select">'+button('Luyện trộn','grammar-mode:'+l.n+':mixed','arrow','primary')+modes+'</div>'+(activity.wrong?note('<span>'+activity.wrong+' câu sai gần nhất.</span>'+button('Làm lại câu sai','lesson-weak:'+l.n+':grammar','target'),'warn'):''):'<p>Chưa có câu luyện ngữ pháp cho bài này.</p>')+'</section>';
 const more=l.focus.length?'<details class="panel source form-actions"><summary>Ví dụ và mẫu câu khác · '+l.focus.length+'</summary><div class="ex-list form-actions">'+l.focus.map(q=>'<div class="ex-row">'+iconAudio(voiceKey(q.zh,q.pinyin),'Nghe câu ví dụ')+'<div class="grow"><strong class="han">'+esc(q.answers[0])+'</strong><span class="zh han" lang="zh-CN">'+esc(q.zh)+'</span><span class="py">'+esc(q.pinyin)+'</span><span class="muted">'+esc(q.vi)+' · '+esc(q.explanation)+'</span></div>'+questionAction(q,'Thử')+'</div>').join('')+'</div></details>':'';
 const hasAudio=[...points,...l.focus].some(x=>canPlay(x.zh,x.pinyin));
 return '<div class="tab-head"><h2>Ngữ pháp</h2></div>'+(hasAudio?'<section class="panel reader-bar">'+readerControls()+'</section>':'')+'<div class="two-col">'+card+apply+'</div>'+more+
  (l.n<100?nextStage(l,'listen','Tiếp theo · Hội thoại & nghe'):nextStage(l,'extra','Tiếp theo · Luyện ngữ âm'));
}
function dialogueCard(l,d,i){
 const speakers=[...new Set(d.utterances.map(u=>u.who).filter(Boolean))];
 const showZh=!settings.hideZh,showPy=!settings.hidePy,showVi=settings.showVi;
 const rows=d.utterances.map(u=>{const idx=speakers.indexOf(u.who);return '<div class="line"><span class="spk'+(idx%2?' b':'')+'" aria-hidden="true">'+esc((u.who||'?').slice(0,2))+'</span><div>'+
  (showZh?'<span class="zh han" lang="zh-CN">'+esc(u.zh)+'</span>':'')+(showPy&&u.pinyin?'<span class="py">'+esc(u.pinyin)+'</span>':'')+(showVi?'<span class="vi">'+esc(u.vi||'Chưa có bản dịch cho câu này.')+'</span>':'')+(!showZh&&!showPy&&!showVi?'<span class="vi">(Đã ẩn chữ — nghe và đoán nội dung)</span>':'')+
  '</div>'+(!isWorkplace||canPlay(u.zh,u.pinyin)?iconAudio(voiceKey(u.zh,u.pinyin),'Nghe câu của '+(u.who||'người nói')):'')+'</div>'}).join('');
 return '<section class="panel lines-card form-actions" aria-label="Lời hội thoại"><div class="dlg-head"><h3>'+(d.recording?'Bài khóa · Phần ':'Hội thoại ')+(d.part??i+1)+'</h3><div class="wrap">'+dialogueAudio(l,d)+'</div></div>'+(!d.utterances.length?note('Có bản thu gốc. Văn bản trong slide này nằm trong ảnh.'):rows)+'</section>';
}
function listenStage(l){
 const listening=courseQuiz(l,'listen'),secondListening=courseQuiz(l,'listen2'),reading=courseQuiz(l,'read');
 const playable=listening&&canPlay(listening.audio,listening.pinyin);
 const dictation=l.questions.filter(q=>q.kind===2&&q.audio&&!q.options&&q.answers?.length&&canPlay(q.audio,q.pinyin));
 const workplaceItems=isWorkplace?workplaceAudioQuestions(l.questions):[];
 const tabs=[['dialog','Hội thoại'],['comp','Nghe hiểu'],...(dictation.length||workplaceItems.some(q=>!q.options?.length)?[['dict','Nghe chép']]:[])];
 if(!tabs.some(([k])=>k===listenTab))listenTab='dialog';
 const toggles='<div class="toggles"><span class="lbl">Hiển thị:</span>'+[['hideZh','Chữ Hán',true],['hidePy','Pinyin',true],['showVi','Nghĩa tiếng Việt',false]].map(([k,label,inverse])=>'<button type="button" class="toggle" aria-pressed="'+(inverse?!settings[k]:settings[k])+'" data-action="setting:'+k+'">'+label+'</button>').join('')+'</div>';
 let body;
 if(listenTab==='dialog')body=toggles+(l.dialogues.length?l.dialogues.map((d,i)=>dialogueCard(l,d,i)).join(''):note('Bài này chưa có hội thoại.'));
 else if(listenTab==='comp')body='<section class="panel qcard"><span class="muted">'+esc(isWorkplace?'Luyện nghe theo bài':l.scenario?.topic??'Nghe để lấy ý')+'</span><h3 style="margin:0">'+esc(isWorkplace?workplaceItems.length+' câu có audio':l.scenario?.prompt||'Đọc câu hỏi trước để biết cần nghe thông tin gì. Thử ở 1× rồi dùng 0,75× khi cần nghe lại.')+'</h3><div class="chips-select">'+
  (isWorkplace?(workplaceItems.some(q=>q.options?.length)?button('Nghe và chọn đáp án','workplace-listen:choice:'+l.n,'head','primary'):'')+button('Mở kho luyện nghe','go:listening','arrow'):
  (playable?questionAction(listening,'Nghe và trả lời','primary'):'')+(secondListening&&canPlay(secondListening.audio)?questionAction(secondListening,'Nghe và trả lời · Phần 2'):'')+questionAction(reading,'Đọc và trả lời')+(curriculumItems(l,'listen').length?button('Nghe và nhận diện cấu trúc','grammar-mode:'+l.n+':listen','head'):''))+'</div></section>';
 else body='<section class="panel qcard"><span class="muted">Nghe chép</span><h3 style="margin:0">'+(isWorkplace?workplaceItems.filter(q=>!q.options?.length).length:dictation.length)+' câu · nghe rồi gõ lại bằng chữ Hán hoặc pinyin</h3><p>Mỗi câu được chấm ngay, câu sai lưu vào “Cần ôn lại”.</p><div>'+button('Bắt đầu nghe chép',isWorkplace?'workplace-listen:dictation:'+l.n:'lesson-dictation:'+l.n,'head','primary')+'</div></section>';
 return '<div class="tab-head"><h2>Hội thoại &amp; luyện nghe</h2>'+seg(tabs.map(([k,t])=>['ltab:'+k,t,listenTab===k]),'Phần luyện')+'</div><section class="panel reader-bar">'+readerControls()+'</section>'+body+nextStage(l,'ex','Tiếp theo · Bài luyện');
}

// ----- Lượt ôn & kết quả -----
function quizPage(){
 if(!quiz)return pageHead('Chưa có lượt ôn','Chọn nội dung để bắt đầu luyện.')+button('Chọn nội dung luyện','go:practice','arrow','primary');
 const q=getQuestion(quiz.ids[quiz.index]);
 if(!q&&!quiz.done)return pageHead('Nội dung đã cập nhật')+button('Tạo lượt mới','go:practice','arrow','primary');
 const kindOf=x=>x.origin==='bank'?bankGroups[x.group]:kinds[x.kind];
 if(quiz.done){
  const graded=quiz.answers.filter(a=>a&&a.grade!==null),correct=graded.filter(a=>a.grade).length,wrong=graded.filter(a=>!a.grade);
  const skipped=quiz.answers.filter(a=>a?.skipped).length,self=quiz.answers.filter(a=>a&&a.grade===null&&!a.skipped).length;
  const p=pct(correct,graded.length);
  const title=!graded.length?'Đã lưu bài làm':p>=80?'Xuất sắc! 太棒了！':p>=50?'Khá tốt, tiếp tục nhé':'Cần ôn thêm';
  const breakdown=quiz.practicePaper?'<div class="grid-auto form-actions">'+practiceScores(quiz.practicePaper,quiz.answers).map(section=>'<article class="panel"><h3>'+esc(section.name)+'</h3><p>'+section.correct+'/'+section.graded+' đúng · '+section.total+' câu</p>'+barHtml(pct(section.correct,section.graded),'thin')+'</article>').join('')+'</div>':quiz.final?'<div class="grid-auto form-actions">'+Object.entries(scoreSkills(quiz.answers)).map(([skill,v])=>'<article class="panel"><h3>'+lessonSkills[skill]+'</h3><p>'+v.correct+'/'+v.total+' đúng'+(v.skipped?' · '+v.skipped+' câu bỏ qua':'')+'</p>'+barHtml(pct(v.correct,v.total),'thin')+'</article>').join('')+'</div>':'';
  const filters=[['all','Tất cả'],['wrong','Câu sai'],['right','Câu đúng'],['self','Tự đối chiếu']];
  const shown=quiz.answers.map((a,i)=>({a,i,x:a&&getQuestion(a.id)})).filter(({a,x})=>x&&(quizFilter==='all'||quizFilter==='wrong'&&a.grade===false||quizFilter==='right'&&a.grade===true||quizFilter==='self'&&a.grade===null));
  const cards=shown.map(({a,i,x})=>{const k=a.skipped?'muted':a.grade===true?'ok':a.grade===false?'bad':'warn';const st=a.skipped?'Đã bỏ qua':a.grade===true?'Đúng':a.grade===false?'Sai':'Tự đối chiếu';
   return '<article class="panel review-card"><div class="top"><span>Câu '+(i+1)+' · '+esc(kindOf(x))+'</span><span class="badge" data-k="'+k+'">'+st+'</span></div><p class="lines"><strong>'+esc(x.prompt)+'</strong></p><p>Bạn trả lời: <strong class="han">'+esc(a.value||'—')+'</strong></p><p>Đáp án: <strong class="han">'+esc(x.reference??x.answers?.[0]??'Đối chiếu cùng giáo viên.')+'</strong>'+(x.pinyin?' · '+esc(x.pinyin):'')+(x.vi?' · '+esc(x.vi):'')+'</p>'+(x.zh?'<p class="han lines">'+esc(x.zh)+'</p>':'')+(x.explanation?'<small>'+esc(x.explanation)+'</small>':'')+
    ((x.audio||x.zh&&canPlay(x.zh,x.pinyin))?'<div>'+questionAudio(x,'Nghe lại')+'</div>':'')+
    (a.grade===null&&!a.skipped?note('<span>Câu này chưa chấm tự động được. Tự đối chiếu với đáp án mẫu:</span><div class="self-check">'+button('Tôi sai','self:'+i+':0')+button('Tôi đúng','self:'+i+':1','check','primary')+'</div>','warn'):'')+'</article>'}).join('');
  return '<div class="quiz-wrap">'+pageHead('Kết quả lượt ôn',quiz.title)+'<section class="panel score-card"><div class="score-ring" style="--p:'+p+'"><span>'+(graded.length?correct+'/'+graded.length:'—')+'</span></div><div class="grow"><h2>'+title+'</h2><p>Điểm tính trên '+graded.length+' câu chấm tự động'+(self?'; '+self+' câu tự đối chiếu không tính vào tỷ lệ đúng':'')+(skipped?'; '+skipped+' câu bỏ qua':'')+'. Câu sai được thêm vào mục “Cần ôn lại”.</p><div class="wrap">'+button('Làm lại','redo','shuffle','primary')+(wrong.length?button('Ôn các câu sai','redo-wrong','target'):'')+(quiz.returnTo?button(quiz.returnTo.startsWith('exams/')?'Về kho đề':quiz.returnTo==='listening'?'Về kho luyện nghe':'Về bài học','go:'+quiz.returnTo,'book'):button('Xem tiến độ','go:progress','chart'))+'</div></div></section>'+breakdown+
   (quiz.answers.some(a=>{const x=a&&getQuestion(a.id);return x&&canPlay(x.audio??x.zh,x.pinyin)})?'<section class="panel reader-bar form-actions">'+readerControls()+'</section>':'')+
   '<div class="tab-head form-actions" style="margin-top:28px"><h2>Xem lại bài làm</h2>'+seg(filters.map(([k,t])=>['qfilter:'+k,t,quizFilter===k]),'Lọc câu')+'</div><div class="cards">'+(cards||'<p>'+(quizFilter==='wrong'?'Không có câu sai. Tuyệt vời!':'Không có câu nào trong mục này.')+'</p>')+'</div></div>';
 }
 const a=quiz.answers[quiz.index],opts=quiz.options[q.id],marked=state.marks[q.id];
 const chunks=quiz.chunks?.[q.id],selectedChunks=quiz.picked??[];
 const isGuidedOrder=chunks&&q.origin==='curriculum'&&!a;
 const answeredCount=quiz.answers.filter(Boolean).length;
 const orderUI=chunks&&!a?'<div class="chips-select">'+chunks.map((chunk,i)=>'<button type="button" class="toggle han" data-action="chunk:'+i+'" '+(selectedChunks.includes(i)?'disabled aria-pressed="true"':'')+'>'+esc(chunk)+'</button>').join('')+button('Xóa cụm đã chọn','clear-chunks')+'</div>':'';
 const options=opts?'<div class="cards">'+opts.map((o,i)=>{
  const good=a&&!quiz.assessment&&q.answers.some(x=>normalize(x)===normalize(o)),selected=(a?.value??quiz.selection)===o;
  return '<button type="button" class="option '+(good?'good':selected?(a&&!quiz.assessment?'bad':'selected'):'')+'" data-action="answer:'+i+'" '+(a?'disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span><span>'+esc(o)+'</span></button>';
 }).join('')+'</div>':'<label class="lbl" for="response">Câu trả lời</label><textarea id="response" name="response" rows="3" placeholder="Nhập câu trả lời của bạn" '+(a||isGuidedOrder?'readonly':'')+' required>'+esc(a?.value??quiz.selection)+'</textarea>';
 const feedback=a&&quiz.assessment?note('Đã lưu câu trả lời. Đáp án và điểm sẽ hiện sau khi nộp toàn bộ.'):a?note('<strong>'+({true:'Chính xác!',false:'Cần ôn lại',null:'Đã lưu · Tự đối chiếu'}[String(a.grade)])+'</strong><span>Câu trả lời của bạn · '+esc(a.value||'—')+'</span><span><strong>'+esc(q.reference?'Đáp án mẫu · '+q.reference:q.answers?.[0]??'Câu mở · Đối chiếu cùng giáo viên.')+'</strong></span>'+(a.grade===null&&(q.kind===4&&q.reference||q.origin==='curriculum'&&(q.order||q.mode==='correct'))?'<span>Đối chiếu ý và cấu trúc. Cách diễn đạt khác đáp án mẫu có thể vẫn đúng.</span>':'')+(q.zh?'<span class="han">'+esc(q.zh)+'</span>':'')+(q.pinyin?'<span>'+esc(q.pinyin)+'</span>':'')+(q.vi?'<span>'+esc(q.vi)+'</span>':'')+(q.explanation?'<span>'+esc(q.explanation)+'</span>':'')+(q.zh&&!q.audio&&canPlay(q.zh,q.pinyin)?'<div>'+questionAudio(q,'Nghe lại')+'</div>':''),a.grade===true?'ok':a.grade===false?'bad':'warn'):'';
 const last=quiz.index+1===quiz.ids.length;
 return '<div class="quiz-wrap">'+pageHead(quiz.title,'',button(marked?'Đã đánh dấu':'Đánh dấu để ôn','mark:'+q.id,'bookmark',marked?'active':'','aria-pressed="'+Boolean(marked)+'"'),chip(locationLabel(q)))+
  '<div class="qhead"><span>Câu '+(quiz.index+1)+' / '+quiz.ids.length+'</span><span>Đã trả lời '+answeredCount+' / '+quiz.ids.length+'</span></div>'+barHtml(pct(answeredCount,quiz.ids.length))+
  '<section class="panel qcard form-actions"><div class="chips">'+chip(esc(kindOf(q)))+(q.level?chip(esc(q.level)):'')+chip(esc(q.origin==='teacher'?'Giáo viên':q.origin==='bank'?'Theo cấp HSK':q.origin==='guided'?'Tình huống':q.origin==='curriculum'?grammarModes[q.mode]:'Theo bài'))+'</div><h2 class="prompt lines">'+esc(q.prompt)+'</h2>'+
  (q.audio?'<div class="reader-bar" style="padding:0;margin:0">'+readerControls()+'</div><div class="wrap">'+questionAudio(q,'Nghe câu hỏi')+'</div>':a&&canPlay(q.zh,q.pinyin)?readerControls():'')+
  '<form id="answer-form" class="cards">'+orderUI+options+feedback+'<div class="qnav">'+button('‹ Câu trước','prev','','',quiz.index?'':'disabled')+'<div>'+(!a&&q.audio?button('Bỏ qua câu nghe','skip-audio'):'')+(a?button(last?(quiz.assessment?'Nộp bài':'Xem kết quả'):'Câu tiếp','next','arrow','primary'):'<button id="check-answer" class="btn primary" '+(opts&&!quiz.selection||isGuidedOrder&&selectedChunks.length!==chunks.length?'disabled':'')+'>'+(quiz.assessment?'Lưu câu trả lời':'Kiểm tra')+'</button>')+'</div></div></form></section></div>';
}

// ----- Cần ôn lại -----
function review(){
 const wrong=wrongQuestions(),marked=questions.filter(q=>state.marks[q.id]),words=dueWords();
 const lastAttempt=new Map(state.attempts.map(a=>[a.id,a]));
 const total=wrong.length+marked.length+words.length;
 const tabs=[['words','Từ chưa thuộc · '+words.length],['wrong','Câu sai · '+wrong.length],['marked','Đã đánh dấu · '+marked.length]];
 const qcard=(q,action,label)=>{const a=lastAttempt.get(q.id);return '<article class="panel wrong-card"><div class="grow"><div class="chips">'+chip(locationLabel(q))+'<span class="badge" data-k="muted">'+esc(q.origin==='bank'?bankGroups[q.group]:kinds[q.kind])+'</span></div><span class="stem lines">'+esc(q.prompt.replace(/\n/g,' ').slice(0,180))+'</span>'+(a?'<span>Bạn trả lời: <span class="han">'+esc(a.value||'—')+'</span> · Đáp án: <span class="han">'+esc(q.reference??q.answers?.[0]??'—')+'</span></span><small class="muted">'+esc(fmtDateTime(a.at))+'</small>':'')+'</div><div class="wrap">'+button('Làm lại câu này','one:'+q.id,'arrow')+(action?button(label,action):'')+'</div></article>'};
 let body;
 if(reviewTab==='words')body=words.length?'<div class="row split form-actions"><p>'+words.length+' từ bạn đánh dấu chưa thuộc.</p>'+button('Luyện các từ này','review-words','arrow','primary')+'</div><div class="word-cards form-actions">'+words.map(w=>'<div class="panel word-card"><strong class="zh han" lang="zh-CN">'+esc(w.zh)+'</strong><div class="grow"><span>'+esc(w.pinyin)+'</span><small class="muted">'+esc(w.vi)+' · '+esc(lessonLabel(w.n))+'</small></div><div class="cards" style="gap:6px">'+button('Đã thuộc','word:known:'+w.id,'check')+button('Mở thẻ','word-link:'+w.n+':'+w.i)+'</div></div>').join('')+'</div>':note('Không còn từ chưa thuộc. Tuyệt vời!','ok','check');
 else if(reviewTab==='wrong')body=wrong.length?'<div class="row split form-actions"><p>'+wrong.length+' câu trả lời sai gần nhất.</p>'+button('Luyện lại câu sai','review-wrong','arrow','primary')+'</div><div class="cards form-actions">'+wrong.map(q=>qcard(q)).join('')+'</div>':note('Chưa có câu trả lời sai.','ok','check');
 else body=marked.length?'<div class="row split form-actions"><p>'+marked.length+' câu bạn đã đánh dấu.</p>'+button('Luyện câu đã đánh dấu','review-marked','arrow','primary')+'</div><div class="cards form-actions">'+marked.map(q=>qcard(q,'mark:'+q.id,'Bỏ đánh dấu')).join('')+'</div>':note('Chưa có câu nào được đánh dấu. Dùng nút “Đánh dấu để ôn” khi làm bài.');
 return pageHead(tr('Cần ôn lại · ','Review list · ','待复习 · ')+courseName,'Từ bạn đánh dấu chưa thuộc và câu trả lời sai gần nhất, lưu riêng theo khóa.',total?button('Ôn tất cả · '+total+' mục','review-all','arrow','primary'):'')+seg(tabs.map(([k,t])=>['rtab:'+k,t,reviewTab===k]),'Loại nội dung')+body;
}

// ----- Tiến độ -----
function progress(){
 const g=graded(),correct=g.filter(a=>a.grade).length,wrongCount=g.length-correct,self=state.attempts.length-g.length;
 const viewedCount=Object.keys(state.views?.questions??{}).length;
 const completed=state.history.filter((a,i,arr)=>a.final&&a.final<100&&arr.findIndex(b=>b.final===a.final)===i).length;
 const stat=(icon,cls,value,label)=>'<div class="stat"><div class="iconbox hz '+cls+'">'+icon+'</div><div><strong>'+esc(value)+'</strong><small>'+esc(label)+'</small></div></div>';
 const stats='<div class="grid4 stats">'+stat('书','',completed+'/'+lessonCount(),tr('Bài hoàn thành','Lessons completed','已完成课程'))+
  stat('练','warm',state.attempts.length.toLocaleString('vi-VN'),'Lượt trả lời · '+viewedCount.toLocaleString('vi-VN')+' câu đã xem')+
  stat('%','blue',g.length?pct(correct,g.length)+'%':'—','Tỷ lệ đúng (câu chấm tự động)')+
  stat('✓','violet',Object.values(state.words).filter(w=>w==='known').length.toLocaleString('vi-VN'),tr('Từ đã thuộc','Words learned','已掌握词汇'))+'</div>';

 const attempted=new Set(state.attempts.map(a=>a.id));
 const rows=lessons.map(l=>{
  const total=l.questions.filter(q=>!q.resource).length,done=l.questions.filter(q=>!q.resource&&attempted.has(q.id)).length,p=pct(done,total);
  const [label,k]=!total?['Chưa có học liệu','bad']:p>=100||state.history.some(h=>h.final===l.n)&&p>=60?['Hoàn thành','ok']:done?['Đang học','warn']:['Chưa học','muted'];
  return '<button type="button" class="progress-row" data-action="go:lesson/'+l.n+'"><span class="row split"><span><strong>'+esc(lessonLabel(l.n))+'</strong> · <span class="han" lang="zh-CN">'+esc(l.zh)+'</span></span><span class="row"><small class="muted">'+done+'/'+total+' câu</small><span class="badge" data-k="'+k+'">'+label+'</span></span></span>'+barHtml(p,'thin')+'</button>';
 }).join('');

 // Ngữ pháp cần ôn: gom câu sai theo điểm ngữ pháp của bài.
 const wrongIds=new Set(wrongQuestions().map(q=>q.id)),groups=[];
 for(const l of lessons){
  const counted=new Set();
  for(const point of l.grammarPoints??[]){
   const ids=(point.questions??[]).map(q=>q?.id??q).filter(id=>wrongIds.has(id));
   const extra=l.questions.filter(q=>wrongIds.has(q.id)&&lessonSkill(q)==='grammar'&&!counted.has(q.id)&&(q.answers??[]).some(a=>point.pattern&&String(point.pattern).includes(a)));
   const all=[...new Set([...ids,...extra.map(q=>q.id)])];
   all.forEach(id=>counted.add(id));
   if(all.length)groups.push({label:point.pattern,lesson:l.n,count:all.length,first:all[0]});
  }
  const rest=l.questions.filter(q=>wrongIds.has(q.id)&&lessonSkill(q)==='grammar'&&!counted.has(q.id));
  if(rest.length)groups.push({label:'Ngữ pháp khác',lesson:l.n,count:rest.length,first:rest[0].id});
 }
 groups.sort((a,b)=>b.count-a.count);
 const grammar=groups.length?'<ul class="grammar-list">'+groups.slice(0,8).map(x=>'<li><button type="button" class="link-btn" data-action="lesson-weak:'+x.lesson+':grammar"><span class="han">'+esc(x.label)+'</span> ('+esc(lessonLabel(x.lesson))+') · '+x.count+' câu sai</button></li>').join('')+'</ul>':'<p>Chưa có câu ngữ pháp sai.</p>';

 // Lịch sử kiểm tra & đề: đề đã nộp, đề đang làm, đề đã mở chưa nộp và kiểm tra cuối bài.
 const papers=catalog.examCatalog?.papers??[];
 const fmtShort=t=>new Date(t).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
 const entries=[];
 for(const h of state.history){
  const paper=papers.find(p=>p.id===h.examCode);
  if(paper){
   const score=(h.sections??[]).reduce((n,s)=>n+pct(s.correct,s.graded??s.total),0),max=paper.sections.length*100;
   entries.push({at:h.at,t:paper.title,m:(h.mode==='timed'?'Có giờ':h.mode==='practice'?'Không tính giờ':'Đề ôn thi')+' · nộp '+fmtShort(h.at)+' · '+(h.sections??[]).map(s=>s.name.replace(/ hiểu$/,'')+' '+pct(s.correct,s.graded??s.total)).join(' · '),s:'Đã nộp · '+score+'/'+max,k:score>=max*0.6?'ok':'bad'});
  }else{
   const p=pct(h.correct,h.graded);
   entries.push({at:h.at,t:h.final?'Kiểm tra cuối bài · '+lessonLabel(h.final):h.title,m:'Nộp '+fmtShort(h.at)+(h.count?' · '+h.count+' câu':''),s:h.graded?h.correct+'/'+h.graded:'Tự đối chiếu',k:!h.graded?'muted':p>=80?'ok':p>=50?'warn':'bad'});
  }
 }
 const pageViews={};
 for(const [key,at] of Object.entries(state.views?.examPages??{})){const [id,page]=key.split(':');const v=pageViews[id]??={at:0,page:0};v.at=Math.max(v.at,at);v.page=Math.max(v.page,+page)}
 for(const paper of papers){
  const draft=storage('exam-'+paper.id+'-draft',null);
  if(draft){entries.push({at:Math.max(draft.startedAt??0,pageViews[paper.id]?.at??0),t:paper.title,m:(draft.deadline?'Có giờ':'Không tính giờ')+(draft.startedAt?' · mở '+fmtShort(draft.startedAt):'')+' · đã trả lời '+Object.keys(draft.answers).length+'/'+paper.answerKey.length,s:'Đang làm',k:'warn'});continue}
  const v=pageViews[paper.id];
  if(v&&!state.history.some(h=>h.examCode===paper.id))entries.push({at:v.at,t:paper.title,m:'Mở '+fmtShort(v.at)+' · xem tới trang '+v.page,s:'Đã mở, chưa nộp',k:'muted'});
 }
 entries.sort((a,b)=>b.at-a.at);
 const history=entries.slice(0,8).map(x=>'<div class="kv"><div class="grow"><strong>'+esc(x.t)+'</strong><small class="muted">'+esc(x.m)+'</small></div><span class="badge" data-k="'+x.k+'">'+esc(x.s)+'</span></div>').join('');

 const opened=gr=>gr.kind==='hsk'?'Mở '+[...Array(gr.maxLevel).keys()].map(i=>'HSK '+(i+1)).concat([1,2].filter(n=>n<=gr.maxLevel).map(n=>'HSK '+n+' bản 3.0')).join(', '):'Chuyên mục riêng';
 const grants=viewer.admin?'<div class="kv"><div class="grow"><strong>Quản trị viên</strong><small class="muted">Mở toàn bộ HSK 1–4 và chuyên mục</small></div><span class="badge" data-k="ok">Toàn quyền</span></div>':(viewer.grants??[]).map(gr=>{const left=Math.ceil((gr.expiresAt-Date.now())/DAY_MS);return '<div class="kv"><div class="grow"><strong>'+esc(gr.kind==='hsk'?'HSK · tối đa HSK '+gr.maxLevel:grantName(gr))+'</strong><small class="muted">'+esc(opened(gr))+'</small></div><span class="badge" data-k="'+(left<=7?'warn':'ok')+'">'+(left<=7?'còn '+dayWord(Math.max(0,left)):'đến '+esc(fmtDate(gr.expiresAt)))+'</span></div>'}).join('');

 const sum=Math.max(1,state.attempts.length);
 return pageHead(tr('Tiến độ học tập · ','Your progress · ','学习进度 · ')+courseName,'Lịch sử luyện tập, từ đã đánh dấu và kết quả được lưu theo email và từng khóa.')+stats+
  '<div class="main-split"><section class="panel main progress-list" aria-labelledby="pb-h"><h2 id="pb-h">Tiến độ theo bài</h2><div>'+rows+'</div></section><aside class="side-col">'+
  '<section class="panel"><h3>Kết quả câu hỏi</h3><p>'+correct.toLocaleString('vi-VN')+' đúng · '+wrongCount.toLocaleString('vi-VN')+' sai · '+self.toLocaleString('vi-VN')+' tự đối chiếu (không tính điểm)</p><div class="splitbar" role="img" aria-label="'+pct(correct,sum)+'% đúng, '+pct(wrongCount,sum)+'% sai, '+pct(self,sum)+'% tự đối chiếu"><i style="width:'+pct(correct,sum)+'%;background:var(--green-btn)"></i><i style="width:'+pct(wrongCount,sum)+'%;background:var(--bad)"></i><i style="width:'+pct(self,sum)+'%;background:#d9a441"></i></div>'+
  '<h4 class="form-actions">Ngữ pháp cần ôn</h4>'+grammar+'</section>'+
  '<section class="panel"><h3>Lịch sử kiểm tra &amp; đề</h3><div class="form-actions">'+(history||'<p>Chưa có bài kiểm tra hoặc đề nào.</p>')+'</div>'+(catalog.examCatalog?'<div class="form-actions">'+button('Tất cả đề ôn thi','go:exams','text')+'</div>':'')+'</section>'+
  '<section class="panel"><h3>Quyền học của bạn</h3><div class="form-actions">'+(grants||'<p>Không có thông tin quyền.</p>')+'</div></section></aside></div>';
}

// ----- Ngân hàng luyện tập -----
function bankPool(form){
 const group=form.get('group'),mode=form.get('mode');
 const attempted=new Set(state.attempts.map(a=>a.id)),wrong=new Set(wrongQuestions().map(q=>q.id));
 return levelQuestions.filter(q=>(!group||q.group===group)
  &&(form.get('layer')!=='current'||q.group!=='vocab'||q.wordLevel===course)
  &&(mode!=='new'||!attempted.has(q.id))&&(mode!=='wrong'||wrong.has(q.id))&&!q.resource);
}
function updateBankSummary(){
 const formEl=$('bank-form');if(!formEl)return;
 const form=new FormData(formEl),want=Number(form.get('count')),avail=bankPool(form).length,actual=Math.min(want,avail);
 $('bank-start').innerHTML='Bắt đầu luyện · '+actual+' câu '+svg('arrow');
 $('bank-start').disabled=!actual;
 $('bank-short').innerHTML=avail<want?'<span class="badge" data-k="'+(avail?'warn':'bad')+'">'+(avail?'Kho chỉ có '+avail+' câu phù hợp — lượt này gồm '+actual+' câu':'Không có câu phù hợp với lựa chọn này')+'</span>':'';
}
function bank(){
 const attempted=new Set(state.attempts.map(a=>a.id));
 const words=wordlist.filter(w=>isWorkplace||w.level<=course);
 const cats=[['','Luyện tổng hợp',levelQuestions],...bankNames.map(group=>[group,bankGroups[group],levelQuestions.filter(q=>q.group===group)])];
 const catCards=cats.map(([group,name,items],i)=>{const done=items.filter(q=>attempted.has(q.id)).length;return '<label class="pick-card"><input type="radio" name="group" value="'+group+'" '+(i===0?'checked':'')+'><strong>'+esc(name)+'</strong><span class="muted">'+done+'/'+items.length+' câu đã thử</span>'+barHtml(pct(done,items.length),'thin')+'</label>'}).join('');
 const dict=words.map(w=>'<div class="dict-item" data-word-search="'+esc(searchText(w.zh+' '+w.readings.join(' ')+' '+w.vi))+'"><strong class="zh han" lang="zh-CN">'+esc(w.zh)+'</strong><div class="grow"><span>'+esc(w.pinyin)+'</span><small class="muted">'+esc(w.vi)+' · '+(isWorkplace?courseName:'HSK '+w.level)+'</small></div></div>').join('');
 setTimeout(updateBankSummary);
 return pageHead('Ngân hàng luyện tập · '+courseName,'Chọn kỹ năng và số câu muốn ôn. Câu hỏi lấy từ kho của cấp, không phụ thuộc bài đang học.')+
  '<form id="bank-form" class="cards"><fieldset class="pick-cards" style="border:0;padding:0;margin:0"><legend class="sr">Kỹ năng</legend>'+catCards+'</fieldset>'+
  '<section class="panel cards" aria-label="Thiết lập lượt luyện"><div class="fields">'+
  (isWorkplace?'':'<label>Phạm vi từ vựng<select name="layer"><option value="">Cấp hiện tại và nền tảng</option><option value="current">Chỉ từ mới của '+esc(courseName)+'</option></select></label>')+
  '<label>Chế độ<select name="mode"><option value="mixed">Trộn câu hỏi</option><option value="new">Câu chưa làm</option><option value="wrong">Làm lại câu sai</option></select></label>'+
  '<div class="cards" style="gap:6px"><span class="lbl" id="bank-count">Số câu</span><div class="radio-seg" role="radiogroup" aria-labelledby="bank-count">'+[10,20,30,50].map((n,i)=>'<label><input type="radio" name="count" value="'+n+'" '+(i===0?'checked':'')+'>'+n+'</label>').join('')+'</div></div></div>'+
  '<div class="wrap"><button type="submit" class="btn primary" id="bank-start">Bắt đầu luyện '+svg('arrow')+'</button><span id="bank-short" role="status"></span></div></section></form>'+
  '<section class="panel form-actions" aria-labelledby="dict-h"><div class="row split"><h2 id="dict-h">Tra từ vựng · '+words.length+' mục</h2><div class="row"><label class="sr" for="vocab-search">Tìm từ</label><input id="vocab-search" type="search" placeholder="Chữ Hán, pinyin hoặc nghĩa…"><small id="vocab-count" role="status">'+words.length+' từ</small></div></div>'+
  '<div class="dict-grid form-actions">'+dict+'</div>'+
  (isWorkplace||isEdition30?'':'<small class="form-actions" style="display:block">Phân cấp và pinyin từ <a href="https://github.com/drkameleon/complete-hsk-vocabulary" target="_blank" rel="noopener">Complete HSK Vocabulary</a> · <a href="./hsk-vocabulary-LICENSE.txt">MIT</a></small>')+'</section>';
}

// ----- Ôn tổng hợp -----
function practicePool(f){
 const ns=f.getAll('lesson').map(Number),skills=f.getAll('kind').map(Number),level=f.get('level'),mode=f.get('mode'),origin=f.get('origin');
 const wrong=new Set(wrongQuestions().map(q=>q.id));
 return questions.filter(q=>(q.origin==='bank'?origin==='bank'||!origin&&f.has('include-level'):ns.includes(q.lesson))&&skills.includes(q.kind)&&(!level||q.level===level)&&(!origin||(origin==='extra'?['extra','guided','curriculum'].includes(q.origin):origin==='bank'?q.origin==='bank':['original','practice'].includes(q.origin)))&&!q.resource&&(mode!=='wrong'||wrong.has(q.id))&&(mode!=='words'||state.words[q.word]==='unknown')&&(mode!=='scored'||q.answers?.length)&&(!q.audio||lessonSkill(q)!=='listen'||canPlay(q.audio,q.pinyin)));
}
const practiceSources=[['','Tất cả nguồn','Bài tập gốc, câu luyện theo bài và luyện mở rộng'],['slides','Bài tập gốc','Câu trong slide và câu luyện theo bài'],['extra','Luyện mở rộng','Tình huống mới soạn theo chủ điểm của bài'],['bank','Kiến thức theo cấp HSK','Ngân hàng câu hỏi theo cấp, không theo bài']];
const practiceModes={smart:'Ôn tập thông minh',random:'Ngẫu nhiên',wrong:'Câu từng sai',words:'Từ chưa thuộc',scored:'Chỉ câu tự chấm'};
function updatePracticeSummary(){
 const formEl=$('practice-form');if(!formEl)return;
 const f=new FormData(formEl),want=+f.get('count'),avail=practicePool(f).length,actual=Math.min(want,avail);
 const ns=f.getAll('lesson'),kindsOn=f.getAll('kind').map(Number);
 const set=(id,v)=>{const el=$(id);if(el)el.textContent=v};
 set('sum-lessons',ns.length===lessons.length?'Tất cả '+ns.length+' bài':ns.length?ns.length+' bài · '+ns.slice(0,6).map(n=>lessonLabel(+n).replace('Bài ','')).join(', ')+(ns.length>6?'…':''):'Chưa chọn');
 set('sum-skills',kindsOn.length?kindsOn.map(i=>kinds[i]).join(', '):'Chưa chọn');
 set('sum-level',f.get('level')||'Mọi độ khó');
 set('sum-source',practiceSources.find(([k])=>k===(f.get('origin')??''))?.[1]??'Tất cả nguồn');
 set('sum-mode',practiceModes[f.get('mode')]??'');
 set('sum-actual',actual);
 $('sum-note').innerHTML=!avail?'<div class="note" data-k="bad" role="status"><div>Không có câu phù hợp. Hãy chọn thêm bài, kỹ năng hoặc đổi nguồn câu hỏi.</div></div>':avail<want?'<div class="note" data-k="warn" role="status"><div>Chỉ có '+avail+' câu phù hợp, ít hơn '+want+' câu bạn chọn. Lượt ôn sẽ gồm '+actual+' câu.</div></div>':'';
 $('practice-start').disabled=!avail;
}
function practice(){
 setTimeout(updatePracticeSummary);
 const unit=isWorkplace?'chủ đề':'bài';
 return pageHead(tr('Ôn tổng hợp','Mixed review','综合复习'),tr('Tự tạo lượt ôn từ nhiều bài, kỹ năng và độ khó.','Build a session from your chosen lessons and skills.','选择课程和技能，创建复习练习。'))+
  '<div class="builder"><form class="panel" id="practice-form">'+
  '<section class="builder-step"><div class="row split"><h2>1. Chọn '+unit+' · '+esc(courseName)+'</h2><div class="wrap">'+button('Bài 1–5','range:5')+button('Bài 1–10','range:10')+button('Chọn tất cả','range:999')+'</div></div><div class="chips-select">'+lessons.map(l=>'<label class="pill-check" title="'+esc(l.zh+' · '+l.vi)+'"><input type="checkbox" name="lesson" value="'+l.n+'" checked>'+esc(lessonLabel(l.n))+'</label>').join('')+'</div></section>'+
  '<section class="builder-step"><h2>2. Kỹ năng</h2><div class="chips-select">'+kinds.map((k,i)=>'<label class="pill-check"><input type="checkbox" name="kind" value="'+i+'" '+(preset===null||preset===i?'checked':'')+'>'+esc(k)+'</label>').join('')+'</div></section>'+
  '<div class="fields"><section class="builder-step"><h2 id="lvl-h">3. Độ khó</h2><div class="radio-seg" role="radiogroup" aria-labelledby="lvl-h">'+[['','Tất cả'],['Dễ','Dễ'],['Trung bình','Trung bình'],['Khó','Khó']].map(([v,t],i)=>'<label><input type="radio" name="level" value="'+v+'" '+(i===0?'checked':'')+'>'+t+'</label>').join('')+'</div></section>'+
  '<section class="builder-step"><h2 id="cnt-h">4. Số câu</h2><div class="radio-seg" role="radiogroup" aria-labelledby="cnt-h">'+[10,20,30,50].map((n,i)=>'<label><input type="radio" name="count" value="'+n+'" '+(i===0?'checked':'')+'>'+n+'</label>').join('')+'</div></section></div>'+
  '<section class="builder-step"><h2>5. Nguồn câu hỏi</h2><div class="source-opts" role="radiogroup" aria-label="Nguồn câu hỏi">'+practiceSources.map(([v,t,d],i)=>'<label class="pick-card"><input type="radio" name="origin" value="'+v+'" '+(i===0?'checked':'')+'><span><strong>'+t+'</strong><small class="muted">'+d+'</small></span></label>').join('')+'</div>'+
  '<div class="fields"><label>Chế độ<select name="mode">'+Object.entries(practiceModes).map(([k,t])=>'<option value="'+k+'">'+t+'</option>').join('')+'</select></label></div><label class="check"><input type="checkbox" name="include-level"> Trộn thêm kho kiến thức theo cấp</label></section>'+
  '<div id="share-box"></div></form>'+
  '<aside class="panel summary-card"><h2 style="font-size:19px;margin:0">Lượt ôn của bạn</h2><dl><dt>Khóa</dt><dd>'+esc(courseName)+'</dd><dt>'+(isWorkplace?'Chủ đề':'Bài')+'</dt><dd id="sum-lessons"></dd><dt>Kỹ năng</dt><dd id="sum-skills"></dd><dt>Độ khó</dt><dd id="sum-level"></dd><dt>Nguồn</dt><dd id="sum-source"></dd><dt>Chế độ</dt><dd id="sum-mode"></dd></dl>'+
  '<div class="big"><span class="muted">Số câu thực tế</span><span><b id="sum-actual">0</b> câu</span></div><div id="sum-note"></div>'+
  '<button class="btn primary" id="practice-start" form="practice-form">Bắt đầu ôn '+svg('arrow')+'</button><button class="btn" name="share" value="1" form="practice-form">Tạo link đề</button>'+
  '<p style="font-size:12.5px">Ôn tập thông minh ưu tiên câu sai gần nhất, từ chưa thuộc và nội dung ít được ôn. Câu tự luận không có đáp án được lưu để tự đối chiếu, không tính điểm.</p></aside></div>';
}

// ----- Giáo viên · Câu hỏi & lượt ôn -----
let teacherTab='bank',teacherFilter={lesson:'',kind:'',q:''},teacherPage=0,teacherPick=null;
const shareLinks=storage('shares',[]);
function teacherRows(){
 const term=searchText(teacherFilter.q);
 return questions.filter(q=>(teacherFilter.lesson===''||(teacherFilter.lesson==='bank'?q.origin==='bank':q.lesson===+teacherFilter.lesson))&&(teacherFilter.kind===''||q.kind===+teacherFilter.kind)&&(!term||searchText((q.prompt??'')+' '+(q.zh??'')+' '+(q.id??'')).includes(term)));
}
const originBadge=q=>({teacher:['Giáo viên','ok'],original:['Bài tập gốc','muted'],practice:['Câu luyện theo bài','muted'],bank:['Theo cấp HSK','warn'],guided:['Tình huống','muted'],curriculum:['Ngữ pháp','muted'],extra:['Mở rộng','muted']}[q.origin]??[q.origin??'—','muted']);
function questionEditor(){
 const q=teacherPick==='new'?{id:'',kind:0,level:'Trung bình',prompt:'',lesson:teacherLesson,options:['','','',''],answers:[]}:getQuestion(teacherPick);
 if(!q)return '<section class="panel cards"><h2>Biên tập câu hỏi</h2><p>Chọn một câu trong danh sách để xem và sửa, hoặc bấm “+ Thêm câu hỏi”.</p>'+note('<span>Câu hỏi giáo viên thêm hoặc sửa được lưu trên trình duyệt này và áp dụng ngay cho bài học.</span>')+'</section>';
 const readonly=q.origin==='bank';
 const mc=Boolean(q.options?.length)||teacherPick==='new';
 const opts=[...(q.options??[]),'','','',''].slice(0,Math.max(4,q.options?.length??0));
 const voices=q.zh?Object.entries(flashcardReaders).map(([id,label])=>'<span class="badge" data-k="'+(readerSource(voiceKey(q.zh,q.pinyin),id)?'ok':'muted')+'">'+esc(label)+(readerSource(voiceKey(q.zh,q.pinyin),id)?'':' · chưa có')+'</span>').join(''):'<small class="muted">Câu không có chữ Hán để đọc.</small>';
 const dis=readonly?' disabled':'';
 return '<form id="q-form" class="panel cards" data-id="'+esc(q.id??'')+'"><div class="row split"><h2>'+(teacherPick==='new'?'Thêm câu hỏi':'Sửa câu hỏi')+'</h2><small class="muted">'+esc(q.id||'Mã mới tự tạo')+'</small></div>'+
  (readonly?note('Câu theo cấp HSK lấy từ ngân hàng chung, chỉ xem được ở đây.','warn'):'')+
  '<div class="fields"><label>Bài<select name="lesson"'+dis+'>'+lessons.map(l=>'<option value="'+l.n+'" '+(l.n===(q.lesson??teacherLesson)?'selected':'')+'>'+esc(lessonLabel(l.n))+'</option>').join('')+'</select></label>'+
  '<label>Dạng câu<select name="kind"'+dis+'>'+kinds.map((k,i)=>'<option value="'+i+'" '+(i===q.kind?'selected':'')+'>'+esc(k)+'</option>').join('')+'</select></label>'+
  '<label>Độ khó<select name="level"'+dis+'>'+['Dễ','Trung bình','Khó'].map(v=>'<option '+(v===q.level?'selected':'')+'>'+v+'</option>').join('')+'</select></label></div>'+
  '<label class="lbl">Yêu cầu<textarea name="prompt" rows="2" required'+dis+'>'+esc(q.prompt)+'</textarea></label>'+
  '<label class="lbl">Đề bài (chữ Hán)<input name="zh" class="han" lang="zh-CN" value="'+esc(q.zh??'')+'"'+dis+'></label>'+
  '<div class="fields"><label>Pinyin<input name="pinyin" value="'+esc(q.pinyin??'')+'"'+dis+'></label><label>Bản dịch<input name="vi" value="'+esc(q.vi??'')+'"'+dis+'></label></div>'+
  (mc?'<fieldset class="grant-block"><legend>Phương án · chọn đáp án đúng</legend>'+opts.map((o,i)=>'<div class="row"><input type="radio" name="correct" value="'+i+'" '+(q.answers?.includes(o)&&o?'checked':'')+' aria-label="Phương án '+(i+1)+' là đáp án đúng"'+dis+'><input name="option" class="han" lang="zh-CN" value="'+esc(o)+'" aria-label="Phương án '+(i+1)+'" style="flex:1"'+dis+'></div>').join('')+'<small class="muted">Để trống phương án không dùng. Bỏ hết phương án để chuyển sang câu tự nhập.</small></fieldset>':
  '<label class="lbl">Đáp án được chấp nhận (mỗi dòng một đáp án)<textarea name="answers" rows="3" class="han"'+dis+'>'+esc((q.answers??[]).join('\n'))+'</textarea><small class="muted">Nếu học viên trả lời khác các đáp án này, hệ thống cho học viên tự đối chiếu với đáp án mẫu.</small></label>')+
  '<label class="lbl">Giải thích (tiếng Việt)<textarea name="explanation" rows="2"'+dis+'>'+esc(q.explanation??'')+'</textarea></label>'+
  '<div class="cards" style="gap:6px"><span class="lbl">Âm thanh</span><div class="wrap">'+voices+'</div></div>'+
  '<small class="muted">Nguồn: '+esc(originBadge(q)[0])+(q.slide?' · slide '+q.slide:'')+(q.lesson?' · '+lessonLabel(q.lesson):'')+'</small>'+
  (readonly?'':'<div class="wrap"><button class="btn primary">Lưu câu hỏi</button>'+(q.lesson?'<a class="btn" href="#lesson/'+q.lesson+'">Xem bài học →</a>':'')+'</div>')+'</form>';
}
function saveTeacherQuestion(formEl){
 const f=new FormData(formEl),l=getLesson(f.get('lesson'));
 const optionValues=f.getAll('option').map(v=>String(v).trim()),correct=f.get('correct');
 const options=optionValues.filter(Boolean);
 const q={id:formEl.dataset.id||'edit-'+crypto.randomUUID(),kind:+f.get('kind'),level:String(f.get('level')),prompt:String(f.get('prompt')).trim()};
 for(const key of ['zh','pinyin','vi','explanation']){const v=String(f.get(key)??'').trim();if(v)q[key]=v}
 if(f.has('option')&&options.length){
  q.options=options;
  const answer=correct!==null?optionValues[+correct]:'';
  if(!answer){notify('Chọn phương án đúng.');return}
  q.answers=[answer];
 }else q.answers=String(f.get('answers')??'').split('\n').map(v=>v.trim()).filter(Boolean);
 const original=getQuestion(q.id);
 if(original?.slide)q.slide=original.slide;
 if(original?.audio)q.audio=original.audio;
 if(!validQuestion(q,l)){notify('Không lưu được: kiểm tra yêu cầu, độ khó và đáp án.');return}
 if(original&&original.lesson!==l.n){notify('Câu có sẵn không chuyển được sang bài khác. Hãy thêm câu mới.');return}
 const update={...edits,[l.n]:{...(edits[l.n]??{}),questions:[...new Map([...(edits[l.n]?.questions??[]),{...q,origin:'teacher'}].map(x=>[x.id,x])).values()]}};
 if(persist('content',update)){Object.assign(edits,update);refreshData();teacherPick=q.id;teacherLesson=l.n;render();notify('Đã lưu câu hỏi cho '+lessonLabel(l.n)+'.')}
}
function teacher(){
 const tabs=[['bank','Câu hỏi'],['share','Lượt ôn chia sẻ'],['json','Nhập JSON']];
 let body='';
 if(teacherTab==='bank'){
  const rows=teacherRows(),size=25,last=Math.max(0,Math.ceil(rows.length/size)-1);
  teacherPage=Math.min(teacherPage,last);
  body='<div class="two-col"><section class="panel cards" aria-label="Danh sách câu hỏi"><div class="toolbar">'+
   '<label>Bài<select id="t-lesson"><option value="">Tất cả</option>'+lessons.map(l=>'<option value="'+l.n+'" '+(teacherFilter.lesson===String(l.n)?'selected':'')+'>'+esc(lessonLabel(l.n))+'</option>').join('')+'<option value="bank" '+(teacherFilter.lesson==='bank'?'selected':'')+'>Theo cấp HSK</option></select></label>'+
   '<label>Kỹ năng<select id="t-kind"><option value="">Tất cả</option>'+kinds.map((k,i)=>'<option value="'+i+'" '+(teacherFilter.kind===String(i)?'selected':'')+'>'+esc(k)+'</option>').join('')+'</select></label>'+
   '<label>Tìm<input id="t-search" type="search" placeholder="Nội dung hoặc mã…" value="'+esc(teacherFilter.q)+'"></label>'+button('+ Thêm câu hỏi','tq-new','','primary')+'</div>'+
   '<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Nội dung</th><th scope="col">Bài</th><th scope="col">Dạng</th><th scope="col">Nguồn</th></tr></thead><tbody>'+
   rows.slice(teacherPage*size,(teacherPage+1)*size).map(q=>{const [src,k]=originBadge(q);return '<tr class="'+(q.id===teacherPick?'current':'')+'"><td><button type="button" class="source-pick" data-action="tq:'+esc(q.id)+'" aria-pressed="'+(q.id===teacherPick)+'"><strong>'+esc(q.prompt.replace(/\n/g,' ').slice(0,90))+'</strong><small class="muted han">'+esc(q.zh??'')+' · '+esc(q.level??'')+'</small></button></td><td>'+esc(q.origin==='bank'?'Cấp HSK':lessonLabel(q.lesson))+'</td><td><span class="chip">'+esc(kinds[q.kind]??'—')+'</span></td><td><span class="badge" data-k="'+k+'">'+src+'</span></td></tr>'}).join('')+
   '</tbody></table></div><div class="row split"><small class="muted">'+rows.length+' câu'+(last?' · trang '+(teacherPage+1)+'/'+(last+1):'')+'</small><div class="wrap">'+(teacherPage?button('‹ Trước','tpage:-1'):'')+(teacherPage<last?button('Sau ›','tpage:1'):'')+'</div></div></section>'+questionEditor()+'</div>';
 }else if(teacherTab==='share'){
  const rows=shareLinks.slice().reverse().map((s,i)=>'<tr><td><strong>'+esc(s.name)+'</strong><br><small class="muted" style="overflow-wrap:anywhere">'+esc(s.url.slice(0,70))+'…</small></td><td>'+esc(s.scope)+'</td><td>'+s.n+'</td><td class="muted">'+esc(fmtDateTime(s.at))+'</td><td>'+button('Sao chép','share-copy:'+(shareLinks.length-1-i))+'</td></tr>').join('');
  body='<div class="two-col"><form id="share-form" class="panel cards"><h2>Tạo lượt ôn theo phạm vi</h2>'+
   '<label class="lbl">Tên lượt ôn<input name="name" value="Ôn tập '+esc(courseName)+'" required></label>'+
   '<div class="fields"><label>Khóa / chuyên mục<input value="'+esc(courseName)+'" readonly></label><label>Bài<input name="range" placeholder="VD: 1-5, 8" value="1-'+lessonCount()+'"></label></div>'+
   '<div class="cards" style="gap:6px"><span class="lbl" id="sh-cnt">Số câu</span><div class="radio-seg" role="radiogroup" aria-labelledby="sh-cnt">'+[10,20,30,50].map((n,i)=>'<label><input type="radio" name="count" value="'+n+'" '+(i===1?'checked':'')+'>'+n+'</label>').join('')+'</div></div>'+
   '<div class="wrap"><button class="btn primary">Tạo link chia sẻ</button></div><div id="share-box"></div>'+
   note('<span>Link chỉ mở cho người đã đăng nhập và có quyền còn hạn với khóa hoặc chuyên mục của lượt ôn. Người không đủ quyền thấy thông báo và không xem được câu hỏi.</span>')+'</form>'+
   '<section class="panel cards"><h2>Lượt ôn đã tạo</h2>'+(rows?'<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Tên</th><th scope="col">Phạm vi</th><th scope="col">Số câu</th><th scope="col">Tạo lúc</th><th scope="col"><span class="sr">Thao tác</span></th></tr></thead><tbody>'+rows+'</tbody></table></div><small class="muted">Danh sách lưu trên trình duyệt này.</small>':'<p>Chưa tạo lượt ôn nào.</p>')+'</section></div>';
 }else{
  const l=getLesson(teacherLesson);
  body='<div class="two-col"><form id="edit-form" class="panel cards"><h2>Nhập hoặc sửa nhiều câu bằng JSON</h2><p>Số slide là thông tin tham chiếu tùy chọn. Để trống mảng đáp án cho câu tự đối chiếu.</p><div class="toolbar"><label>Bài học<select id="teacher-lesson">'+lessons.map(x=>'<option '+(l.n===x.n?'selected':'')+' value="'+x.n+'">'+esc(lessonLabel(x.n))+' · '+esc(x.zh)+'</option>').join('')+'</select></label><label>Nhập tệp JSON<input id="import" type="file" accept=".json,application/json"></label>'+button('Mẫu JSON','example')+'</div><textarea id="json" rows="14" aria-label="Dữ liệu câu hỏi JSON" required>'+esc(JSON.stringify(jsonExample,null,2))+'</textarea><div class="wrap"><button class="btn primary">Lưu cho '+esc(lessonLabel(l.n))+'</button><a class="btn" href="#lesson/'+l.n+'">Xem bài dành cho học viên →</a></div></form>'+
   '<section class="panel cards"><h2>Nguồn '+esc(lessonLabel(l.n))+'</h2><p>'+l.slides.length+' slide · '+l.vocab.length+' từ · '+l.questions.length+' câu và bài tập</p><details class="source"><summary>Từ vựng đã tách</summary><div class="table-wrap"><table class="table"><thead><tr><th>Hán tự</th><th>Pinyin</th><th>Nghĩa</th><th>Slide</th></tr></thead><tbody>'+l.vocab.map(w=>'<tr><td class="han">'+esc(w.zh)+'</td><td>'+esc(w.pinyin)+'</td><td>'+esc(w.vi)+'</td><td>'+(w.slide??'')+'</td></tr>').join('')+'</tbody></table></div></details>'+
   (viewer.admin?'<a class="btn" href="/admin/sources">Kiểm kê nguồn học liệu →</a>':'')+'</section></div>';
 }
 return pageHead(tr('Câu hỏi & lượt ôn','Questions & review sets','题目与复习'),'Giáo viên xem, thêm, sửa câu hỏi theo bài hoặc cấp HSK, và tạo link ôn tập để chia sẻ. Thay đổi được lưu trên trình duyệt này.',seg(tabs.map(([k,t])=>['ttab:'+k,t,teacherTab===k]),'Mục'))+body;
}
function parseRange(text){
 const set=new Set();
 for(const part of String(text).split(',')){const [a,b]=part.split('-').map(x=>parseInt(x,10));if(Number.isInteger(a))for(let n=a;n<=(Number.isInteger(b)?b:a)&&n-a<200;n++)set.add(n)}
 return set;
}
function createShare(formEl){
 const f=new FormData(formEl),range=parseRange(f.get('range')),count=+f.get('count');
 const pool=questions.filter(q=>range.has(q.lesson)&&q.origin!=='teacher'&&q.origin!=='bank'&&!q.resource);
 const ids=shuffle(pool).slice(0,count).map(q=>q.id);
 if(!ids.length){notify('Không có câu phù hợp với phạm vi bài này.');return}
 const u=new URL(location.href);u.hash='';u.search=baseQuery;u.searchParams.set('de',ids.join(','));
 shareLinks.push({name:String(f.get('name')).trim()||'Lượt ôn',scope:courseName+' · bài '+String(f.get('range')).trim(),n:ids.length,url:u.href,at:Date.now()});
 persist('shares',shareLinks.slice(-30));
 render();copyLink(u.href);
}

const tutor=viewer.aiAvailable?createTutorChat({
 courseId,courseName,
 lessonAt:hash=>{
  const [screen,n]=hash.split('/');
  if(screen==='lesson'&&lessons.some(lesson=>lesson.n===Number(n)))return Number(n);
  if(screen==='quiz'&&quiz&&!quiz.done){
   const question=getQuestion(quiz.ids[quiz.index]);
   if(lessons.some(lesson=>lesson.n===question?.lesson))return question.lesson;
  }
  return null;
 },
 lessonOptions:()=>lessons.map(lesson=>[String(lesson.n),lessonLabel(lesson.n)+' · '+lesson.zh]),
 navigate:(page,mini=false)=>{
  if(mini)miniAfterNavigation=true;
  go(page);
 }
}):null;
let miniAfterNavigation=false;

function render(){
 const [page='home',n,tab]=(location.hash.slice(1)||'home').split('/');
 chrome(page);
 $('app').innerHTML=({home,chat:tutor?()=> '':home,lessons:lessonDirectory,lesson:()=>lessonPage(n,tab),bank,listening:workplaceListeningPage,exams:()=>exams.page(n,tab),practice,quiz:quizPage,progress,review,teacher:viewer.admin?teacher:home}[page]??home)();
 if(tutor){
  tutor.update(page,location.hash.slice(1)||'home');
  if(miniAfterNavigation&&page!=='chat'){miniAfterNavigation=false;tutor.showMini()}
 }
 if(page==='quiz'&&quiz&&!quiz.done){
  const question=getQuestion(quiz.ids[quiz.index]);
  if(question)syncProgress.recordView('questions',question.id);
 }
}
function copyLink(value){
 const box=$('share-box');
 if(box)box.innerHTML='<label>Link đề <input id="share-url" type="url" readonly value="'+esc(value)+'"></label><p>Link giữ nguyên cấp HSK và danh sách câu hỏi của đề.</p>';
 navigator.clipboard?.writeText(value).then(()=>notify('Đã sao chép link đề.')).catch(()=>{});
}
function shared(){
 const p=new URLSearchParams(location.search);if(!p.has('de'))return;
 const ids=p.get('de').split(',').slice(0,50);
 if(!ids.length)return;
 history.replaceState(null,'',location.pathname+baseQuery+location.hash);
 const q=ids.map(getQuestion).filter(Boolean);
 if(q.length)start(q,'Đề ôn tập được chia sẻ');else notify('Link đề không có câu phù hợp.');
}
const original=l=>l.questions.filter(q=>q.origin==='original'||q.origin==='teacher');
function handle(action,trigger){
 const [key,x,y]=action.split(':');
 if(key==='exam'){void exams.handle(action.split(':').slice(1));return}
 if(key==='logout'){
  fetch('/api/logout',{method:'POST'}).then(response=>{if(response.ok)location.assign('/');else notify('Chưa đăng xuất được.')}).catch(()=>notify('Chưa đăng xuất được.'));
  return;
 }
 if(key==='reader-preview'||key==='speak'){
  const file=key==='reader-preview'?catalog.flashcardAudio.samples[selectedReader()]:audioChoice(action.slice(6))?.source;
  if(file)playRecording(file,settings.rate,notify,trigger);
  else notify('Giọng này chưa có bản đọc.');
  return;
 }
 if(key==='original-audio'){
  const dialogue=getLesson(x).dialogues.find(d=>d.i===+y);
  if(dialogue)playRecording(dialogue.recording??'original-'+x+'-'+y+'.mp3',settings.rate,notify,trigger);
  return;
 }
 const l=getLesson(x);
 switch(key){
  case 'go': if(x.startsWith('lesson/')){const id=+x.split('/')[1];if(id!==state.last){flash=0;flip=false}state.last=id;save()}go(x);break;
  case 'drawer':document.body.classList.toggle('drawer');break;
  case 'theme':settings.theme=settings.theme==='dark'?'light':'dark';persist('settings',settings);render();break;
  case 'expand':expanded=!expanded;render();break;
  case 'ttab':teacherTab=x;render();break;
  case 'tq':teacherPick=action.slice(3);render();document.getElementById('q-form')?.scrollIntoView({block:'nearest'});break;
  case 'tq-new':teacherPick='new';render();document.querySelector('#q-form textarea')?.focus();break;
  case 'tpage':teacherPage=Math.max(0,teacherPage+(+x));render();break;
  case 'share-copy':{const link=shareLinks[+x];if(link)navigator.clipboard?.writeText(link.url).then(()=>notify('Đã sao chép link lượt ôn.')).catch(()=>notify(link.url));break}
  case 'vmode':stopAudio();vocabMode=x;vocabPick=null;vocabOpts=null;flip=false;render();break;
  case 'vpick':{
   const cur=getLesson(state.last),w=cur.vocab[flash]??cur.vocab[0];
   if(!w||vocabPick!==null||!vocabOpts)break;
   vocabPick=+x;
   if(vocabOpts.items[vocabPick]?.id!==w.id){state.words[w.id]='unknown';save()}
   render();document.querySelector('.qcard .note')?.focus?.();break;
  }
  case 'vnext':{stopAudio();const cur=getLesson(state.last);flash=(flash+1)%Math.max(1,cur.vocab.length);vocabPick=null;vocabOpts=null;flip=false;render();break}
  case 'gpoint':gPoint=+x;render();break;
  case 'ltab':stopAudio();listenTab=x;render();break;
  case 'setting':if(['hideZh','hidePy','showVi'].includes(x)){settings[x]=!settings[x];persist('settings',settings);render()}break;
  case 'rtab':reviewTab=x;if(location.hash==='#review')render();else go('review');break;
  case 'review-all':{const ids=new Set([...wrongQuestions(),...questions.filter(q=>state.marks[q.id]||state.words[q.word]==='unknown')].map(q=>q.id));start(questions.filter(q=>ids.has(q.id)),'Ôn tất cả mục cần ôn',Math.min(50,ids.size),'smart');break}
  case 'qfilter':quizFilter=x;render();break;
  case 'self':{
   const answer=quiz?.answers[+x];
   if(!answer||answer.skipped)break;
   answer.grade=y==='1';
   const stored=state.attempts.find(item=>item.id===answer.id&&item.at===answer.at);
   if(stored)stored.grade=answer.grade;
   const last=state.history.at(-1);
   if(last&&last.title===quiz.title&&last.at>=answer.at){const graded=quiz.answers.filter(item=>item&&item.grade!==null);last.graded=graded.length;last.correct=graded.filter(item=>item.grade).length}
   save();saveQuiz();render();notify(answer.grade?'Đã ghi nhận câu đúng.':'Đã thêm câu vào “Cần ôn lại”.');break;
  }
  case 'prev':if(quiz&&quiz.index>0){stopAudio();quiz.index--;quiz.selection='';quiz.picked=[];saveQuiz();render();window.scrollTo(0,0)}break;
  case 'goal':if(goalChoices.includes(+x)){ensureStudy(state).goal=+x;save();const card=$('goal-card');if(card)card.outerHTML=goalCard();$('goal-card')?.querySelector('[aria-pressed="true"]')?.focus()}break;
  case 'srs-flip':{srsFlip=!srsFlip;const card=$('srs-card');if(card){card.outerHTML=srsCard();$('srs-card')?.querySelector(srsFlip?'.srs-rate .btn':'.srs-flash')?.focus()}break}
  case 'srs-rate':{
   const id=action.split(':').slice(2).join(':'),rating=x;
   if(!['hard','ok','easy'].includes(rating)||!id)break;
   const step=rateCard(state,id,rating);
   if(rating==='hard')state.words[id]='unknown';else if(rating==='easy')state.words[id]='known';
   srsFlip=false;save();
   const card=$('srs-card');if(card){card.outerHTML=srsCard();$('srs-card')?.querySelector('.srs-flash, .srs-empty')?.focus?.()}
   const goal=$('goal-card');if(goal)goal.outerHTML=goalCard();
   notify(rating==='hard'?'Sẽ gặp lại từ này sau 1 ngày.':'Hẹn ôn lại sau '+dayWord(step)+'.');
   break;
  }
  case 'flip':flip=!flip;render();document.querySelector('.flash')?.focus();break;
  case 'flash':{stopAudio();const length=getLesson(state.last).vocab.length;flash=(flash+(+x)+length)%length;flip=false;render();break}
  case 'pickflash':stopAudio();flash=+x;flip=false;render();break;
  case 'word-link':state.last=+x;save();flash=+y;flip=false;go('lesson/'+x);break;
  case 'word':state.words[y]=x;save();render();notify(x==='known'?'Đã đánh dấu thuộc từ.':'Đã thêm từ vào danh sách cần ôn.');break;
  case 'preset':preset=+x;go('practice');break;
  case 'range':document.querySelectorAll('[name="lesson"]').forEach(i=>i.checked=Number(i.value)<=+x);updatePracticeSummary();break;
  case 'quick':start(questions.filter(q=>q.origin!=='bank'&&q.answers?.length), 'Ôn tập nhanh',10,'smart');break;
  case 'lessonquiz':start(l.questions.filter(q=>q.kind===+y),lessonLabel(l.n)+' · '+kinds[+y],Math.min(10,l.questions.filter(q=>q.kind===+y&&!q.resource).length));break;
  case 'translate':start(original(l).filter(q=>q.kind===4&&q.reference),'Bài '+l.n+' · Luyện dịch');break;
  case 'extra':start(l.questions.filter(q=>q.origin==='extra'),lessonLabel(l.n)+' · Luyện mở rộng');break;
  case 'original':start(original(l),'Bài '+l.n+' · Bài luyện',Math.min(15,original(l).filter(q=>!q.resource).length));break;
  case 'one':{const q=getQuestion(x);if(q?.resource){notify('Câu này thiếu tư liệu để làm trực tuyến.');break}if(q)start([q],q.origin==='bank'?courseName+' · '+bankGroups[q.group]:lessonLabel(q.lesson)+' · '+kinds[q.kind]);break}
  case 'grammar-mode':{
   const tab=y==='listen'?'listen':location.hash.endsWith('/extra')?'extra':location.hash.endsWith('/ex')?'ex':'grammar';
   let items=curriculumItems(l,y);
   if(y==='mixed'){
    const other=l.questions.filter(q=>q.kind===1&&q.origin!=='curriculum'&&q.answers?.length&&!q.audio&&!q.resource);
    const correction=curriculumItems(l,'correct');
    const newItems=(l.grammarPoints??[]).map(point=>shuffle(l.questions.filter(q=>q.group===point.group&&['apply','order'].includes(q.mode)))[0]).filter(Boolean);
    items=[...shuffle(other).slice(0,7),...newItems,...correction];
   }
   start(items,lessonLabel(l.n)+' · '+(grammarModes[y]??'Luyện ngữ pháp'),items.length,'random',null,'lesson/'+l.n+'/'+tab);
   break;
  }
  case 'final':{
   const plan=assessmentPlan(l,canPlay,shuffle);
   start(plan,'Kiểm tra cuối bài '+l.n,plan.length,'exam',l.n);break;
  }
  case 'workplace-listen':{
   if(!isWorkplace)break;
   const subset=y?getLesson(y).questions:lessons.flatMap(lesson=>lesson.questions);
   const dictation=x==='dictation';
   const items=workplaceAudioQuestions(subset).filter(q=>dictation?!q.options?.length&&q.answers?.length:q.options?.length);
   start(items,dictation?'Nghe chép chính tả':'Nghe và chọn đáp án',Math.min(items.length,10),'smart',null,y?'lesson/'+y+'/listen':'listening');
   break;
  }
  case 'lesson-dictation':{
   const items=l.questions.filter(q=>q.kind===2&&q.audio&&!q.options&&q.answers?.length&&canPlay(q.audio,q.pinyin));
   start(items,lessonLabel(l.n)+' · Nghe chép lại',Math.min(5,items.length));break;
  }
  case 'slide-closed':start(original(l).filter(q=>q.answers?.length&&!q.resource),'Luyện có đáp án · '+lessonLabel(l.n));break;
  case 'slide-open':start(original(l).filter(q=>!q.answers?.length&&!q.resource),'Tự luận · '+lessonLabel(l.n));break;
  case 'lesson-weak':{
   const subset=wrongQuestions().filter(q=>q.lesson===l.n&&lessonSkill(q)===y&&(!q.audio||canPlay(q.audio,q.pinyin)));
   start(subset.length?subset:l.questions.filter(q=>lessonSkill(q)===y&&q.answers?.length&&(!q.audio||canPlay(q.audio,q.pinyin))),lessonLabel(l.n)+' · Ôn '+lessonSkills[y],Math.min(8,subset.length||l.questions.length),'smart');break;
  }
  case 'review-wrong':start(wrongQuestions(),'Ôn lại câu sai');break;
  case 'review-words':start(questions.filter(q=>state.words[q.word]==='unknown'),'Ôn từ chưa thuộc');break;
  case 'review-marked':start(questions.filter(q=>state.marks[q.id]),'Ôn câu đã đánh dấu');break;
  case 'redo':start(quiz.ids.map(getQuestion),quiz.title,quiz.ids.length,quiz.assessment?'exam':'random',quiz.final,quiz.returnTo,quiz.practicePaper);break;
  case 'redo-wrong':{const missed=quiz.answers.filter(a=>a.grade===false).map(a=>getQuestion(a.id));start(missed,'Làm lại câu sai',missed.length,'random',null,quiz.returnTo);break}
  case 'answer':{const q=getQuestion(quiz.ids[quiz.index]);quiz.selection=quiz.options[q.id][+x];saveQuiz();render();document.querySelector('.option.selected')?.focus();break}
  case 'chunk':{
   const q=getQuestion(quiz.ids[quiz.index]);
   quiz.picked=[...(quiz.picked??[]),+x];quiz.selection=quiz.picked.map(i=>quiz.chunks[q.id][i]).join('');saveQuiz();render();break;
  }
  case 'clear-chunks':quiz.picked=[];quiz.selection='';saveQuiz();render();break;
  case 'mark':state.marks[x]=!state.marks[x];save();render();break;
  case 'skip-audio':{
   const q=getQuestion(quiz.ids[quiz.index]);
   quiz.answers[quiz.index]={id:q.id,value:'',grade:null,skipped:true,at:Date.now()};
  }
  case 'next':
   stopAudio();
   if(quiz.index+1>=quiz.ids.length)finish();
   else{quiz.index++;quiz.selection='';quiz.picked=[];saveQuiz();render();window.scrollTo(0,0)}
   break;
  case 'example':$('json').value=JSON.stringify(jsonExample,null,2);break;
  case 'edit':{const q=getQuestion(x);if(!q)break;$('json').value=JSON.stringify({questions:[q]},null,2);$('json').focus();break}
 }
}
function validQuestion(q,l){
 return q&&typeof q.prompt==='string'&&q.prompt.trim()&&Number.isInteger(q.kind)&&q.kind>=0&&q.kind<kinds.length&&(q.slide===undefined||Number.isInteger(q.slide)&&q.slide>0&&q.slide<=l.slides.length)&&['Dễ','Trung bình','Khó'].includes(q.level)&&(!q.id||/^[a-z0-9-]{1,100}$/i.test(q.id))&&['reference','pinyin','zh','vi','audio','explanation'].every(k=>q[k]===undefined||typeof q[k]==='string')&&['answers','options'].every(k=>q[k]===undefined||(Array.isArray(q[k])&&q[k].every(v=>typeof v==='string'&&v.trim())))&&(!q.options?.length||q.answers?.length&&q.answers.some(x=>q.options.includes(x)));
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');
 if(b){
  if(!state)return;
  if(b.dataset.action.startsWith('go:lesson/')&&!await stillAllowed())return;
  handle(b.dataset.action,b);return;
 }
 if(document.body.classList.contains('drawer')&&!e.target.closest('#sidebar'))document.body.classList.remove('drawer');
});
let teacherSearchTimer;
document.addEventListener('input',e=>{
 if(['t-lesson','t-kind','t-search'].includes(e.target.id)){
  teacherFilter={lesson:$('t-lesson').value,kind:$('t-kind').value,q:$('t-search').value};teacherPage=0;
  const id=e.target.id,caret=id==='t-search'?e.target.selectionStart:null;
  clearTimeout(teacherSearchTimer);
  teacherSearchTimer=setTimeout(()=>{render();const el=$(id);el?.focus();if(caret!==null)el?.setSelectionRange?.(caret,caret)},id==='t-search'?250:0);
 }
 if(e.target.id==='response'&&quiz&&!quiz.answers[quiz.index]){quiz.selection=e.target.value;saveQuiz()}
 if(e.target.id==='vocab-search'){
  const query=searchText(e.target.value);
  let shown=0;
  for(const row of document.querySelectorAll('[data-word-search]')){
   row.hidden=!row.dataset.wordSearch.includes(query);
   if(!row.hidden)shown++;
  }
  $('vocab-count').textContent=shown+' từ';
 }
});
document.addEventListener('change',async e=>{
 const t=e.target;
 if(t.id==='language'){settings.lang=t.value;persist('settings',settings);render();if(settings.lang!=='vi')notify(tr('','Navigation and overview are in English. Lesson tools use Vietnamese.','导航及首页已切换为中文。课程工具保留越南语。'))}
 if(t.id==='flashcard-reader'&&Object.hasOwn(flashcardReaders,t.value)){
  const openDialogs=[...document.querySelectorAll('.source[open] summary')].map(item=>item.textContent);
  const pendingResponse=$('response')?.value;
  stopAudio();settings.flashcardReader=t.value;persist('settings',settings);render();
  if(pendingResponse!==undefined&&$('response'))$('response').value=pendingResponse;
  for(const item of document.querySelectorAll('details.source'))if(openDialogs.includes(item.querySelector('summary')?.textContent))item.open=true;
  $('flashcard-reader')?.focus();
 }
 if(t.id==='rate'){settings.rate=+t.value;setAudioRate(settings.rate);persist('settings',settings)}
 if(t.id==='exam-rate')exams?.setRate(Number(t.value));
 if(t.dataset.setting){settings[t.dataset.setting]=t.checked;persist('settings',settings);render()}
 if(t.id==='teacher-lesson'){teacherLesson=+t.value;render()}
 if(t.closest?.('#practice-form'))updatePracticeSummary();
 if(t.closest?.('#bank-form'))updateBankSummary();
 if(t.id==='import'&&t.files[0]){try{const text=await t.files[0].text();JSON.parse(text);$('json').value=text;notify('Đã đọc JSON. Chọn Lưu để áp dụng cho bài.')}catch{notify('Không đọc được JSON. Hãy kiểm tra định dạng.')} }
});
document.addEventListener('submit',e=>{
 e.preventDefault();
 if(e.target.id==='answer-form'){const q=getQuestion(quiz.ids[quiz.index]);if(q.origin==='curriculum'&&q.order&&(quiz.picked?.length??0)!==q.order.length)return;submitAnswer(q.options?.length||q.origin==='curriculum'&&q.order?quiz.selection:$('response')?.value??'');return}
 if(e.target.id==='bank-form'){
  const form=new FormData(e.target),group=form.get('group');
  const pool=bankPool(form);
  start(pool,courseName+' · '+(bankGroups[group]??'Luyện tổng hợp'),Math.min(Number(form.get('count')),pool.length),group?'random':'balanced');
 }
 if(e.target.id==='practice-form'){
  const f=new FormData(e.target),mode=f.get('mode'),count=+f.get('count');
  const pool=practicePool(f);
  if(e.submitter?.name==='share'){
   const ids=shuffle(pool.filter(q=>q.origin!=='teacher')).slice(0,count).map(q=>q.id);
   if(!ids.length){notify('Chưa có câu gốc phù hợp để tạo link.');return}
   const u=new URL(location.href);u.hash='';u.search=baseQuery;u.searchParams.set('de',ids.join(','));copyLink(u.href);
  }else start(pool,'Ôn tập tổng hợp',count,mode);
 }
 if(e.target.id==='q-form'){saveTeacherQuestion(e.target);return}
 if(e.target.id==='share-form'){createShare(e.target);return}
 if(e.target.id==='edit-form'){
  try{
   const content=JSON.parse($('json').value),l=getLesson(teacherLesson);
   if(!Array.isArray(content.questions)||!content.questions.length||!content.questions.every(q=>validQuestion(q,l)&&(!q.id||!getQuestion(q.id)||getQuestion(q.id).lesson===l.n)))throw Error('Kiểm tra đề bài, độ khó, loại câu (0–5), số slide và định dạng đáp án.');
   const entries=content.questions.map(q=>({...q,id:q.id??'edit-'+crypto.randomUUID(),origin:'teacher'}));
   const update={...edits,[l.n]:{questions:[...new Map([...(edits[l.n]?.questions??[]),...entries].map(q=>[q.id,q])).values()]}};
   if(persist('content',update)){Object.assign(edits,update);refreshData();render();notify('Đã lưu '+entries.length+' câu trên trình duyệt này.')}
  }catch(err){notify('Không lưu được: '+err.message)}
 }
});
window.addEventListener('pagehide',stopAudio);
window.addEventListener('hashchange',()=>{
 if(state&&location.hash.startsWith('#lesson/')){
  const n=+location.hash.split('/')[1];
  if(n!==state.last){state.last=n;flash=0;flip=false;save()}
 }
 if(state){document.body.classList.remove('drawer');stopAudio();render();window.scrollTo(0,0)}
});
async function stillAllowed(){
 try{
  const response=await fetch('/api/session');
  if(response.status===401){location.reload();return false}
  if(!response.ok)return false;
  const access=await response.json();
  if(isWorkplace?!access.tracks?.includes(track):access.maxLevel<course){location.assign('/');return false}
  if(access.maxLevel!==viewer.maxLevel||JSON.stringify(access.tracks??[])!==JSON.stringify(viewer.tracks??[])){location.reload();return false}
  return true;
 }catch{return false}
}
syncProgress=await openProgress(courseId,()=>storage('progress',null),value=>persist('progress',value),()=>location.reload(),()=>notify('Chưa đồng bộ được tiến độ. Bản lưu trên thiết bị vẫn còn.'));
state=syncProgress.state;
ensureStudy(state);
setInterval(tickMinute,60_000);
window.addEventListener('focus',stillAllowed);
setInterval(stillAllowed,30_000);
setTimeout(stillAllowed,Math.min(2_147_000_000,Math.max(0,viewer.expiresAt-Date.now()+100)));
try{
 const result=await fetch('/learning/'+courseId+'.json');
 if(result.status===401||result.status===403){location.assign('/');throw new Error('Phiên học đã hết hạn.')}
 if(!result.ok)throw new Error('Nguồn dữ liệu không khả dụng.');
 catalog=await result.json();
 wordlist=catalog.wordlist;
 audioFiles=catalog.audioFiles;
 exams=createExamCenter({course,catalog:catalog.examCatalog,storage,persist,heading,esc,button,history:()=>state.history,save,render,go,requireAccess:stillAllowed,activePractice:()=>quiz&&!quiz.done?quiz.practicePaper?.id:null,
  onExamPage:(id,page)=>syncProgress.recordView('examPages',id+':'+page)});
 document.title=courseName+' — Trung tâm ôn tập | FangSchool';refreshData();render();shared();
}catch(err){chrome('home');$('app').innerHTML=heading('Chưa mở được học liệu',err.message)}

document.getElementById('app').addEventListener('input',event=>{
 const number=Number(event.target.dataset.examAnswer);
 if(number)exams.input(number,event.target.value);
});

document.addEventListener('play',event=>{
 const audio=event.target;
 if(audio.matches?.('[data-exam-audio]'))document.querySelectorAll('[data-exam-audio]').forEach(other=>{if(other!==audio)other.pause()});
},true);
