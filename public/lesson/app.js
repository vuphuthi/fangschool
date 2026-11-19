import {createTutorChat} from './tutor-chat.js?v=4';
import {autoExercises} from './auto-exercises.js?v=1';
import {sameOriginFetch as fetch} from '../request.js';
import {createExamCenter} from './exams.js?v=12';
import {openProgress} from './study-progress.js?v=6';
import {goalChoices,ensureStudy,addMinute,streak,dayKey,lastWeek,todayMinutes,heatmap,nextStep,rateCard,dueQueue,predictScore,wordStatus,reviewQuestion,questionCard,questionActive,questionDue,QUESTION_CLEAR,cardDirection,CARD_DIRECTIONS,scoreCheck,examPass} from './study-habits.js?v=4';
import {hanViet,hanVietChar,soundsVietnamese,syllables} from './hanviet.js?v=1';
import {play as sfx,buzz,confetti,countUp,soundOn,toggleSound} from './feedback.js?v=1';
import {analyzeBlob,analyzeUrl,similarity,toneChart,toneTargets,record as recordVoice} from './tone-coach.js?v=2';
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
const icons={book:'<path d="M12 7v14M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>',home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-6h6v6"/>',shuffle:'<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>',bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',chart:'<path d="M3 3v18h18M8 16v-5m5 5V6m5 10V9"/>',teacher:'<path d="m2 9 10-5 10 5-10 5zM6 11v5c4 4 8 4 12 0v-5m4-2v8"/>',moon:'<path d="M20 15a8.5 8.5 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',chev:'<path d="m9 6 6 6-6 6"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',check:'<path d="m5 12 5 5 9-10"/>',text:'<path d="M3 6V4h18v2M12 4v16m-4 0h8"/>',head:'<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 13h4v7H5a2 2 0 0 1-2-2zm18 0h-4v7h2a2 2 0 0 0 2-2z"/>',audio:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>',read:'<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'};
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
const names={today:['Buổi học hôm nay','Today’s session','今日学习'],story:['Đọc truyện','Story reading','阅读故事'],listening:['Luyện nghe','Listening','听力练习'],exams:['Đề ôn thi','Mock exams','模拟试卷'],bank:['Luyện theo cấp HSK','Practice by HSK level','按HSK等级练习'],home:['Tổng quan','Overview','首页'],lessons:['Bài học','Lessons','课程'],practice:['Ôn tập tổng hợp','Mixed review','综合复习'],review:['Cần ôn lại','Review list','待复习'],progress:['Tiến độ','Progress','学习进度'],teacher:['Câu hỏi & lượt ôn','Questions & review sets','题目与复习'],lesson:['Ôn theo bài','Lesson review','单课复习'],quiz:['Làm câu hỏi','Practice','答题']};
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
// Câu giáo viên đã xuất bản trên máy chủ (thay thế câu gốc cùng mã, hoặc thêm vào bài).
let liveTeacherQuestions=[];
async function loadLiveTeacherQuestions(){
 try{
  const response=await fetch('/api/questions/'+courseId);
  if(response.ok)liveTeacherQuestions=(await response.json()).questions??[];
 }catch{}
}
function refreshData(){
 lessons=catalog.lessons.map(lesson=>({...lesson}));
 for(const l of lessons){
  const server=liveTeacherQuestions.filter(q=>q.lesson===l.n).map(q=>({...q,lesson:l.n,origin:'teacher'}));
  const o=edits[l.n],custom=(o?.questions??[]).map(q=>({...q,lesson:l.n,origin:'teacher'}));
  const added=[...custom,...server];
  if(added.length)l.questions=[...l.questions.filter(q=>!added.some(c=>c.id===q.id)),...new Map(added.map(q=>[q.id,q])).values()];
  if(o?.vocab)l.vocab=o.vocab;
 }
 // Bài tập tự sinh từ hội thoại của bài (điền từ, sắp xếp câu), xem auto-exercises.js.
 const courseVocab=lessons.flatMap(l=>l.vocab.map(w=>w.zh)).filter(Boolean);
 const dictionaryWords=new Set([...courseVocab,...(Array.isArray(catalog.wordlist)?catalog.wordlist.map(w=>w?.zh):[])].filter(Boolean));
 for(const l of lessons)if(l.n<100||isWorkplace)l.questions=[...l.questions,...autoExercises(l,{dictionary:dictionaryWords,courseVocab})];
 levelQuestions=catalog.levelQuestions;
 questions=[...lessons.flatMap(l=>l.questions),...levelQuestions];
 lookupDict=null;vocabIndex=null;hvCache=null;charIndex=null;
}
const navs=[['home','home'],['lessons','book'],['story','read'],['bank','target'],['listening','head'],['exams','text'],['practice','shuffle'],['review','bookmark'],['progress','chart']];
function chrome(page){
 document.documentElement.dataset.theme=settings.theme;
 document.documentElement.lang=settings.lang==='zh'?'zh-CN':settings.lang;
 const title=k=>k==='quiz'&&quiz?.session?(quiz.done?'Kết quả buổi học':'Học 10 phút'):k==='chat'?tr('Hỏi AI','Ask AI','AI 助教'):isWorkplace&&k==='bank'?'Ngân hàng luyện tập':tr(...(names[k]??names.home));
 const resume=Boolean(quiz&&!quiz.done&&quiz.session);
 $('sidebar').innerHTML='<div class="brand"><span class="brand-mark">'+svg('book')+'</span><span>Fang<em>School</em></span></div>'+
 '<button type="button" class="side-cta" data-action="'+(resume?'go:quiz':'sess-start')+'">'+svg('bolt')+'<span><b>'+(resume?'Tiếp tục buổi học':'Học 10 phút')+'</b><small>'+(resume?'Câu '+(quiz.index+1)+'/'+quiz.ids.length:'Đã xếp sẵn cho hôm nay')+'</small></span></button>'+
 '<div class="nav-label">'+tr('HỌC TẬP','STUDY','学习')+'</div>'+
 navs.filter(([k])=>(k!=='exams'&&k!=='listening'||k==='exams'&&catalog?.examCatalog||k==='listening'&&isWorkplace)&&(k!=='story'||viewer.aiAvailable)).map(([k,i])=>'<button class="nav '+((page===k||(page==='lesson'&&k==='lessons'))?'active':'')+'" data-action="go:'+k+'">'+svg(i)+esc(title(k))+'</button>').join('')+
 (tutor?'<button class="nav '+(page==='chat'?'active':'')+'" data-action="go:chat">'+svg('text')+esc(title('chat'))+'</button>':'')+
 (viewer.admin?'<div class="nav-label">QUẢN LÝ</div><a class="nav" href="/admin">'+svg('teacher')+'Quyền truy cập</a><a class="nav" href="/admin/progress">'+svg('chart')+'Tiến độ học viên</a><a class="nav" href="/admin/sources">'+svg('text')+'Nguồn học liệu</a><button class="nav '+(page==='teacher'?'active':'')+'" data-action="go:teacher">'+svg('book')+esc(title('teacher'))+'</button>':'')+
 '<div class="side-foot side-user"><div class="row"><span class="avatar" aria-hidden="true">'+esc((viewer.email[0]||'?').toUpperCase())+'</span><div class="grow"><b>'+esc(viewer.email)+'</b><small>'+(viewer.admin?'Quản trị viên':'Học viên')+'</small></div></div>'+button('Đăng xuất','logout')+'</div>';

 $('top').innerHTML='<div class="crumb"><button class="iconbtn mobile" data-action="drawer" aria-label="Menu">'+svg('menu')+'</button><span class="crumb-brand">FangSchool</span><span class="crumb-sep" aria-hidden="true">/</span><b>'+esc(title(page))+'</b></div>'+courseTabs()+'<div class="top-actions"><label class="row" aria-label="Ngôn ngữ">'+svg('globe')+'<select id="language" aria-label="Ngôn ngữ"><option value="vi">VI</option><option value="en">EN</option><option value="zh">中文</option></select></label><button class="iconbtn" data-action="theme" aria-label="Giao diện sáng/tối">'+svg(settings.theme==='dark'?'sun':'moon')+'</button></div>';
 $('language').value=settings.lang;
 const tabs=document.querySelector('#top .course-tabs'),active=tabs?.querySelector('.active');
 if(tabs&&active&&tabs.scrollWidth>tabs.clientWidth)tabs.scrollLeft=active.offsetLeft-(tabs.clientWidth-active.offsetWidth)/2;
 bottomNav(page);
}
// Thanh điều hướng dưới đáy trên điện thoại: 4 mục chính và nút Học ở giữa (bắt đầu hoặc tiếp tục buổi học).
function bottomNav(page){
 const el=$('bottom-nav');
 if(!el)return;
 const resume=Boolean(quiz&&!quiz.done&&quiz.session),due=state?wrongQuestions().length+dueWords().length:0;
 const item=(k,icon,label,badge=0)=>'<button type="button" class="bn-item'+((page===k||page==='lesson'&&k==='lessons')?' active':'')+'" data-action="go:'+k+'" aria-label="'+esc(label)+'"'+((page===k||page==='lesson'&&k==='lessons')?' aria-current="page"':'')+'>'+svg(icon)+'<span>'+esc(label)+'</span>'+(badge?'<i class="bn-badge">'+(badge>99?'99+':badge)+'</i>':'')+'</button>';
 el.innerHTML=item('home','home',tr('Tổng quan','Home','首页'))+item('lessons','book',tr('Bài học','Lessons','课程'))+
  '<button type="button" class="bn-learn" data-action="'+(resume?'go:quiz':'sess-start')+'" aria-label="'+(resume?'Tiếp tục buổi học':'Học 10 phút')+'">'+svg('bolt')+'<span>'+(resume?'Tiếp tục':'Học')+'</span></button>'+
  item('review','bookmark',tr('Ôn lại','Review','复习'),due)+item('progress','chart',tr('Tiến độ','Progress','进度'));
}
const graded=()=>state.attempts.filter(a=>a.grade===true||a.grade===false);
// Bài hoàn thành = đạt đủ các mục (xem lessonMastery); từ đã thuộc = từ nhớ rõ theo lịch ôn thẻ.
const masteredLessons=()=>{const tried=attemptedSet();return lessons.filter(l=>(l.n<100||isWorkplace)&&lessonMastered(l,tried)).length};
const knownWords=()=>new Set(lessons.flatMap(l=>l.vocab.map(w=>w.id)).filter(id=>id&&wstatus(id)==='known')).size;
const stats=()=>{
 const gs=graded(),correct=gs.filter(a=>a.grade).length;
 return [[masteredLessons()+'/'+lessonCount(),tr('Bài hoàn thành','Lessons completed','已完成课程'),'book'],[state.attempts.length,tr('Câu đã luyện','Answers submitted','已练习题目'),'bolt'],[gs.length?Math.round(100*correct/gs.length)+'%':'—',tr('Tỷ lệ đúng','Accuracy','正确率'),'target'],[knownWords(),tr('Từ đã thuộc','Words learned','已掌握词汇'),'check']];
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
 const cloze=l.questions.filter(q=>q.origin==='auto'&&q.mode==='cloze'),order=l.questions.filter(q=>q.origin==='auto'&&q.mode==='order');
 const fromDialogue=cloze.length||order.length?'<section class="panel form-actions row split"><div><h3>Luyện từ hội thoại của bài</h3><p>Điền từ vào câu thoại và xếp lại câu, để dùng từ và mẫu câu trong ngữ cảnh thật của bài.</p></div><div class="wrap">'+
  (cloze.length?button('Điền từ vào câu · '+cloze.length,'auto-ex:'+l.n+':cloze','arrow','primary'):'')+(order.length?button('Sắp xếp câu · '+order.length,'auto-ex:'+l.n+':order','shuffle'):'')+'</div></section>':'';
 return stageInfo('Bước 4','Vận dụng trong tình huống mới','Đọc để hiểu ý, chọn mẫu phù hợp rồi tự đặt câu. Các tình huống được soạn theo chủ điểm của bài.')+fromDialogue+
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
 const best=state.history.filter(h=>h.final===l.n&&h.graded).reduce((m,h)=>Math.max(m,pct(h.correct,h.graded)),0);
 return stageInfo('Bước 5','Kiểm tra cuối bài','Làm đề theo kỹ năng. Cần đạt từ '+Math.round(MASTERY.final*100)+'% để hoàn thành bài. Sau khi nộp, bạn nhận điểm, lời giải và có thể làm lại riêng các câu sai.')+
 '<section class="panel"><div class="row split"><div><h3>'+plan.length+' câu · '+lessonLabel(l.n)+'</h3><p>'+(last?'Lượt gần nhất: '+last.correct+'/'+last.graded+' câu đúng'+(last.graded?' ('+pct(last.correct,last.graded)+'%)':'')+' · Tốt nhất: '+best+'%.':'Chưa có lượt kiểm tra hoàn thành.')+'</p></div>'+button(running?'Tiếp tục kiểm tra':last?'Làm đề mới':'Bắt đầu kiểm tra',running?'go:quiz':'final:'+l.n,'arrow','primary',plan.length?'':'disabled')+'</div>'+
 '<div class="stage-grid form-actions">'+counts.map(x=>'<div class="example-block"><strong>'+x.count+' câu</strong><small>'+esc(x.label)+'</small></div>').join('')+'</div>'+
 (plan.some(q=>q.kind===2)?'':'<p class="form-actions">Đề này dùng câu đọc hiểu khi bài chưa có bản thu phù hợp cho phần nghe.</p>')+
 (last?.skills?'<div class="wrap form-actions">'+Object.entries(last.skills).filter(([,v])=>v.correct<v.total||v.skipped).map(([k])=>button('Ôn lại '+lessonSkills[k].toLowerCase(),'lesson-weak:'+l.n+':'+k,'target')).join('')+'</div>':'')+'</section>';
}
function audioToggles(){return [['hideZh','Ẩn chữ Hán'],['hidePy','Ẩn pinyin'],['showVi','Xem bản dịch']].map(([k,l])=>'<label class="check"><input type="checkbox" data-setting="'+k+'" '+(settings[k]?'checked':'')+'>'+l+'</label>').join('')}
let preset=null;
// Câu sai đang trong lịch ôn. Câu sai từ trước khi có lịch ôn (chưa có thẻ) vẫn được tính và coi như đến hạn.
const wrongQuestions=()=>{
 const last=new Map(state.attempts.filter(a=>a.grade===true||a.grade===false).map(a=>[a.id,a.grade]));
 return questions.filter(q=>{const card=questionCard(state,q.id);return card?questionActive(card):last.get(q.id)===false});
};
const dueWrongQuestions=()=>wrongQuestions().filter(q=>{const card=questionCard(state,q.id);return !card||questionDue(card)});
const wstatus=id=>wordStatus(state,id);
const dueWords=()=>lessons.flatMap(l=>l.vocab.map((w,i)=>({...w,n:l.n,i}))).filter(w=>wstatus(w.id)==='learning');
// Ghi một kết quả chấm (tự động, tự chấm hay AI chấm) vào lịch ôn câu sai.
const recordReview=(id,grade,at=Date.now())=>{if(grade===true||grade===false)reviewQuestion(state,id,grade,at)};
// Đánh dấu thuộc / chưa thuộc = chấm thẻ ôn, để chỉ còn một nguồn trạng thái từ. Dấu cũ được giữ đồng bộ cho máy chủ.
const markWord=(id,known)=>{
 const card=ensureStudy(state).srs[id];
 // Bấm lại "Đã thuộc" cho từ đã nhớ rõ không đẩy khoảng ôn lên thêm; chỉ ôn thẻ đúng hạn mới giãn khoảng.
 const step=known&&card&&wstatus(id)==='known'?card.step:rateCard(state,id,known?'easy':'hard');
 state.words[id]=known?'known':'unknown';
 return step;
};
const searchText=text=>text.toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/\p{M}|\s/gu,'');

const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const ranked=items=>{
 const last=new Map(state.attempts.map(a=>[a.id,a]));
 const weak=new Map();
 for(const a of state.attempts.slice(-120)){const q=getQuestion(a.id);if(q&&a.grade===false)weak.set(q.kind,(weak.get(q.kind)??0)+1)}
 const weight=q=>{const a=last.get(q.id);return (a?.grade===false?50:0)+(wstatus(q.word)==='learning'?35:0)+(weak.get(q.kind)??0)+(!a?8:Math.min(8,(Date.now()-a.at)/86400000))};
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
function start(items,title,count=items.length,mode='random',final=null,returnTo=null,practicePaper=null,extra={}){
 const page=location.hash.slice(1);
 returnTo??=page.startsWith('lesson/')?page:null;
 const pool=[...new Map(items.filter(Boolean).filter(q=>!q.resource&&(!q.audio||lessonSkill(q)!=='listen'||canPlay(q.audio,q.pinyin))).map(q=>[q.id,q])).values()];
 if(!pool.length){notify('Chưa có câu tương tác cho bộ lọc này.');return}
 if(quiz&&!quiz.done&&quiz.answers.length&&!confirm('Bắt đầu lượt mới và kết thúc lượt đang làm?'))return;
 const order=(mode==='smart'?ranked(pool):mode==='balanced'?balanceBySkill(pool):mode==='exam'?pool:shuffle(pool)).slice(0,count);
 quiz={title,ids:order.map(q=>q.id),options:Object.fromEntries(order.filter(q=>q.options).map(q=>[q.id,shuffle(q.options)])),chunks:Object.fromEntries(order.filter(q=>q.order).map(q=>[q.id,shuffle(q.order)])),index:0,answers:[],selection:'',final,assessment:mode==='exam'||Boolean(extra.assessment),returnTo,practicePaper,done:false,...(extra.check?{check:extra.check}:{})};
 saveQuiz();go('quiz');window.scrollTo(0,0);
 if(order.length<count)notify('Có '+order.length+' câu phù hợp với lựa chọn này.');
}
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
function grade(q,value){
 if(!q.answers?.length)return null;
 if(q.answers.some(a=>normalize(a)===normalize(value)))return true;
 return q.kind===4||q.origin==='teacher'&&!q.options?.length||(['bank','curriculum','auto'].includes(q.origin)&&q.order||q.mode==='correct')?null:false;
}
function submitAnswer(value){
 const q=getQuestion(quiz?.ids[quiz.index]);
 if(!q||!value.trim()||quiz.answers[quiz.index])return;
 const a={id:q.id,value,grade:grade(q,value),at:Date.now()};
 quiz.answers[quiz.index]=a;
 if(!quiz.assessment){state.attempts.push(a);recordReview(a.id,a.grade,a.at);save()}
 saveQuiz();render();answerFeedback(q,a);
}
// Chấm lại một câu sau khi đã trả lời (tự chấm hoặc AI chấm): cập nhật lượt trả lời, điểm lượt ôn và lịch ôn câu sai.
function applyGrade(index,grade,extra={}){
 const answer=quiz?.answers[index];
 if(!answer||answer.skipped)return null;
 const now=Date.now();
 Object.assign(answer,extra,{grade,gradedAt:now});
 const stored=state.attempts.find(item=>item.id===answer.id&&item.at===answer.at);
 if(stored&&stored!==answer)Object.assign(stored,extra,{grade,gradedAt:now});
 const last=state.history.at(-1);
 if(quiz.done&&last&&last.title===quiz.title&&last.at>=answer.at){
  const graded=quiz.answers.filter(item=>item&&item.grade!==null&&!item.skipped);
  last.graded=graded.length;last.correct=graded.filter(item=>item.grade).length;last.gradedAt=now;
  if(quiz.final)last.skills=scoreSkills(quiz.answers);
 }
 recordReview(answer.id,grade,now);
 save();saveQuiz();
 return answer;
}

// ===== AI chấm câu tự luận, dịch, đặt câu (thay cho "tự đối chiếu") =====
const aiBusy=new Set();
const canAiGrade=a=>Boolean(viewer.aiAvailable&&a&&!a.skipped&&a.value?.trim());
const verdicts={correct:['Đúng','ok'],close:['Gần đúng','warn'],wrong:['Chưa đúng','bad']};
async function aiGrade(indexes){
 const session=quiz,list=indexes.filter(i=>canAiGrade(session?.answers[i])&&!aiBusy.has(i));
 if(!list.length)return;
 list.forEach(i=>aiBusy.add(i));render();
 let failed='',graded=0;
 for(const i of list){
  if(quiz!==session)break;
  const a=session.answers[i],q=getQuestion(a.id);
  try{
   if(!q)continue;
   const response=await fetch('/api/ai/grade',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({
    course:courseId,prompt:q.prompt,answer:a.value,reference:q.reference??q.answers?.[0]??null,
    explanation:q.explanation??null,translation:q.vi??null})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body.error??body.message??'AI chưa chấm được câu này.');
   applyGrade(i,body.verdict==='correct',{selfGraded:false,ai:{verdict:body.verdict,feedback:body.feedback??'',corrected:body.corrected??'',errors:body.errors??[],at:Date.now()}});
   graded++;
  }catch(error){failed=error instanceof TypeError?'Không kết nối được với AI. Vui lòng thử lại.':error.message;break}
  finally{aiBusy.delete(i);if(quiz===session)render()}
 }
 list.forEach(i=>aiBusy.delete(i));
 if(quiz===session)render();
 notify(failed||(graded>1?'AI đã chấm '+graded+' câu.':'AI đã chấm xong.'));
}
function aiFeedback(a){
 if(!a?.ai)return '';
 const [label,k]=verdicts[a.ai.verdict]??verdicts.wrong;
 const errors=(a.ai.errors??[]).slice(0,5).map(e=>'<li>'+(e.wrong?'<span class="han">'+esc(e.wrong)+'</span> → ':'')+'<strong class="han">'+esc(e.right??'')+'</strong>'+(e.note?' · '+esc(e.note):'')+'</li>').join('');
 return note('<strong>AI chấm · '+label+'</strong>'+(a.ai.feedback?'<span>'+esc(a.ai.feedback)+'</span>':'')+
  (a.ai.corrected&&a.ai.verdict!=='correct'?'<span>Câu nên viết: <strong class="han" lang="zh-CN">'+esc(a.ai.corrected)+'</strong></span>':'')+
  (errors?'<ul class="ai-errors">'+errors+'</ul>':'')+
  (a.selfGraded?'<small>Bạn đã tự chấm lại: '+(a.grade?'Đúng':'Sai')+'.</small>':'<small>AI có thể nhầm. Không đồng ý thì tự chấm lại bên dưới.</small>'),a.selfGraded?(a.grade?'ok':'bad'):k);
}
// Câu trả lời sai → hỏi trợ giảng AI vì sao sai, ngay trên trang (cần AI đang bật).
const askWhy=(i,a)=>tutor&&a&&a.grade===false&&!a.skipped?'<div class="grade-tools">'+button('Vì sao sai? Hỏi AI','ask-why:'+i,'text')+'</div>':'';
// Nút chấm cho câu chưa chấm tự động được: nhờ AI chấm, hoặc tự chấm. Câu đã chấm AI vẫn cho tự chấm lại.
function gradeTools(i,a){
 if(!a||a.skipped)return '';
 const pending=a.grade===null,busy=aiBusy.has(i);
 if(!pending&&!a.ai)return '';
 const ai=pending&&canAiGrade(a)?(busy?'<button type="button" class="btn primary" disabled aria-busy="true">AI đang chấm…</button>':button('Nhờ AI chấm','ai-grade:'+i,'bolt','primary')):'';
 return aiFeedback(a)+'<div class="grade-tools">'+ai+'<span class="muted">'+(pending?(ai?'hoặc tự chấm:':'Tự chấm:'):'Tự chấm lại:')+'</span>'+button('Tôi sai','self:'+i+':0','',a.selfGraded&&a.grade===false?'active':'')+button('Tôi đúng','self:'+i+':1','check',a.selfGraded&&a.grade===true?'active':'')+'</div>';
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
 if(quiz.assessment){
  const submitted=quiz.answers.filter(a=>a&&!a.skipped);
  state.attempts.push(...submitted);
  for(const a of submitted)recordReview(a.id,a.grade,a.at);
 }
 if(quiz.check){
  const result=scoreCheck(course,quiz.answers,{getQuestion,lessonSkill});
  if(result){const plan=ensureStudy(state).plan,prev=plan.checks.at(-1);plan.checks=[...plan.checks,{at:Date.now(),total:result.total,max:result.max,kind:quiz.check}].slice(-60);quiz.checkResult={...result,prev:prev?.total??null}}
 }
 if(quiz.session){
  const r=quiz.session.receipt=buildReceipt();
  persist('receipt',{at:r.at,minutes:r.minutes,learned:r.learned.length,graded:r.graded,correct:r.correct,fixed:r.fixed,predicted:r.before.predicted!==null&&r.after.predicted!==null&&(r.before.evidence??0)>=40?r.after.predicted-r.before.predicted:0});
 }
 const graded=quiz.answers.filter(a=>a&&!a.special&&a.grade!==null),correct=graded.filter(a=>a.grade).length;
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
// Tập câu đã làm, kèm kết quả chấm gần nhất của từng câu (tried.grades) để tính mức nắm bài.
const attemptedSet=()=>{
 const tried=new Set(),grades=new Map();
 for(const a of state.attempts){tried.add(a.id);if(a.grade===true||a.grade===false)grades.set(a.id,a.grade)}
 tried.grades=grades;
 return tried;
};
const fmtDate=t=>new Date(t).toLocaleDateString('vi-VN');
const fmtDateTime=t=>new Date(t).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});

// Sáu mục của bài: Từ vựng · Ngữ pháp · Hội thoại & nghe · Bài luyện · Luyện mở rộng · Kiểm tra cuối bài.
// Một mục chỉ "đạt" khi đã nắm, không phải chỉ đã mở:
// - Từ vựng: ≥80% số từ nhớ rõ (thẻ ôn có khoảng ≥7 ngày).
// - Các mục luyện: đúng ≥70% của tối đa 10 câu (tính kết quả gần nhất mỗi câu) và tỷ lệ đúng trên các câu đã làm ≥70%.
// - Kiểm tra cuối bài: lượt tốt nhất đạt ≥80%.
const MASTERY={vocab:.8,practice:.7,practiceSample:10,final:.8};
const masteryTitles={vocab:'Từ vựng',grammar:'Ngữ pháp',listen:'Hội thoại & nghe',ex:'Bài luyện',extra:'Luyện mở rộng',final:'Kiểm tra cuối bài'};
const masteryPools={
 grammar:q=>lessonSkill(q)==='grammar'&&q.origin!=='auto',
 listen:q=>q.kind===2||/-(listen|listen2|read)$/.test(q.id??''),
 ex:q=>q.origin==='original'||q.origin==='teacher',
 extra:q=>q.origin==='extra'||q.origin==='auto'||/-(apply|produce)$/.test(q.id??'')
};
const gradable=q=>!q.resource&&q.answers?.length&&(!q.audio||lessonSkill(q)!=='listen'||canPlay(q.audio,q.pinyin));
function practiceMastery(l,key,tried){
 const all=l.questions.filter(masteryPools[key]),pool=all.filter(gradable);
 if(!pool.length){
  // Mục chỉ có câu mở (không có đáp án mẫu): làm thử là đạt.
  const done=all.some(q=>tried.has(q.id));
  return {done,detail:done?'Đã luyện':'Chưa luyện',need:done?'':'Làm thử các câu trong mục này.'};
 }
 let attempted=0,correct=0;
 for(const q of pool){const grade=tried.grades.get(q.id);if(grade===undefined)continue;attempted++;if(grade)correct++}
 const target=Math.ceil(Math.min(pool.length,MASTERY.practiceSample)*MASTERY.practice),rate=attempted?correct/attempted:0;
 const done=correct>=target&&rate>=MASTERY.practice;
 const need=done?'':correct<target?'Cần đúng thêm '+(target-correct)+' câu.':'Tỷ lệ đúng '+Math.round(rate*100)+'%, cần từ '+Math.round(MASTERY.practice*100)+'%. Làm lại các câu sai.';
 return {done,detail:'Đúng '+correct+'/'+target+' câu cần đạt'+(attempted?' · tỷ lệ đúng '+Math.round(rate*100)+'%':''),need,correct,target,attempted};
}
function lessonMastery(l,tried=attemptedSet()){
 const known=l.vocab.filter(w=>wstatus(w.id)==='known').length,vocabTarget=Math.ceil(l.vocab.length*MASTERY.vocab);
 const finals=state.history.filter(h=>h.final===l.n&&h.graded),best=finals.reduce((m,h)=>Math.max(m,h.correct/h.graded),0);
 const pending=state.history.some(h=>h.final===l.n&&!h.graded);
 const all=[
  ['vocab',l.vocab.length?{done:known>=vocabTarget,detail:'Nhớ rõ '+known+'/'+l.vocab.length+' từ',need:known>=vocabTarget?'':'Cần nhớ rõ thêm '+(vocabTarget-known)+' từ (chọn “Đã thuộc” hoặc “Nhớ rõ” khi ôn thẻ).'}:{done:false,detail:'Chưa có từ vựng',need:''}],
  ...['grammar','listen','ex','extra'].map(key=>[key,practiceMastery(l,key,tried)]),
  ['final',{done:best>=MASTERY.final,detail:finals.length?'Lượt tốt nhất '+Math.round(best*100)+'%':pending?'Đã nộp, còn câu chờ chấm':'Chưa làm',
   need:best>=MASTERY.final?'':finals.length?'Cần đạt từ '+Math.round(MASTERY.final*100)+'%. Ôn phần còn yếu rồi làm đề mới.':pending?'Chấm các câu tự luận (AI hoặc tự chấm) để có điểm.':'Làm kiểm tra cuối bài, cần đạt từ '+Math.round(MASTERY.final*100)+'%.'}]];
 return (l.n>=100?all.filter(([k])=>['grammar','ex','extra'].includes(k)):all).map(([key,value])=>({key,title:masteryTitles[key],...value}));
}
const lessonSteps=(l,tried=attemptedSet())=>lessonMastery(l,tried).map(step=>step.done);
const lessonMastered=(l,tried)=>{const steps=lessonSteps(l,tried);return steps.length>0&&steps.every(Boolean)};
// Dòng tiến độ của mục đang mở trong trang bài: đạt chưa, còn thiếu gì, kèm nút ôn đúng chỗ.
function masteryNote(l,tab){
 const step=lessonMastery(l).find(item=>item.key===tab);
 if(!step)return '';
 const skill={grammar:'grammar',listen:'listen'}[tab];
 const action=step.done?'':tab==='ex'?button('Làm bài luyện','original:'+l.n,'arrow'):tab==='extra'?button('Luyện thêm','extra:'+l.n,'arrow'):skill?button(step.attempted?'Ôn phần còn sai':'Bắt đầu luyện','lesson-weak:'+l.n+':'+skill,'target'):'';
 return '<div class="mastery-note" data-k="'+(step.done?'ok':'warn')+'">'+svg(step.done?'check':'target')+'<div class="grow"><strong>'+(step.done?'Đã đạt mục này':'Chưa đạt mục này')+'</strong><span>'+esc(step.detail)+(step.need?' · '+esc(step.need):'')+'</span></div>'+action+'</div>';
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
 const footer='<p class="form-actions"><small>Mỗi bài có 6 mục: Từ vựng · Ngữ pháp · Hội thoại &amp; nghe · Bài luyện · Luyện mở rộng · Kiểm tra cuối bài. Vạch xanh là mục bạn đã <strong>nắm</strong>: nhớ rõ ≥80% từ, đúng ≥70% câu luyện, kiểm tra cuối bài đạt ≥80%.</small></p>';
 if(!isWorkplace)return pageHead(title,'Chọn bài để học theo chủ điểm và luyện các kỹ năng.','',chip(group))+summary+(editionNote()?'<div class="form-actions">'+editionNote()+'</div>':'')+'<div class="section"><h2>Bài học</h2>'+grid(main)+'</div>'+(lessons.some(l=>l.n>=100)?'<div class="section"><h2>Ngữ âm</h2>'+grid(lessons.filter(l=>l.n>=100))+'</div>':'')+footer;
 return pageHead(title,'Học theo tình huống công việc và tra từ ngay trong từng bài.',button('Luyện nghe','go:listening','head'),chip(group))+summary+
  '<div class="section"><h2>Chủ đề mở rộng</h2>'+grid(lessons.filter(l=>l.extension))+'</div><div class="section"><h2>Bài từ tài liệu gốc</h2>'+grid(lessons.filter(l=>!l.extension))+'</div>'+footer;
}

// ----- Trang bài học -----
const stageInfo=(label,title,description)=>'<div class="tab-head"><div><span class="chip">'+esc(label)+'</span><h2 style="margin-top:8px">'+esc(title)+'</h2><p>'+esc(description)+'</p></div></div>';
function lessonPage(n,tab='vocab'){
 const l=getLesson(n);
 if(l.n>=100&&tab==='vocab')tab='extra';
 const tabs=[['vocab','Từ vựng'],['write','Viết chữ'],['grammar','Ngữ pháp'],['listen','Hội thoại & nghe'],['speak','Luyện nói'],['ex','Bài luyện'],['extra','Luyện mở rộng'],['final','Kiểm tra cuối bài']].filter(([key])=>l.n<100||!['vocab','write','listen','speak','final'].includes(key));
 const body=tab==='vocab'?vocabStage(l):tab==='write'?writingStage(l):tab==='speak'?speakingStage(l):tab==='grammar'?grammarStage(l):tab==='listen'?listenStage(l):tab==='ex'?exerciseStage(l):tab==='extra'?transferStage(l):tab==='final'?finalStage(l):note('Chưa có nội dung cho mục này.');
 const mastered=new Set(lessonMastery(l).filter(step=>step.done).map(step=>step.key));
 return button('‹ Tất cả bài học','go:lessons','','back')+pageHead(l.zh,l.vi+(l.topic?' · '+l.topic:''),'',chip(esc(lessonLabel(l.n)))+chip(esc(courseName))).replace('<h1>','<h1 class="han" lang="zh-CN">')+
  '<nav class="ltabs" aria-label="Mục trong bài">'+tabs.map(([k,t])=>button(t,'go:lesson/'+l.n+'/'+k,mastered.has(k)?'check':'',(tab===k?'active':'')+(mastered.has(k)?' mastered':''),(tab===k?'aria-current="page" ':'')+(mastered.has(k)?'title="Đã đạt mục này"':''))).join('')+'</nav>'+masteryNote(l,tab)+body;
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
 const known=l.vocab.filter(x=>wstatus(x.id)==='known').length,unknown=l.vocab.filter(x=>wstatus(x.id)==='learning').length,status=wstatus(w.id);
 const i=l.vocab.indexOf(w);
 const modes=[['card','Flashcard'],['meaning','Chọn nghĩa'],['recog','Nhận diện chữ'],['listen','Nghe chọn từ']];
 const head='<div class="tab-head"><h2>Từ vựng</h2>'+seg(modes.map(([k,t])=>['vmode:'+k,t,vocabMode===k]),'Kiểu luyện')+'</div>'+
  '<section class="panel reader-bar">'+readerControls()+'<div class="wrap" aria-live="polite">'+audioButton(voiceKey(w.zh,w.pinyin),'Phát âm','primary')+'</div></section>'+
  '<div class="pos-line"><span>Từ '+(i+1)+' / '+l.vocab.length+'</span><span>Đã thuộc <strong class="ok">'+known+'</strong> · Chưa thuộc <strong class="bad">'+unknown+'</strong></span></div>'+barHtml(pct(i+1,l.vocab.length));
 let main;
 if(vocabMode==='card'){
  main='<div class="form-actions"><button type="button" class="flash-big" data-action="flip" aria-pressed="'+flip+'" aria-label="Lật thẻ"><span class="side">'+(flip?'Mặt sau':'Mặt trước')+'</span><span class="zh han" lang="zh-CN">'+esc(w.zh)+'</span>'+(flip?'<span class="py">'+esc(w.pinyin)+'</span>'+hvLine(w,true)+'<span class="vi">'+esc(w.vi)+'</span>'+(w.examples?.length?'<span class="ex han">'+esc(w.examples.join('\n'))+'</span>':''):'<span class="muted">Nhấn để xem pinyin, nghĩa và ví dụ</span>')+'</button>'+
   '<div class="mark-row">'+button('Chưa thuộc','word:unknown:'+w.id,'bookmark','danger','aria-pressed="'+(status==='learning')+'"')+button('Đã thuộc','word:known:'+w.id,'check','primary','aria-pressed="'+(status==='known')+'"')+'</div>'+
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
 const list='<details class="panel source form-actions"><summary>Danh sách '+l.vocab.length+' từ của bài</summary><div class="list-items">'+l.vocab.map((x,k)=>'<button class="list-item '+(x.id===w.id?'active':'')+'" data-action="pickflash:'+k+'"><b class="han">'+esc(x.zh)+'</b><small>'+esc(x.pinyin)+' · '+esc(x.vi)+'</small>'+(wstatus(x.id)==='known'?svg('check'):wstatus(x.id)==='learning'?svg('bookmark'):'')+'</button>').join('')+'</div></details>';
 return head+main+list+nextStage(l,'grammar','Tiếp theo · Ngữ pháp');
}
function grammarStage(l){
 const points=l.grammarPoints??[];
 const practice=l.questions.filter(q=>lessonSkill(q)==='grammar'&&[1,4].includes(q.kind)&&!q.resource&&q.answers?.length);
 const activity=mastery(practice);
 const exampleRow=(zh,py,vi)=>'<div class="ex-row">'+iconAudio(voiceKey(zh,py),'Nghe câu ví dụ')+'<div class="grow"><span class="zh han" lang="zh-CN">'+zhText(zh)+'</span><span class="py">'+esc(py)+'</span><span class="muted">'+esc(vi)+'</span></div></div>';
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
  (showZh?'<span class="zh han" lang="zh-CN">'+zhText(u.zh)+'</span>':'')+(showPy&&u.pinyin?'<span class="py">'+esc(u.pinyin)+'</span>':'')+(showVi?'<span class="vi">'+esc(u.vi||'Chưa có bản dịch cho câu này.')+'</span>':'')+(!showZh&&!showPy&&!showVi?'<span class="vi">(Đã ẩn chữ — nghe và đoán nội dung)</span>':'')+
  '</div>'+(!isWorkplace||canPlay(u.zh,u.pinyin)?iconAudio(voiceKey(u.zh,u.pinyin),'Nghe câu của '+(u.who||'người nói')):'')+'</div>'}).join('');
 return '<section class="panel lines-card form-actions" aria-label="Lời hội thoại"><div class="dlg-head"><h3>'+(d.recording?'Bài khóa · Phần ':'Hội thoại ')+(d.part??i+1)+'</h3><div class="wrap">'+dialogueAudio(l,d)+button('Báo lỗi','report-d:'+l.n+':'+i,'text','','title="Báo lỗi hội thoại này"')+'</div></div>'+(!d.utterances.length?note('Có bản thu gốc. Văn bản trong slide này nằm trong ảnh.'):rows)+'</section>';
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
 if(quiz.done&&quiz.session)return receiptPage();
 if(!quiz.done){const item=sessionItem(quiz.ids[quiz.index]);if(item)return sessionItemPage(item)}
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
   return '<article class="panel review-card"><div class="top"><span>Câu '+(i+1)+' · '+esc(kindOf(x))+'</span><span class="badge" data-k="'+k+'">'+st+'</span></div><p class="lines"><strong>'+esc(x.prompt)+'</strong></p><p>Bạn trả lời: <strong class="han">'+esc(a.value||'—')+'</strong></p><p>Đáp án: <strong class="han">'+esc(x.reference??x.answers?.[0]??'Đối chiếu cùng giáo viên.')+'</strong>'+(x.pinyin?' · '+esc(x.pinyin):'')+(x.vi?' · '+esc(x.vi):'')+'</p>'+(x.zh?'<p class="han lines">'+zhText(x.zh)+'</p>':'')+(x.explanation?'<small>'+esc(x.explanation)+'</small>':'')+
    ((x.audio||x.zh&&canPlay(x.zh,x.pinyin))?'<div>'+questionAudio(x,'Nghe lại')+'</div>':'')+
    (a.grade===null&&!a.skipped?note('<span>Câu này chưa chấm tự động được.'+(canAiGrade(a)?' Nhờ AI chấm, hoặc tự đối chiếu với đáp án mẫu.':' Tự đối chiếu với đáp án mẫu.')+'</span>','warn'):'')+gradeTools(i,a)+askWhy(i,a)+'</article>'}).join('');
  const aiPending=quiz.answers.filter(item=>item&&item.grade===null&&canAiGrade(item)).length;
  const aiAll=aiPending?'<section class="panel row split form-actions"><div><h3>'+aiPending+' câu đang chờ chấm</h3><p>AI chấm cả cách diễn đạt khác đáp án mẫu, chỉ ra lỗi và gợi ý câu đúng. Kết quả được tính vào điểm và tiến độ.</p></div>'+(aiBusy.size?'<button type="button" class="btn primary" disabled aria-busy="true">AI đang chấm…</button>':button('Nhờ AI chấm tất cả','ai-grade-all','bolt','primary'))+'</section>':'';
  return '<div class="quiz-wrap">'+pageHead('Kết quả lượt ôn',quiz.title)+checkPanel()+'<section class="panel score-card"><div class="score-ring" style="--p:'+p+'"><span>'+(graded.length?correct+'/'+graded.length:'—')+'</span></div><div class="grow"><h2>'+title+'</h2><p>Điểm tính trên '+graded.length+' câu chấm tự động'+(self?'; '+self+' câu tự đối chiếu không tính vào tỷ lệ đúng':'')+(skipped?'; '+skipped+' câu bỏ qua':'')+'. Câu sai được thêm vào mục “Cần ôn lại”.</p><div class="wrap">'+button('Làm lại','redo','shuffle','primary')+(wrong.length?button('Ôn các câu sai','redo-wrong','target'):'')+(quiz.returnTo?button(quiz.returnTo.startsWith('exams/')?'Về kho đề':quiz.returnTo==='listening'?'Về kho luyện nghe':quiz.returnTo==='today'?'Về buổi học hôm nay':'Về bài học','go:'+quiz.returnTo,'book'):button('Xem tiến độ','go:progress','chart'))+'</div></div></section>'+aiAll+breakdown+
   (quiz.answers.some(a=>{const x=a&&getQuestion(a.id);return x&&canPlay(x.audio??x.zh,x.pinyin)})?'<section class="panel reader-bar form-actions">'+readerControls()+'</section>':'')+
   '<div class="tab-head form-actions" style="margin-top:28px"><h2>Xem lại bài làm</h2>'+seg(filters.map(([k,t])=>['qfilter:'+k,t,quizFilter===k]),'Lọc câu')+'</div><div class="cards">'+(cards||'<p>'+(quizFilter==='wrong'?'Không có câu sai. Tuyệt vời!':'Không có câu nào trong mục này.')+'</p>')+'</div></div>';
 }
 const a=quiz.answers[quiz.index],opts=quiz.options[q.id],marked=state.marks[q.id];
 const chunks=quiz.chunks?.[q.id],selectedChunks=quiz.picked??[];
 const isGuidedOrder=chunks&&(q.origin==='curriculum'||q.origin==='auto')&&!a;
 const answeredCount=quiz.answers.filter(Boolean).length;
 const orderUI=chunks&&!a?'<div class="chips-select">'+chunks.map((chunk,i)=>'<button type="button" class="toggle han" data-action="chunk:'+i+'" '+(selectedChunks.includes(i)?'disabled aria-pressed="true"':'')+'>'+esc(chunk)+'</button>').join('')+button('Xóa cụm đã chọn','clear-chunks')+'</div>':'';
 const options=opts?'<div class="cards">'+opts.map((o,i)=>{
  const good=a&&!quiz.assessment&&q.answers.some(x=>normalize(x)===normalize(o)),selected=(a?.value??quiz.selection)===o;
  return '<button type="button" class="option '+(good?'good':selected?(a&&!quiz.assessment?'bad':'selected'):'')+'" data-action="answer:'+i+'" '+(a?'disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span><span>'+esc(o)+'</span></button>';
 }).join('')+'</div>':'<label class="lbl" for="response">Câu trả lời</label><textarea id="response" name="response" rows="3" placeholder="Nhập câu trả lời của bạn" '+(a||isGuidedOrder?'readonly':'')+' required>'+esc(a?.value??quiz.selection)+'</textarea>';
 const feedback=a&&quiz.assessment?note('Đã lưu câu trả lời. Đáp án và điểm sẽ hiện sau khi nộp toàn bộ.'):a?note('<strong>'+({true:'Chính xác!',false:'Cần ôn lại',null:'Đã lưu · Tự đối chiếu'}[String(a.grade)])+'</strong><span>Câu trả lời của bạn · '+esc(a.value||'—')+'</span><span><strong>'+esc(q.reference?'Đáp án mẫu · '+q.reference:q.answers?.[0]??'Câu mở · Đối chiếu cùng giáo viên.')+'</strong></span>'+(a.grade===null&&(q.kind===4&&q.reference||q.origin==='curriculum'&&(q.order||q.mode==='correct'))?'<span>Đối chiếu ý và cấu trúc. Cách diễn đạt khác đáp án mẫu có thể vẫn đúng.</span>':'')+(q.zh?'<span class="han">'+zhText(q.zh)+'</span>':'')+(q.pinyin?'<span>'+esc(q.pinyin)+'</span>':'')+(q.vi?'<span>'+esc(q.vi)+'</span>':'')+(q.explanation?'<span>'+esc(q.explanation)+'</span>':'')+(q.zh&&!q.audio&&canPlay(q.zh,q.pinyin)?'<div>'+questionAudio(q,'Nghe lại')+'</div>':''),a.grade===true?'ok':a.grade===false?'bad':'warn'):'';
 const last=quiz.index+1===quiz.ids.length;
 const combo=(quiz.session??quiz.fx)?.combo??0;
 return '<div class="quiz-wrap'+(quiz.session?' session':'')+'">'+(quiz.session?sessionBar():pageHead(quiz.title,'','<div class="wrap">'+button('Báo lỗi','report-q:'+q.id,'text','','title="Báo lỗi nội dung câu này"')+button(marked?'Đã đánh dấu':'Đánh dấu để ôn','mark:'+q.id,'bookmark',marked?'active':'','aria-pressed="'+Boolean(marked)+'"')+'<button type="button" class="iconbtn" data-action="sound" aria-pressed="'+soundOn()+'" aria-label="'+(soundOn()?'Tắt':'Bật')+' âm thanh phản hồi">'+svg(soundOn()?'audio':'mute')+'</button></div>',chip(locationLabel(q)))+
  '<div class="qhead"><span>Câu '+(quiz.index+1)+' / '+quiz.ids.length+'</span>'+(combo>=2&&!quiz.assessment?'<span class="combo">🔥 '+combo+' câu đúng liên tiếp</span>':'')+'<span>Đã trả lời '+answeredCount+' / '+quiz.ids.length+'</span></div>'+barHtml(pct(answeredCount,quiz.ids.length)))+
  '<section class="panel qcard form-actions">'+(quiz.session?'<div class="row split"><div class="chips">'+chip(esc(locationLabel(q)))+'</div>'+button('Báo lỗi','report-q:'+q.id,'','small','title="Báo lỗi nội dung câu này"')+'</div>':'')+'<div class="chips">'+chip(esc(kindOf(q)))+(q.level?chip(esc(q.level)):'')+chip(esc(q.origin==='teacher'?'Giáo viên':q.origin==='bank'?'Theo cấp HSK':q.origin==='guided'?'Tình huống':q.origin==='curriculum'?grammarModes[q.mode]:q.origin==='auto'?'Từ hội thoại':'Theo bài'))+'</div><h2 class="prompt lines">'+zhText(q.prompt)+'</h2>'+
  (q.audio?'<div class="reader-bar" style="padding:0;margin:0">'+readerControls()+'</div><div class="wrap">'+questionAudio(q,'Nghe câu hỏi')+'</div>':a&&canPlay(q.zh,q.pinyin)?readerControls():'')+
  '<form id="answer-form" class="cards">'+orderUI+options+feedback+(a&&!quiz.assessment?gradeTools(quiz.index,a)+askWhy(quiz.index,a):'')+'<div class="qnav">'+(quiz.session?'<span></span>':button('‹ Câu trước','prev','','',quiz.index?'':'disabled'))+'<div>'+(!a&&q.audio?button('Bỏ qua câu nghe','skip-audio'):'')+(a?button(last?(quiz.assessment?'Nộp bài':'Xem kết quả'):'Câu tiếp','next','arrow','primary'):'<button id="check-answer" class="btn primary" '+(opts&&!quiz.selection||isGuidedOrder&&selectedChunks.length!==chunks.length?'disabled':'')+'>'+(quiz.assessment?'Lưu câu trả lời':'Kiểm tra')+'</button>')+'</div></div></form></section></div>';
}

// Thẻ tab trong bài học theo khoá mức nắm bài.
const lessonTabs={vocab:'vocab',grammar:'grammar',listen:'listen',ex:'ex',extra:'extra',final:'final'};

// ===== Học 10 phút: một buổi học liền mạch (thẻ ôn → từ mới → câu sai → luyện bài → nghe → nói) và biên lai tiến bộ =====
let vocabIndex=null,hvCache=null;
const wordById=id=>{
 if(!vocabIndex){vocabIndex=new Map();for(const l of lessons)l.vocab.forEach((w,i)=>{if(w.id&&!vocabIndex.has(w.id))vocabIndex.set(w.id,{...w,n:l.n,i})})}
 return vocabIndex.get(id);
};
const currentLesson=()=>lessons.find(l=>l.n===state.last)??lessons[0];
// Âm Hán Việt dưới chữ Hán; từ đọc gần giống tiếng Việt được đánh dấu "≈ tiếng Việt".
const hvLine=(w,big=false)=>{
 const h=hanViet(w.zh,w.pinyin);
 if(!h)return '';
 const same=soundsVietnamese(w.zh,w.pinyin,w.vi);
 return '<span class="hv'+(big?' big':'')+(same?' same':'')+'" title="Âm Hán Việt"><small>Hán Việt</small>'+esc(h)+(same?'<em>≈ tiếng Việt</em>':'')+'</span>';
};
const hvWords=()=>hvCache??=[...new Map(lessons.flatMap(l=>l.vocab).filter(w=>w.id&&soundsVietnamese(w.zh,w.pinyin,w.vi)).map(w=>[w.zh,w])).values()];

// Tỷ lệ chữ Hán người học đọc hiểu được: tách từ dài nhất theo từ điển, từ đã gặp (hoặc thuộc cấp HSK dưới) tính là hiểu.
const familiar=entry=>entry.id?wstatus(entry.id)!=='new':Boolean(!isWorkplace&&entry.level&&entry.level<course);
function readable(texts,extra=new Set()){
 const dict=dictionary();
 let total=0,known=0;
 for(const text of texts)for(const part of String(text??'').match(/\p{Script=Han}+/gu)??[]){
  const chars=[...part];
  for(let k=0;k<chars.length;){
   let len=Math.min(lookupMax,chars.length-k);
   while(len>1&&!dict.has(chars.slice(k,k+len).join('')))len--;
   const word=chars.slice(k,k+len).join(''),entry=dict.get(word);
   total+=len;
   if(entry&&familiar(entry)||extra.has(word))known+=len;
   k+=len;
  }
 }
 return total?Math.round(100*known/total):null;
}
const lessonTexts=l=>(l?.dialogues??[]).flatMap(d=>d.utterances.map(u=>u.zh));
function progressSnapshot(){
 const cur=currentLesson(),p=isWorkplace?null:predictScore(state,{course,getQuestion,lessonSkill});
 const seen=new Set(lessons.flatMap(l=>l.vocab.map(w=>w.id)).filter(id=>id&&wstatus(id)!=='new')).size;
 return {known:knownWords(),seen,wrong:wrongQuestions().length,predicted:p?.total??null,evidence:p?.evidence??0,lesson:cur?.n??null,read:cur?readable(lessonTexts(cur)):null,streak:streak(state)};
}

const interleave=(a,b)=>{const out=[];for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i])out.push(a[i]);if(b[i])out.push(b[i])}return out};
const micReady=()=>Boolean(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder);
const sayable=w=>Boolean(w&&canPlay(w.zh,w.pinyin)&&hanOnly(w.zh).length>=1&&hanOnly(w.zh).length<=3&&syllables(w.pinyin,hanOnly(w.zh).length).length);
const autoGraded=q=>!q.resource&&q.answers?.length&&(q.options?.length||q.order)&&(!q.audio||canPlay(q.audio,q.pinyin));
function sessionPlan(mini=false){
 const cur=currentLesson(),srs=ensureStudy(state).srs;
 const isNew=w=>Boolean(w?.id)&&!srs[w.id]&&!state.words?.[w.id];
 const queue=dueQueue(state,lessons);
 const reviews=queue.cards.filter(w=>!isNew(w)).slice(0,mini?4:8);
 const freshPool=[...(cur?.vocab??[]).map(w=>wordById(w.id)),...queue.cards].filter(isNew);
 const fresh=[...new Map(freshPool.map(w=>[w.id,w])).values()].slice(0,Math.min(mini?2:4,queue.fresh));
 const checks=fresh.map(w=>shuffle(questions.filter(q=>q.word===w.id&&q.options?.length&&q.answers?.length&&!q.resource&&!q.audio))[0]).filter(Boolean);
 const wrong=ranked(dueWrongQuestions().filter(autoGraded)).slice(0,mini?2:3);
 const used=new Set([...checks,...wrong].map(q=>q.id)),tried=new Set(state.attempts.map(a=>a.id));
 const pool=(cur?.questions??[]).filter(q=>autoGraded(q)&&!used.has(q.id)&&lessonSkill(q)!=='listen');
 const practice=[...ranked(pool.filter(q=>!tried.has(q.id))),...ranked(pool.filter(q=>tried.has(q.id)))].slice(0,mini?2:4);
 const listen=mini?[]:ranked(lessons.filter(l=>l.n<=(cur?.n??1)).flatMap(l=>l.questions).filter(q=>autoGraded(q)&&q.audio&&lessonSkill(q)==='listen'&&!used.has(q.id))).slice(0,1);
 const say=mini||!micReady()?null:[...fresh,...reviews,...(cur?.vocab??[]).map(w=>wordById(w.id))].find(sayable);
 const ids=[...reviews.map(w=>'card:'+w.id),...interleave(fresh.map(w=>'learn:'+w.id),wrong.map(q=>q.id)),...interleave(checks.map(q=>q.id),practice.map(q=>q.id)),...listen.map(q=>q.id),...(say?['say:'+say.id]:[])];
 const answers=wrong.length+checks.length+practice.length+listen.length;
 return {ids,lesson:cur?.n??null,wrongIds:wrong.map(q=>q.id),
  counts:{cards:reviews.length,fresh:fresh.length,wrong:wrong.length,practice:checks.length+practice.length+listen.length,say:say?1:0},
  minutes:Math.max(2,Math.round((reviews.length*12+fresh.length*25+answers*25+(say?60:0))/60))};
}
function startSession(mini=false){
 if(quiz&&!quiz.done&&quiz.session){go('quiz');return}
 const plan=sessionPlan(mini);
 if(!plan.ids.length){notify('Hôm nay bạn đã ôn hết thẻ và câu sai. Mở bài tiếp theo để học từ mới nhé!');go('lessons');return}
 if(quiz&&!quiz.done&&quiz.answers.length&&!confirm('Bắt đầu buổi học và kết thúc lượt ôn đang làm?'))return;
 const qs=plan.ids.map(getQuestion).filter(Boolean);
 quiz={title:mini?'Học nhanh 3 phút':'Học '+plan.minutes+' phút',ids:plan.ids,options:Object.fromEntries(qs.filter(q=>q.options).map(q=>[q.id,shuffle(q.options)])),chunks:Object.fromEntries(qs.filter(q=>q.order).map(q=>[q.id,shuffle(q.order)])),
  index:0,answers:[],selection:'',final:null,assessment:false,returnTo:'home',practicePaper:null,done:false,
  session:{before:progressSnapshot(),startedAt:Date.now(),combo:0,best:0,mini,lesson:plan.lesson,wrongIds:plan.wrongIds}};
 srsFlip=false;sayReset(null);saveQuiz();go('quiz');window.scrollTo(0,0);
}
const sessionItem=id=>{const m=/^(card|learn|say):(.+)$/.exec(id??'');return m?{kind:m[1],w:wordById(m[2])}:null};
function sessionAnswer(extra){quiz.answers[quiz.index]={id:quiz.ids[quiz.index],grade:null,at:Date.now(),...extra};saveQuiz()}
function sessionNext(){
 stopAudio();srsFlip=false;
 if(quiz.index+1>=quiz.ids.length)finish();
 else{quiz.index++;quiz.selection='';quiz.picked=[];saveQuiz();render();window.scrollTo(0,0)}
}
function sessionBar(){
 const s=quiz.session,n=quiz.ids.length,done=quiz.answers.filter(Boolean).length,on=soundOn();
 return '<div class="sess-bar"><button type="button" class="iconbtn" data-action="sess-exit" aria-label="Kết thúc buổi học">'+svg('close')+'</button>'+
  '<div class="bar sess-progress" role="progressbar" aria-label="Tiến độ buổi học" aria-valuenow="'+done+'" aria-valuemin="0" aria-valuemax="'+n+'"><i style="width:'+pct(done,n)+'%"></i></div>'+
  '<span class="sess-count">'+Math.min(n,quiz.index+1)+'/'+n+'</span>'+(s.combo>=2?'<span class="combo" aria-live="polite" title="Đúng liên tiếp">🔥 '+s.combo+'</span>':'')+
  '<button type="button" class="iconbtn" data-action="sound" aria-pressed="'+on+'" aria-label="'+(on?'Tắt':'Bật')+' âm thanh phản hồi">'+svg(on?'audio':'mute')+'</button></div>';
}
function sessionItemPage(item){
 const {kind,w}=item;
 const body=!w?'<section class="panel">'+note('Từ này vừa được cập nhật trong học liệu.')+'<div class="learn-actions">'+button('Bỏ qua','sess-skip','arrow','primary')+'</div></section>'
  :kind==='card'?sessionCard(w):kind==='learn'?learnCard(w):sayCard(w);
 return '<div class="quiz-wrap session'+(kind==='learn'&&w?' wide':'')+'">'+sessionBar()+body+'</div>';
}
function sessionCard(w){
 const card=ensureStudy(state).srs[w.id],direction=cardDirection(card,w.id,canPlay(w.zh,w.pinyin));
 const front=direction==='recall'?'<span class="srs-ask">'+esc(w.vi)+'</span><small>Nhớ ra chữ Hán và pinyin rồi lật thẻ</small>'
  :direction==='listen'?'<span class="srs-ask">Nghe và đoán nghĩa</span><small>Bấm “Nghe từ”, đoán nghĩa rồi lật thẻ</small>'
  :'<b class="han" lang="zh-CN">'+esc(w.zh)+'</b><small>Nhớ nghĩa rồi chạm để lật · phím Space</small>';
 const back='<b class="han" lang="zh-CN">'+esc(w.zh)+'</b><span class="py">'+esc(w.pinyin)+'</span>'+hvLine(w)+'<span>'+esc(w.vi)+'</span>';
 const listenFirst=direction==='listen'&&!srsFlip;
 const audio=(direction==='listen'||srsFlip)&&canPlay(w.zh,w.pinyin)?'<div class="srs-audio">'+audioButton(voiceKey(w.zh,w.pinyin),listenFirst?'Nghe từ':'Phát âm',listenFirst?'primary':'').replace('data-action','data-autoplay="1" data-action')+'</div>':'';
 return '<section class="panel srs-card sess-card"><div class="row split"><span class="chip">Ôn thẻ · '+esc(lessonLabel(w.n))+'</span><small class="muted">'+(card?'Đến hạn ôn':'Chưa thuộc')+' · '+CARD_DIRECTIONS[direction]+'</small></div>'+audio+
  '<button type="button" class="srs-flash" data-action="sess-flip" aria-label="'+(srsFlip?'Úp thẻ':'Lật thẻ')+'">'+(srsFlip?back:front)+'</button>'+
  (srsFlip?'<div class="srs-rate">'+[['hard','Quên','danger'],['ok','Nhớ mang máng',''],['easy','Nhớ rõ','primary']].map(([k,label,t],i)=>'<button type="button" class="btn '+t+'" data-action="sess-rate:'+k+'"><span>'+label+'</span><small>'+dayWord(nextStep(card,k))+' · phím '+(i+1)+'</small></button>').join('')+'</div>'
   :'<div class="srs-rate placeholder"><button type="button" class="btn primary" data-action="sess-flip">Lật thẻ</button></div>')+'</section>';
}
// Ví dụ trong học liệu: dòng chữ Hán (có số thứ tự "1."), tiếp theo dòng pinyin "/…/" và có thể có dòng nghĩa.
function parseExamples(list){
 const out=[];
 for(const raw of list??[]){
  const line=String(raw??'').trim();
  if(!line)continue;
  if(/\p{Script=Han}/u.test(line))out.push({zh:line.replace(/^\s*\d+\s*[.)、:：]\s*/,''),py:'',vi:''});
  else if(out.length&&!out.at(-1).py&&/^\//.test(line))out.at(-1).py=line.replace(/^\/|\/$/g,'').trim();
  else if(out.length&&!out.at(-1).vi)out.at(-1).vi=line;
 }
 return out.slice(0,3);
}
// "Chữ này còn gặp trong": các từ khác có cùng chữ, ưu tiên từ đã học, kèm âm Hán Việt để đoán nghĩa.
let charIndex=null;
function relatedWords(w){
 if(!charIndex){
  charIndex=new Map();
  const seen=new Set();
  for(const x of [...lessons.flatMap(l=>l.vocab),...(wordlist??[])]){
   if(!x?.zh||!/^\p{Script=Han}{2,4}$/u.test(x.zh)||seen.has(x.zh))continue;
   seen.add(x.zh);
   for(const c of new Set(x.zh)){if(!charIndex.has(c))charIndex.set(c,[]);charIndex.get(c).push(x)}
  }
 }
 const chars=hanOnly(w.zh),sy=syllables(w.pinyin,chars.length),rank=x=>x.id&&wstatus(x.id)!=='new'?2:soundsVietnamese(x.zh,x.pinyin,x.vi)?1:0;
 return [...new Set(chars)].map(c=>({c,hv:hanVietChar(c,sy[chars.indexOf(c)]??''),words:(charIndex.get(c)??[]).filter(x=>x.zh!==w.zh).sort((a,b)=>rank(b)-rank(a)).slice(0,3)})).filter(g=>g.words.length);
}
const kbd=(html,key)=>html.replace(/<\/button>$/,'<kbd class="kb">'+key+'</kbd></button>');
function learnCard(w){
 const hv=hanViet(w.zh,w.pinyin),same=soundsVietnamese(w.zh,w.pinyin,w.vi),examples=parseExamples(w.examples),related=relatedWords(w);
 const mark=html=>html.replaceAll('class="zh-tok" role="button" tabindex="0" data-action="lookup:'+encodeURIComponent(w.zh)+'"','class="zh-tok hl" role="button" tabindex="0" data-action="lookup:'+encodeURIComponent(w.zh)+'"');
 const audio=canPlay(w.zh,w.pinyin)?audioButton(voiceKey(w.zh,w.pinyin),'Nghe lại').replace('data-action','data-autoplay="1" data-action'):'';
 return '<section class="panel learn-card"><div class="row split"><span class="chip warm">Từ mới · '+esc(lessonLabel(w.n))+'</span>'+(same?'<span class="badge" data-k="ok">Đọc gần giống tiếng Việt</span>':'')+'</div>'+
  '<div class="learn-grid"><div class="learn-word"><b class="han" lang="zh-CN">'+esc(w.zh)+'</b><span class="py">'+esc(w.pinyin)+'</span>'+hvLine(w,true)+(audio?'<div class="learn-audio">'+kbd(audio,'R')+'</div>':'')+'</div>'+
  '<div class="learn-info"><div class="learn-meaning"><small>Nghĩa</small><b>'+esc(w.vi)+'</b></div>'+
  (same?note('<strong>Mẹo nhớ</strong><span>Âm Hán Việt <b>'+esc(hv)+'</b> trùng nghĩa tiếng Việt: bạn gần như đã biết từ này rồi!</span>','ok','check'):'')+
  (related.length?'<div class="learn-rel"><small>Chữ này còn gặp trong</small>'+related.map(g=>'<div class="rel-row"><span class="rel-char"><b class="han" lang="zh-CN">'+esc(g.c)+'</b>'+(g.hv?'<em>'+esc(g.hv.toLocaleUpperCase('vi'))+'</em>':'')+'</span><span class="rel-words">'+
    g.words.map(x=>{const h=hanViet(x.zh,x.pinyin);return '<button type="button" class="rel-word" data-action="lookup:'+encodeURIComponent(x.zh)+'"><b class="han" lang="zh-CN">'+esc(x.zh)+'</b>'+(h?'<small>'+esc(h)+'</small>':'')+'<span>'+esc(String(x.vi??'').split(/[,;]/)[0])+'</span></button>'}).join('')+'</span></div>').join('')+'</div>'
   :hv&&!same?'<p class="muted learn-tip">Mẹo: nhớ âm Hán Việt <b>'+esc(hv)+'</b> để đoán nghĩa khi gặp chữ này trong từ khác.</p>':'')+
  (examples.length?'<div class="learn-ex"><small>Ví dụ</small><ol>'+examples.map(e=>'<li><p class="han" lang="zh-CN">'+mark(zhText(e.zh))+'</p>'+(e.py?'<p class="py">'+esc(e.py)+'</p>':'')+(e.vi?'<p class="vi">'+esc(e.vi)+'</p>':'')+'</li>').join('')+'</ol></div>':'')+
  '</div></div>'+
  '<div class="learn-actions">'+kbd(button('Tôi biết rồi','sess-learn:known','check'),'B')+kbd(button('Đã nhớ · tiếp','sess-learn:new','arrow','primary'),'Enter')+'</div></section>';
}

// ----- Luyện thanh điệu (dùng trong buổi học và mục Luyện nói) -----
let say={key:null,phase:'idle',user:null,ref:null,refKey:null,score:null,error:'',rec:null,audio:null};
function sayReset(key){
 try{say.rec?.stop()}catch{}
 if(say.audio)URL.revokeObjectURL(say.audio);
 const keepRef=say.refKey===key&&key!==null;
 say={key,phase:'idle',user:null,ref:keepRef?say.ref:null,refKey:keepRef?key:null,score:null,error:'',rec:null,audio:null};
}
function refUrls(zh,pinyin){
 const choice=audioChoice(voiceKey(zh,pinyin));
 if(!choice)return null;
 return (Array.isArray(choice.source)?choice.source:[choice.source]).map(file=>new URL(file,location.origin+'/audio/').href);
}
async function analyzeTone(item,blob){
 const key=item.zh,urls=refUrls(item.zh,item.pinyin);
 const [user,ref]=await Promise.all([analyzeBlob(blob),say.refKey===key&&say.ref?say.ref:urls?analyzeUrl(urls).catch(()=>null):null]);
 if(say.key!==key)return;
 Object.assign(say,{user,ref,refKey:key,score:similarity(user,ref),phase:'done',error:user?'':'Chưa nghe rõ giọng của bạn. Nói to, rõ và gần micro hơn rồi thử lại.'});
 if(!say.audio)say.audio=URL.createObjectURL(blob);
}
async function sayRecord(w){
 if(say.phase==='rec'){say.rec?.stop();return}
 if(say.phase==='analyzing')return;
 sayReset(w.zh);stopAudio();
 try{say.rec=await recordVoice(4000)}catch{notify(window.isSecureContext&&navigator.mediaDevices?'Chưa dùng được micro. Hãy cho phép FangSchool truy cập micro.':'Micro chỉ dùng được khi mở FangSchool qua HTTPS.');return}
 const key=w.zh;
 say.phase='rec';render();
 const blob=await say.rec.blob;
 if(say.key!==key)return;
 say.rec=null;say.phase='analyzing';render();
 try{await analyzeTone(w,blob)}catch{if(say.key===key)Object.assign(say,{phase:'done',error:'Trình duyệt chưa phân tích được bản ghi này.'})}
 render();
}
async function speakTone(item){
 sayReset(item.zh);say.phase='analyzing';render();
 try{await analyzeTone(item,await speakBlob)}catch{if(say.key===item.zh)Object.assign(say,{phase:'done',error:'Trình duyệt chưa phân tích được bản ghi này.'})}
 render();
}
function toneView(w){
 const chars=hanOnly(w.zh),sy=syllables(w.pinyin,chars.length),targets=toneTargets(w.zh,sy);
 if(!targets.length)return '';
 const active=say.key===w.zh;
 return '<div class="tone-view">'+toneChart({user:active?say.user:null,ref:active?say.ref:null,targets,labels:sy.map((s,i)=>chars[i]+' '+s)})+
  '<div class="tc-legend"><span><i class="l-shape"></i>Khuôn thanh</span>'+(active&&say.ref?'<span><i class="l-ref"></i>Giọng mẫu</span>':'')+(active&&say.user?'<span><i class="l-user"></i>Giọng bạn</span>':'')+'</div></div>';
}
// Nhận xét theo độ giống đường giọng mẫu (không tự chấm đúng/sai thanh vì cách đó chưa đủ tin cậy).
function toneScoreNote(){
 if(say.phase!=='done'||say.error||!say.user)return '';
 if(say.score===null)return note('<strong>Đây là đường giọng của bạn</strong><span>Từ này chưa có giọng mẫu để so. Đối chiếu với khuôn thanh (nét đứt): lên, xuống hay ngang cùng lúc là tốt.</span>');
 const s=say.score,k=s>=70?'ok':s>=50?'warn':'bad';
 return note('<strong>Giống đường giọng mẫu '+s+'%'+(s>=70?' · rất tốt!':s>=50?' · khá giống':' · chưa giống')+'</strong><span>'+(s>=70?'Giọng lên xuống của bạn bám sát giọng mẫu.':'Nghe mẫu thêm lần nữa, chú ý chỗ giọng mẫu (xám) đi lên hoặc xuống mà đường của bạn (xanh) chưa theo.')+'</span>',k);
}
const micIcon='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
function sayCard(w){
 if(say.key!==w.zh)sayReset(w.zh);
 return '<section class="panel say-card"><div class="row split"><span class="chip">Luyện nói · thanh điệu</span><small class="muted">Nghe mẫu → đọc theo → so đường thanh</small></div>'+
  '<div class="learn-word"><b class="han" lang="zh-CN">'+esc(w.zh)+'</b><span class="py">'+esc(w.pinyin)+'</span><span class="vi">'+esc(w.vi)+'</span></div>'+toneView(w)+
  (say.phase==='rec'?'<div class="sp-rec" role="status"><span class="rec-dot"></span><strong>Đang ghi âm… đọc to từ trên rồi bấm Dừng</strong></div>':'')+
  (say.phase==='analyzing'?'<div class="sp-rec" role="status" aria-busy="true"><strong>Đang phân tích thanh điệu…</strong></div>':'')+
  toneScoreNote()+
  (say.error?note(esc(say.error),'warn'):'')+
  '<div class="wrap" style="justify-content:center">'+(canPlay(w.zh,w.pinyin)?audioButton(voiceKey(w.zh,w.pinyin),'Nghe mẫu').replace('data-action','data-autoplay="1" data-action'):'')+
  '<button type="button" class="btn '+(say.phase==='rec'?'danger':'primary')+'" data-action="say-rec" '+(say.phase==='analyzing'?'disabled':'')+'>'+micIcon+(say.phase==='rec'?'Dừng':say.phase==='done'?'Đọc lại':'Bấm để đọc')+'</button>'+
  (say.audio&&say.phase==='done'?button('Nghe lại giọng bạn','say-play','audio'):'')+'</div>'+
  '<div class="learn-actions">'+button(say.phase==='done'?'Tiếp':'Bỏ qua','sess-say','arrow',say.phase==='done'?'primary':'')+'</div>'+
  '<small class="muted">Phân tích ngay trên máy, bản ghi không rời khỏi thiết bị. Điểm chỉ đo độ giống đường lên xuống của giọng, mang tính gợi ý.</small></section>';
}

// ----- Phản hồi tức thì khi trả lời (âm thanh, rung, chuỗi đúng, đọc đáp án) -----
function answerFeedback(q,a){
 if(quiz.assessment||a.grade===null)return;
 const s=quiz.session??(quiz.fx??={combo:0,best:0});
 if(a.grade){
  s.combo=(s.combo??0)+1;s.best=Math.max(s.best??0,s.combo);
  sfx(s.combo>=3?'combo':'ok');buzz('ok');
  if(s.combo%5===0)setTimeout(()=>confetti(document.querySelector('.qcard')??document.body,22),60);
 }else{s.combo=0;sfx('bad');buzz('bad')}
 if(q.zh&&!q.audio&&canPlay(q.zh,q.pinyin)&&soundOn())setTimeout(()=>document.querySelector('.qcard .note [data-action^="speak:"]')?.click(),500);
}

// ----- Biên lai buổi học -----
function buildReceipt(){
 const s=quiz.session,after=progressSnapshot();
 const real=quiz.answers.filter(a=>a&&!a.special&&!a.skipped),graded=real.filter(a=>a.grade!==null);
 const cards=quiz.answers.filter(a=>a?.special==='card'),spoken=quiz.answers.find(a=>a?.special==='say');
 const endTomorrow=new Date().setHours(0,0,0,0)+2*DAY_MS;
 return {at:Date.now(),minutes:Math.max(1,Math.round((Date.now()-s.startedAt)/60000)),correct:graded.filter(a=>a.grade).length,graded:graded.length,
  cards:cards.length,remembered:cards.filter(a=>a.rating!=='hard').length,learned:quiz.answers.filter(a=>a?.special==='learn').map(a=>a.id.slice(6)),
  fixed:real.filter(a=>s.wrongIds?.includes(a.id)&&a.grade===true).length,best:s.best??0,say:Number.isFinite(spoken?.score)?{score:spoken.score}:null,
  wrongIds:graded.filter(a=>!a.grade).map(a=>a.id),before:s.before,after,
  tomorrow:Object.entries(ensureStudy(state).srs).filter(([k,c])=>!k.startsWith('q:')&&c.due<endTomorrow).length};
}
function receiptPage(){
 const r=quiz.session.receipt??buildReceipt(),b=r.before,a=r.after;
 const tile=(value,label,glyph,cls='')=>'<div class="rc-tile '+cls+'"><span class="rc-ico han" aria-hidden="true">'+glyph+'</span><strong data-count="'+value+'">'+value+'</strong><small>'+esc(label)+'</small></div>';
 const tiles=[r.learned.length?tile(r.learned.length,'từ mới đã học','新','warm'):'',r.cards?tile(r.remembered,'/'+r.cards+' thẻ ôn còn nhớ','忆'):'',
  r.graded?tile(r.correct,'/'+r.graded+' câu làm đúng','对','ok'):'',r.fixed?tile(r.fixed,'câu sai đã sửa được','改','violet'):'',r.best>=3?tile(r.best,'câu đúng liên tiếp','🔥','warm'):''].join('');
 const rows=[];
 if(a.seen!==b.seen)rows.push(['Từ vựng đã học',b.seen,a.seen,'']);
 if(a.known!==b.known)rows.push(['Từ đã nhớ chắc (ôn ≥ 7 ngày)',b.known,a.known,'']);
 // Dự đoán chỉ so sánh khi đã đủ dữ liệu (≥ 40 câu chấm), tránh các bước nhảy vô nghĩa lúc mới học.
 const predictReady=b.predicted!==null&&a.predicted!==null&&(b.evidence??0)>=40;
 if(predictReady)rows.push(['Dự đoán điểm '+courseName,b.predicted,a.predicted,'']);
 if(b.read!==null&&a.read!==null&&b.lesson===a.lesson)rows.push(['Đọc hiểu chữ trong hội thoại '+lessonLabel(a.lesson),b.read,a.read,'%']);
 if(a.wrong!==b.wrong)rows.push(['Câu sai đã xếp lịch ôn',b.wrong,a.wrong,'',true]);
 rows.push(['Chuỗi ngày học',b.streak,a.streak,' ngày']);
 const rowHtml=rows.map(([label,x,y,unit,lower])=>{const d=y-x,good=lower?d<0:d>0,tone=good?'ok':lower?'muted':'bad';return '<div class="rc-row"><span>'+esc(label)+'</span><span class="rc-vals">'+(d?'<s>'+x+unit+'</s>'+svg('arrow'):'')+'<b>'+y+unit+'</b>'+(d?'<em data-k="'+tone+'">'+(d>0?'+':'')+d+unit+'</em>':'')+'</span></div>'}).join('');
 const words=r.learned.map(wordById).filter(Boolean).map(w=>'<div class="rc-word"><b class="han" lang="zh-CN">'+esc(w.zh)+'</b><span class="py">'+esc(w.pinyin)+'</span>'+hvLine(w)+'<small>'+esc(w.vi)+'</small></div>').join('');
 const missed=(r.wrongIds??[]).map(getQuestion).filter(Boolean).map(q=>'<li><strong class="lines">'+zhText(q.prompt)+'</strong><span>Đáp án: <b class="han">'+esc(q.reference??q.answers?.[0]??'')+'</b>'+(q.pinyin?' · '+esc(q.pinyin):'')+(q.vi?' · '+esc(q.vi):'')+'</span></li>').join('');
 const ratio=r.graded?r.correct/r.graded:1;
 const title=ratio>=.8?'Xuất sắc! 太棒了！':ratio>=.5?'Xong buổi học! 做得好！':'Xong buổi học, mai ôn tiếp nhé!';
 const predictUp=predictReady&&a.predicted>b.predicted;
 const lead=predictUp?'Dự đoán điểm '+courseName+' của bạn vừa tăng '+(a.predicted-b.predicted)+' điểm.':r.learned.length?'Bạn vừa thêm '+r.learned.length+' từ mới vào trí nhớ dài hạn.':'Bạn vừa củng cố những gì sắp quên, đúng lúc nhất.';
 const lesson=getLesson(a.lesson??state.last);
 return '<div class="quiz-wrap receipt"><section class="rc-hero"><span class="eyebrow">BIÊN LAI BUỔI HỌC · '+r.minutes+' PHÚT</span><h1>'+esc(title)+'</h1><p>'+esc(lead)+'</p><div class="rc-tiles">'+tiles+'</div></section>'+
  '<section class="panel rc-progress"><h2>Bạn đã tiến bộ ở đâu</h2>'+rowHtml+'</section>'+
  (words?'<section class="panel"><h2>Từ mới hôm nay</h2><div class="rc-words">'+words+'</div></section>':'')+
  (r.say?note('<strong>Luyện thanh điệu: giống giọng mẫu '+r.say.score+'%</strong><span>Luyện thêm ở mục Luyện nói của bài để giọng lên xuống tự nhiên hơn.</span>',r.say.score>=70?'ok':'warn','check'):'')+
  (missed?'<details class="panel rc-missed"><summary>Xem lại '+(r.wrongIds.length)+' câu sai (đã xếp lịch ôn ngày mai)</summary><ul>'+missed+'</ul></details>':'')+
  '<section class="panel rc-next"><h2>Tiếp theo</h2><p>Ngày mai FangSchool xếp sẵn khoảng <b>'+r.tomorrow+' thẻ</b> cần ôn, đúng lúc bạn sắp quên.</p><div class="wrap">'+
   (viewer.aiAvailable?button('Đọc truyện bằng từ bạn biết','go:story','book','primary'):'')+
   (tutor&&lesson?button('Hội thoại AI theo '+lessonLabel(lesson.n),'today-talk:'+lesson.n,'text'):'')+
   button('Học thêm 3 phút','sess-start:mini','bolt',viewer.aiAvailable?'':'primary')+button('Về trang chủ','go:home','home')+'</div></section></div>';
}

// ----- Lộ trình thi: kiểm tra đầu vào, kiểm tra tuần, đếm ngược và dự báo -----
function checkTrend(checks){
 if(checks.length<2||checks.at(-1).at-checks[0].at<4*DAY_MS)return null;
 const xs=checks.map(c=>c.at/DAY_MS),ys=checks.map(c=>c.total),mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,y)=>s+y,0)/ys.length;
 const den=xs.reduce((s,x)=>s+(x-mx)**2,0);
 return den?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/den:null;
}
function journeyChart(checks,pass,max,examAt,projected){
 const W=520,H=150,l=34,r=12,t=12,bt=24;
 const t0=checks[0].at,t1=Math.max(checks.at(-1).at,examAt??0,t0+7*DAY_MS);
 const x=at=>l+(at-t0)/(t1-t0)*(W-l-r),y=v=>t+(1-v/max)*(H-t-bt);
 const pts=checks.map(c=>x(c.at).toFixed(1)+','+y(c.total).toFixed(1)).join(' ');
 const proj=projected!==null&&examAt?'<line x1="'+x(checks.at(-1).at).toFixed(1)+'" y1="'+y(checks.at(-1).total).toFixed(1)+'" x2="'+x(examAt).toFixed(1)+'" y2="'+y(projected).toFixed(1)+'" class="jc-proj"/><circle cx="'+x(examAt).toFixed(1)+'" cy="'+y(projected).toFixed(1)+'" r="5" class="jc-goal"/>':'';
 return '<svg class="journey-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Điểm các lần kiểm tra: '+checks.map(c=>c.total).join(', ')+'. Điểm đạt '+pass+'.">'+
  '<line x1="'+l+'" x2="'+(W-r)+'" y1="'+y(pass)+'" y2="'+y(pass)+'" class="jc-pass"/><text x="'+(l+4)+'" y="'+(y(pass)-5)+'" class="jc-label">Điểm đạt '+pass+'</text>'+
  '<text x="'+(l-6)+'" y="'+(y(max)+4)+'" class="jc-axis" text-anchor="end">'+max+'</text><text x="'+(l-6)+'" y="'+(y(0)+4)+'" class="jc-axis" text-anchor="end">0</text>'+proj+
  '<polyline points="'+pts+'" class="jc-line"/>'+checks.map(c=>'<circle cx="'+x(c.at).toFixed(1)+'" cy="'+y(c.total).toFixed(1)+'" r="4" class="jc-dot"><title>'+fmtDate(c.at)+': '+c.total+'</title></circle>').join('')+
  '<text x="'+l+'" y="'+(H-6)+'" class="jc-axis">'+fmtDate(t0)+'</text>'+(examAt?'<text x="'+(W-r)+'" y="'+(H-6)+'" class="jc-axis" text-anchor="end">Ngày thi '+fmtDate(examAt)+'</text>':'')+'</svg>';
}
function journeyCard(){
 const pass=examPass(course);
 if(isWorkplace||!pass)return '';
 const plan=ensureStudy(state).plan,checks=plan.checks,last=checks.at(-1);
 const today=new Date().setHours(0,0,0,0),examAt=plan.exam?new Date(plan.exam+'T00:00:00').getTime():null;
 const days=examAt===null?null:Math.round((examAt-today)/DAY_MS);
 const dateInput='<label class="exam-date">Ngày thi <input type="date" id="exam-date" value="'+esc(plan.exam)+'"></label>';
 if(!last)return '<section class="panel journey cta"><div class="row split"><h2>Bạn đang ở đâu so với điểm đạt '+courseName+'?</h2><span class="badge" data-k="warn">5 phút</span></div>'+
  '<p>Làm bài kiểm tra đầu vào 12 câu theo chuẩn '+courseName+'. FangSchool quy ra điểm trên thang '+pass.max+' (đạt từ '+pass.pass+'), rồi mỗi tuần kiểm tra lại 5 phút để vẽ đường tiến bộ của bạn.</p>'+
  '<div class="wrap">'+button('Kiểm tra đầu vào','check:p','target','primary')+dateInput+'</div></section>';
 // Dự báo bão hoà: càng gần điểm tối đa càng khó tăng, nên đà tăng hiện tại giảm dần theo thời gian (thận trọng hơn kéo thẳng).
 const trend=checkTrend(checks),room=last.max-last.total;
 const projected=trend!==null&&days!==null&&days>0?Math.max(0,Math.min(last.max,Math.round(trend>0&&room>0?last.total+room*(1-Math.exp(-trend*days/room)):last.total+trend*days))):null;
 const gain=last.total-checks[0].total,due=Date.now()-last.at>=6.5*DAY_MS,goal=ensureStudy(state).goal;
 const countdown=days===null?'Đặt ngày thi để FangSchool dự báo điểm của bạn':days<0?'Ngày thi đã qua · đặt ngày thi mới':days===0?'Hôm nay thi! 加油！':'Còn <b>'+days+'</b> ngày đến ngày thi';
 const perWeek=trend!==null?Math.round(trend*7):null;
 const forecast=projected!==null?(projected>=pass.pass
   ?note('<strong>Theo đà hiện tại ('+(perWeek>=0?'+':'')+perWeek+' điểm/tuần), ngày thi bạn đạt khoảng '+projected+'/'+last.max+': ĐẠT.</strong><span>Giữ nhịp '+goal+' phút mỗi ngày là đủ.</span>','ok','check')
   :note('<strong>Theo đà hiện tại, ngày thi bạn đạt khoảng '+projected+'/'+last.max+', còn thiếu '+(pass.pass-projected)+' điểm.</strong><span>'+(goal<30?'Tăng mục tiêu lên '+(goal<20?20:30)+' phút mỗi ngày':'Học thêm một buổi “Học 10 phút” mỗi ngày')+' và luyện kỹ năng yếu nhất để kịp.</span>','warn','bolt'))
  :checks.length<2||!trend?'<p class="muted">Làm kiểm tra tuần (5 phút) để FangSchool vẽ đường tiến bộ'+(days!==null&&days>0?' và dự báo điểm ngày thi':'')+'.</p>':'';
 return '<section class="panel journey"><div class="row split"><h2>Lộ trình '+courseName+'</h2><span class="badge" data-k="'+(last.total>=pass.pass?'ok':'warn')+'">'+last.total+'/'+last.max+(last.total>=pass.pass?' · đạt':' · cần '+pass.pass)+'</span></div>'+
  '<p class="journey-count">'+countdown+(checks.length>1?' · từ lần đầu: <b class="'+(gain>=0?'ok':'bad')+'">'+(gain>=0?'+':'')+gain+' điểm</b>':'')+'</p>'+
  journeyChart(checks,pass.pass,last.max,examAt&&days>0?examAt:null,projected)+forecast+
  '<div class="wrap">'+(due?button('Kiểm tra tuần · 5 phút','check:w','target','primary'):'<small class="muted">Kiểm tra tuần tiếp theo: '+fmtDate(last.at+7*DAY_MS)+'</small>')+dateInput+'</div></section>';
}
function startCheck(kind){
 const pool=levelQuestions.filter(q=>q.answers?.length&&q.options?.length&&!q.resource&&(!q.audio||canPlay(q.audio,q.pinyin)));
 if(pool.length<6){notify('Cấp này chưa đủ câu để làm bài kiểm tra.');return}
 start(pool,(kind==='p'?'Kiểm tra đầu vào':'Kiểm tra tuần')+' · '+courseName,12,'balanced',null,'home',null,{assessment:true,check:kind});
}
function checkPanel(){
 const c=quiz.checkResult;
 if(!c)return '';
 const delta=c.prev===null?null:c.total-c.prev;
 return '<section class="panel check-result"><div class="score-ring" style="--p:'+pct(c.total,c.max)+'"><span data-count="'+c.total+'">'+c.total+'</span></div><div class="grow"><h2>'+(quiz.check==='p'?'Điểm xuất phát của bạn':'Kết quả kiểm tra tuần')+': '+c.total+'/'+c.max+'</h2>'+
  '<p>Điểm đạt '+courseName+': '+c.pass+'. '+(delta===null?'Mỗi tuần làm lại 5 phút để thấy đường tiến bộ của mình.':'So với lần trước: <b class="'+(delta>=0?'ok':'bad')+'">'+(delta>=0?'+':'')+delta+' điểm</b>.')+'</p>'+
  '<div class="predict-parts">'+c.parts.map(p=>'<div><div class="row split"><span>'+esc(p.name)+'</span><small>'+(p.score===null?'chưa có câu':p.score+'/'+p.max)+'</small></div>'+barHtml(p.score===null?0:pct(p.score,p.max),'thin')+'</div>').join('')+'</div>'+
  '<div class="wrap form-actions"><label class="exam-date">Ngày thi của bạn <input type="date" id="exam-date" value="'+esc(ensureStudy(state).plan.exam)+'"></label>'+button('Xem lộ trình','go:home','arrow','primary')+'</div></div></section>';
}

// ----- Đọc truyện chỉ bằng từ đã biết (AI viết, đọc bằng giọng AI) -----
let story=storage('story',null),storyBusy=false,storyShow=new Set(),storyPicks={},storyChain=0;
const storyAudio=new Map(),storyPlayer=new Audio();
function storyWords(){
 const srs=ensureStudy(state).srs;
 const words=[...new Map(lessons.flatMap(l=>l.vocab).filter(w=>w.id&&w.zh&&wstatus(w.id)!=='new').map(w=>[w.zh,w])).values()].sort((a,b)=>(srs[b.id]?.step??0)-(srs[a.id]?.step??0));
 // Chỉ gửi mục là từ chữ Hán thuần (một số mục Công xưởng/Văn phòng kèm pinyin hoặc ghi chú).
 const hanWord=z=>/^\p{Script=Han}{1,8}$/u.test(z??'');
 const known=words.filter(w=>hanWord(w.zh)).slice(0,200).map(w=>w.zh);
 if(!isWorkplace&&course>1)known.push(...(wordlist??[]).filter(w=>hanWord(w?.zh)&&w.level<course&&!known.includes(w.zh)).map(w=>w.zh).slice(0,Math.max(0,220-known.length)));
 const fresh=(currentLesson()?.vocab??[]).filter(w=>hanWord(w.zh)&&wstatus(w.id)==='new').slice(0,2);
 return {known:known.slice(0,240),fresh,count:words.length};
}
async function newStory(){
 if(storyBusy)return;
 const {known,fresh}=storyWords();
 if(known.length<8){notify('Học thêm vài từ để mở khóa truyện nhé.');return}
 storyBusy=true;render();
 try{
  const response=await fetch('/api/ai/story',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({course:courseId,known,fresh:fresh.map(w=>w.zh),topic:currentLesson()?.vi??''})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error??body.message??'AI chưa viết được truyện. Vui lòng thử lại.');
  for(const url of storyAudio.values())URL.revokeObjectURL(url);
  storyAudio.clear();storyShow=new Set();storyPicks={};
  story={...body,fresh:fresh.map(w=>w.zh),at:Date.now(),course:courseId};
  persist('story',story);
 }catch(error){notify(error instanceof TypeError?'Không kết nối được với AI. Vui lòng thử lại.':error.message)}
 finally{storyBusy=false;if(location.hash==='#story')render()}
}
async function storySay(i,trigger,chain=0){
 const s=story?.sentences?.[i];
 if(!s)return;
 if(!chain){storyChain++;stopAudio()}
 const run=chain||storyChain;
 document.querySelectorAll('.story-line.playing').forEach(x=>x.classList.remove('playing'));
 try{
  let url=storyAudio.get(i);
  if(!url){
   trigger?.setAttribute('aria-busy','true');
   const response=await fetch('/api/ai/speech',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({text:s.zh})});
   if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error??'Chưa đọc được câu này.');
   url=URL.createObjectURL(await response.blob());storyAudio.set(i,url);
  }
  if(run!==storyChain)return;
  document.querySelector('[data-line="'+i+'"]')?.classList.add('playing');
  storyPlayer.src=url;storyPlayer.playbackRate=settings.rate;
  storyPlayer.onended=()=>{document.querySelector('[data-line="'+i+'"]')?.classList.remove('playing');if(chain&&run===storyChain&&i+1<story.sentences.length)void storySay(i+1,null,run)};
  await storyPlayer.play();
 }catch(error){notify(error instanceof TypeError?'Không kết nối được để đọc câu.':error.message)}
 finally{trigger?.removeAttribute('aria-busy')}
}
function storyPage(){
 const head=pageHead('Đọc truyện bằng từ bạn đã biết','AI viết truyện ngắn chỉ dùng những từ bạn đã học, thêm 1–2 từ mới của bài đang học. Chạm vào từ để tra nghĩa, bấm loa để nghe.','',chip('Đọc hiểu vừa sức'));
 if(!viewer.aiAvailable)return head+note('Trợ giảng AI chưa được kết nối nên chưa viết truyện được.','warn');
 const {known,fresh,count}=storyWords();
 if(known.length<8)return head+note('<strong>Bạn đã học '+count+' từ.</strong><span>Học thêm '+(8-known.length)+' từ (một buổi học 10 phút là đủ) để mở khóa truyện đầu tiên.</span>','warn')+'<div class="form-actions">'+button('Học 10 phút','sess-start','bolt','primary')+'</div>';
 if(storyBusy)return head+'<section class="panel story-loading" aria-busy="true"><span class="spinner" aria-hidden="true"></span><p>AI đang viết truyện chỉ bằng <b>'+known.length+' từ</b> bạn đã biết'+(fresh.length?' và '+fresh.length+' từ mới':'')+'…</p></section>';
 if(!story||story.course!==courseId)return head+'<section class="panel story-intro"><div class="iconbox warm hz" aria-hidden="true">读</div><div class="grow"><h2>Bạn đã biết '+known.length+' từ, đủ để đọc một câu chuyện!</h2><p>Truyện 5–7 câu, chỉ dùng từ bạn đã học'+(fresh.length?', thêm '+fresh.map(w=>'<b class="han">'+esc(w.zh)+'</b>').join(', ')+' của bài đang học':'')+'. Đọc xong trả lời 2 câu hỏi để kiểm tra mình hiểu.</p>'+button('Viết truyện cho tôi','story-new','book','primary')+'</div></section>';
 const cover=readable(story.sentences.map(s=>s.zh));
 const freshHtml=(story.fresh??[]).map(z=>{const e=dictionary().get(z);return e?'<span class="rc-word mini"><b class="han">'+esc(z)+'</b><span class="py">'+esc(e.pinyin??'')+'</span>'+hvLine(e)+'<small>'+esc(e.vi??'')+'</small></span>':''}).join('');
 const lines=story.sentences.map((s,i)=>'<li class="story-line'+(storyShow.has(i)?' open':'')+'" data-line="'+i+'"><button type="button" class="iconbtn play" data-action="story-say:'+i+'" aria-label="Nghe câu '+(i+1)+'">'+svg('audio')+'</button><div class="grow"><p class="han story-zh" lang="zh-CN">'+zhText(s.zh)+'</p>'+(storyShow.has(i)?'<p class="py">'+esc(s.pinyin)+'</p><p class="vi">'+esc(s.vi)+'</p>':'')+'</div><button type="button" class="btn small" data-action="story-tr:'+i+'" aria-pressed="'+storyShow.has(i)+'">'+(storyShow.has(i)?'Ẩn':'Dịch')+'</button></li>').join('');
 const qs=(story.questions??[]).map((q,qi)=>{const pick=storyPicks[qi];return '<div class="story-q"><p><b>'+(qi+1)+'.</b> '+esc(q.q)+'</p><div class="cards">'+q.options.map((o,oi)=>'<button type="button" class="option '+(pick===undefined?'':oi===q.answer?'good':oi===pick?'bad':'')+'" data-action="story-q:'+qi+':'+oi+'" '+(pick!==undefined?'disabled':'')+'><span>'+String.fromCharCode(65+oi)+'</span><span>'+esc(o)+'</span></button>').join('')+'</div></div>'}).join('');
 const answered=Object.keys(storyPicks).length,right=Object.entries(storyPicks).filter(([qi,oi])=>story.questions[qi]?.answer===oi).length;
 return head+'<section class="panel story"><div class="row split"><div><h2 class="han" lang="zh-CN">'+esc(story.title||'小故事')+'</h2><p class="muted">'+esc(story.titleVi??'')+'</p></div>'+(cover!==null?'<span class="cover-badge"><b>'+cover+'%</b><small>chữ bạn đã biết</small></span>':'')+'</div>'+
  (freshHtml?'<div class="story-fresh"><small class="muted">Từ mới trong truyện</small><div class="rc-words">'+freshHtml+'</div></div>':'')+
  '<ol class="story-lines">'+lines+'</ol><div class="wrap">'+button('Nghe cả truyện','story-all','audio','primary')+button(storyShow.size===story.sentences.length?'Ẩn bản dịch':'Hiện tất cả bản dịch','story-tr:all','text')+button('Truyện khác','story-new','shuffle')+'</div></section>'+
  (qs?'<section class="panel"><h2>Bạn hiểu truyện chứ?</h2>'+qs+(answered===story.questions.length?note('<strong>'+right+'/'+answered+' câu đúng'+(right===answered?' · Bạn đọc hiểu cả câu chuyện tiếng Trung! 太棒了！':'')+'</strong>',right===answered?'ok':'warn','check'):'')+'</section>':'');
}

// ----- Cài ứng dụng & thông báo nhắc học -----
let installPrompt=null,pushState='unknown';
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(state&&['','#home','#progress'].includes(location.hash))render()});
window.addEventListener('appinstalled',()=>{installPrompt=null;notify('Đã cài FangSchool lên thiết bị.');if(state)render()});
const keyBytes=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));
const sameKey=(a,b)=>Boolean(a&&b)&&a.byteLength===b.byteLength&&new Uint8Array(a).every((v,i)=>v===b[i]);
async function pushKey(){return keyBytes((await (await fetch('/api/push/key')).json()).key)}
// Đăng ký hợp lệ với khoá VAPID hiện tại của máy chủ; đăng ký theo khoá cũ thì huỷ để tạo lại.
async function currentSubscription(reg,key){
 const existing=await reg.pushManager.getSubscription();
 if(existing&&sameKey(existing.options?.applicationServerKey,key))return existing;
 await existing?.unsubscribe();
 return null;
}
async function savePushSubscription(subscription){
 const response=await fetch('/api/push',{method:'PUT',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(subscription.toJSON())});
 if(!response.ok)throw new Error();
}
async function refreshPush(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){pushState='unsupported';return}
 if(Notification.permission==='denied'){pushState='denied';return}
 try{
  const reg=await navigator.serviceWorker.ready,existing=await reg.pushManager.getSubscription();
  if(!existing){pushState='off';return}
  const subscription=await currentSubscription(reg,await pushKey());
  // Gắn lại thiết bị với email đang đăng nhập (máy dùng chung, đổi tài khoản).
  if(subscription){await savePushSubscription(subscription);pushState='on'}else pushState='off';
 }catch{pushState='off'}
}
async function enablePush(){
 try{
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){pushState=permission==='denied'?'denied':'off';notify('Bạn chưa cho phép FangSchool gửi thông báo.');render();return}
  const reg=await navigator.serviceWorker.ready,key=await pushKey();
  const subscription=await currentSubscription(reg,key)??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await savePushSubscription(subscription);
  pushState='on';notify('Đã bật nhắc học trên thiết bị này.');
 }catch{notify('Chưa bật được thông báo trên thiết bị này.')}
 render();
}
async function disablePush(silent=false){
 try{
  const reg=await navigator.serviceWorker.ready,subscription=await reg.pushManager.getSubscription();
  if(subscription){await fetch('/api/push',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})}).catch(()=>{});await subscription.unsubscribe()}
  pushState='off';
 }catch{}
 if(!silent){notify('Đã tắt nhắc học trên thiết bị này.');render()}
}
async function testPush(){
 const response=await fetch('/api/push/test',{method:'POST',headers:{Accept:'application/json'}}).catch(()=>null);
 notify(response?.ok?'Đã gửi thông báo thử. Kiểm tra thanh thông báo của thiết bị.':'Chưa gửi được thông báo thử.');
}
function appCard(full=false){
 if(!emailPrefs&&pushState!=='unsupported')void loadEmailPrefs().then(()=>{if(emailPrefs&&['','#home'].includes(location.hash))render()});
 const canInstall=!standalone()&&(installPrompt||isIOS),hour=emailPrefs?.hour??20;
 const iosNeedsInstall=isIOS&&!standalone();
 const push=pushState==='on'?'<div class="kv"><span>'+svg('check')+' Nhắc học lúc '+hour+':00 trên máy này</span>'+(full?'<span class="wrap">'+button('Gửi thử','push-test')+button('Tắt','push-off')+'</span>':'')+'</div>'
  :pushState==='off'&&!iosNeedsInstall?'<div class="kv"><span>Nhận thông báo nhắc học lúc '+hour+':00 khi bạn chưa học</span>'+button('Bật nhắc học','push-on','bolt','primary')+'</div>'
  :pushState==='denied'&&full?'<p class="muted">Trình duyệt đang chặn thông báo của FangSchool. Mở cài đặt trang để cho phép lại.</p>':'';
 const install=canInstall?(installPrompt?'<div class="kv"><span>Cài FangSchool lên màn hình chính, mở là vào học ngay</span>'+button('Cài ứng dụng','install','arrow','primary')+'</div>'
  :'<p class="ios-hint">Trên iPhone/iPad: bấm <b>Chia sẻ</b> '+svg('arrow')+' <b>Thêm vào Màn hình chính</b> để cài FangSchool'+(pushState!=='unsupported'?' và bật thông báo nhắc học':'')+'.</p>'):'';
 if(!push&&!install)return '';
 if(!full&&pushState==='on'&&!install)return '';
 return '<section class="panel app-card"><h3>'+(full?'Ứng dụng & thông báo':'Học đều mỗi ngày')+'</h3><div class="form-actions">'+install+push+'</div></section>';
}

// ----- Trang chủ: một nút học, tiến bộ và lộ trình -----
function greeting(){const h=new Date().getHours();return h<11?'Chào buổi sáng':h<14?'Chào buổi trưa':h<18?'Chào buổi chiều':'Chào buổi tối'}
function lastReceiptLine(){
 const r=storage('receipt',null);
 if(!r?.at)return '';
 const when=dayKey(r.at)===dayKey()?'Hôm nay':dayKey(r.at)===dayKey(Date.now()-DAY_MS)?'Hôm qua':fmtDate(r.at);
 const bits=[r.learned?'+'+r.learned+' từ mới':'',r.graded?r.correct+'/'+r.graded+' câu đúng':'',r.fixed?r.fixed+' câu sai đã sửa':'',r.predicted?'dự đoán '+(r.predicted>0?'+':'')+r.predicted+' điểm':''].filter(Boolean);
 return bits.length?'<p class="last-receipt">'+svg('check')+'<span><b>'+when+'</b> bạn đã học '+r.minutes+' phút: '+esc(bits.join(' · '))+'</span></p>':'';
}
function home(){
 const resume=quiz&&!quiz.done&&quiz.session;
 const plan=sessionPlan(),c=plan.counts,total=plan.ids.length;
 const parts=[[c.cards,'thẻ cần ôn','忆'],[c.fresh,'từ mới','新'],[c.wrong,'câu sai cần sửa','改'],[c.practice,'câu luyện','练'],[c.say,'từ luyện thanh điệu','说']].filter(([n])=>n)
  .map(([n,t,g])=>'<span class="plan-chip"><i class="han" aria-hidden="true">'+g+'</i><b>'+n+'</b> '+t+'</span>').join('');
 const minutes=todayMinutes(state),goal=ensureStudy(state).goal,days=streak(state);
 const hero='<section class="hero home-hero"><div><span class="eyebrow">'+esc(greeting().toUpperCase())+' · '+esc(courseName)+'</span>'+
  '<h1>'+(resume?'Tiếp tục buổi học nhé':total?'Hôm nay học '+plan.minutes+' phút nhé':'Bạn đã ôn xong hôm nay!')+'</h1>'+
  '<p>'+(resume?'Bạn đang ở câu '+(quiz.index+1)+'/'+quiz.ids.length+' của buổi học.':total?'FangSchool đã xếp sẵn buổi học theo đúng những gì bạn sắp quên và bài đang học. Không cần chọn gì, cứ bấm học.':'Thẻ đến hạn và câu sai đều xong. Đọc truyện, luyện nói hoặc học thêm 3 phút để tiến xa hơn.')+'</p>'+
  (total&&!resume?'<div class="plan-chips">'+parts+'</div>':'')+
  '<div class="wrap">'+(resume?button('Tiếp tục học','go:quiz','arrow','primary big'):button(total?'Bắt đầu học '+plan.minutes+' phút':'Học thêm 3 phút',total?'sess-start':'sess-start:mini','bolt','primary big'))+
  (total>6&&!resume?button('Chỉ có 3 phút','sess-start:mini','','secondary'):'')+'</div>'+lastReceiptLine()+'</div>'+
  '<div class="hero-art" aria-hidden="true"><i class="orbit"></i><i class="orbit two"></i><div class="tile back">习</div><div class="tile front">学</div><span class="spark">✦</span><span class="spark bottom">✦</span></div></section>';
 const week=lastWeek(state).map(d=>'<i class="'+d.state+(d.today?' today':'')+'" title="'+esc(d.label+' · '+d.minutes+' phút')+'"></i>').join('');
 const p=isWorkplace?null:predictScore(state,{course,getQuestion,lessonSkill}),lastCheck=isWorkplace||!examPass(course)?null:ensureStudy(state).plan.checks.at(-1);
 const strip='<div class="home-strip">'+
  '<div class="stat"><div class="iconbox hz warm" aria-hidden="true">🔥</div><div><strong>'+dayWord(days)+'</strong><small>Chuỗi học · hôm nay '+minutes+'/'+goal+' phút</small><span class="mini-week" aria-label="7 ngày gần nhất">'+week+'</span></div></div>'+
  '<div class="stat"><div class="iconbox hz" aria-hidden="true">词</div><div><strong>'+knownWords()+'</strong><small>Từ đã nhớ chắc</small></div></div>'+
  (lastCheck?'<div class="stat"><div class="iconbox hz blue" aria-hidden="true">分</div><div><strong>'+lastCheck.total+'<small>/'+lastCheck.max+'</small></strong><small>Kiểm tra gần nhất · đạt từ '+examPass(course).pass+'</small></div></div>'
   :p?.total!=null&&p.evidence>=40?'<div class="stat"><div class="iconbox hz blue" aria-hidden="true">分</div><div><strong>'+p.total+'<small>/'+p.max+'</small></strong><small>Dự đoán từ bài luyện · đạt từ '+p.pass+'</small></div></div>'
   :'<div class="stat"><div class="iconbox hz blue" aria-hidden="true">书</div><div><strong>'+masteredLessons()+'/'+lessonCount()+'</strong><small>Bài đã nắm vững</small></div></div>')+'</div>';
 const cur=currentLesson(),tried=attemptedSet();
 let cont='';
 if(cur){
  const s=lessonStatus(cur,tried),open=lessonMastery(cur,tried).find(step=>!step.done),read=readable(lessonTexts(cur));
  cont='<section class="panel cont-card"><div class="row split"><h3>Bài đang học</h3><span class="badge" data-k="'+s.k+'">'+esc(s.label)+'</span></div>'+
   '<button type="button" class="lcard flat" data-action="go:lesson/'+cur.n+(open?'/'+lessonTabs[open.key]:'')+'"><span class="lnum'+(s.done===s.total?' done':'')+'">'+lessonNum(cur)+'</span><div class="grow"><strong class="han" lang="zh-CN">'+esc(cur.zh)+'</strong><small class="muted">'+esc(cur.vi)+'</small><div class="steps" aria-label="'+s.done+' trên '+s.total+' mục đã đạt">'+s.steps.map(on=>'<i class="'+(on?'on':'')+'"></i>').join('')+'</div></div>'+svg('chev','chevron')+'</button>'+
   (read!==null?'<div class="read-meter"><div class="row split"><small>Bạn đọc hiểu được</small><b>'+read+'% chữ trong hội thoại</b></div>'+barHtml(read,'thin')+'</div>':'')+
   (open?'<p class="muted">Tiếp theo: '+esc(open.title)+(open.need?' · '+esc(open.need):'')+'</p>':'')+'</section>';
 }
 const hv=hvWords(),hvSample=[...hv.filter(w=>wstatus(w.id)==='new'),...hv].slice(0,6);
 const teaser=hv.length>=5?'<section class="panel hv-teaser"><div class="row split"><h3>Lợi thế của người Việt</h3><span class="badge" data-k="ok">'+hv.length+' từ</span></div><p><b>'+hv.length+' từ</b> trong '+esc(courseName)+' đọc theo âm Hán Việt gần giống tiếng Việt, gặp là nhớ.</p>'+
  '<div class="hv-chips">'+hvSample.map(w=>'<span><b class="han" lang="zh-CN">'+esc(w.zh)+'</b>'+esc(hanViet(w.zh,w.pinyin))+'</span>').join('')+'</div>'+button('Ôn nhanh các từ này','hv-drill','shuffle')+'</section>':'';
 const storyCard=viewer.aiAvailable?'<section class="panel story-card"><div class="iconbox warm hz" aria-hidden="true">读</div><h3>Đọc truyện bằng từ bạn biết</h3><p>AI viết truyện ngắn chỉ dùng những từ bạn đã học. Đọc hiểu cả đoạn tiếng Trung!</p>'+button('Đọc truyện','go:story','arrow','primary')+'</section>':'';
 const wrong=wrongQuestions().length,unknown=dueWords().length;
 const more='<section class="panel"><h3>Luyện thêm</h3><div class="form-actions">'+
  '<button type="button" class="kv" data-action="go:bank"><span>'+svg('target')+' Ngân hàng luyện tập theo cấp</span>'+svg('chev')+'</button>'+
  (catalog.examCatalog?'<button type="button" class="kv" data-action="go:exams"><span>'+svg('text')+' Đề ôn thi</span>'+svg('chev')+'</button>':'')+
  (cur&&cur.n<100?'<button type="button" class="kv" data-action="go:lesson/'+cur.n+'/speak"><span>'+svg('head')+' Luyện nói & thanh điệu</span>'+svg('chev')+'</button>':'')+
  '<button type="button" class="kv" data-action="rtab:words"><span>'+svg('bookmark')+' Từ chưa thuộc</span><strong>'+unknown+'</strong></button>'+
  '<button type="button" class="kv" data-action="rtab:wrong"><span>'+svg('target')+' Câu sai</span><strong style="color:var(--bad)">'+wrong+'</strong></button></div></section>';
 return hero+strip+grantNotes()+'<div class="main-split"><section class="main home-main">'+journeyCard()+cont+teaser+'</section><aside class="side-col">'+storyCard+appCard()+more+'</aside></div>'+editionNote();
}
function todayPage(){
 const resume=quiz&&!quiz.done&&quiz.session;
 if(resume)return home();
 const plan=sessionPlan(),c=plan.counts;
 const steps=[[c.cards,'Ôn thẻ đến hạn','Lật thẻ, tự chấm: quên gặp lại ngày mai, nhớ rõ giãn lịch ôn.'],[c.fresh,'Học từ mới','Có âm Hán Việt, ví dụ và giọng đọc. Kiểm tra lại ngay trong buổi.'],
  [c.wrong,'Sửa câu sai đến hạn','Đúng ở 2 ngày khác nhau thì câu rời khỏi danh sách.'],[c.practice,'Luyện bài đang học','Câu chấm ngay, đọc đáp án đúng sau mỗi câu.'],[c.say,'Luyện thanh điệu','Ghi âm, so đường thanh với giọng mẫu.']].filter(([n])=>n);
 return pageHead('Buổi học hôm nay',steps.length?'Khoảng '+plan.minutes+' phút, chạy liền một mạch, không cần chọn gì.':'Hôm nay bạn đã ôn xong.','',chip(plan.ids.length+' mục'))+
  '<ol class="today-steps form-actions">'+steps.map(([n,title,detail],i)=>'<li class="today-step"><span class="today-num" aria-hidden="true">'+(i+1)+'</span><div class="grow"><div class="row split"><h3>'+esc(title)+'</h3><small class="muted">'+n+' mục</small></div><p>'+esc(detail)+'</p></div></li>').join('')+'</ol>'+
  '<div class="wrap form-actions">'+(steps.length?button('Bắt đầu học '+plan.minutes+' phút','sess-start','bolt','primary big'):button('Học thêm 3 phút','sess-start:mini','bolt','primary big'))+(viewer.aiAvailable?button('Đọc truyện','go:story','book'):'')+'</div>';
}

// ----- Cần ôn lại -----
function review(){
 const wrong=wrongQuestions(),marked=questions.filter(q=>state.marks[q.id]),words=dueWords();
 const lastAttempt=new Map(state.attempts.map(a=>[a.id,a]));
 const total=wrong.length+marked.length+words.length;
 const tabs=[['words','Từ chưa thuộc · '+words.length],['wrong','Câu sai · '+wrong.length+(dueWrongQuestions().length?' ('+dueWrongQuestions().length+' đến hạn)':'')],['marked','Đã đánh dấu · '+marked.length]];
 // Trạng thái lịch ôn của câu sai: đến hạn hay hẹn ngày nào, đã đúng mấy ngày.
 const schedule=q=>{
  const card=questionCard(state,q.id);
  if(!card||questionDue(card))return '<span class="badge" data-k="warn">Đến hạn ôn</span>';
  return '<span class="badge" data-k="muted">Ôn lại '+esc(fmtDate(card.due))+'</span>'+((card.hits??0)?'<span class="badge" data-k="ok">Đã đúng '+card.hits+'/'+QUESTION_CLEAR+' ngày</span>':'');
 };
 const dueWrong=dueWrongQuestions();
 const qcard=(q,action,label)=>{const a=lastAttempt.get(q.id);return '<article class="panel wrong-card"><div class="grow"><div class="chips">'+chip(locationLabel(q))+'<span class="badge" data-k="muted">'+esc(q.origin==='bank'?bankGroups[q.group]:kinds[q.kind])+'</span>'+(action?'':schedule(q))+'</div><span class="stem lines">'+esc(q.prompt.replace(/\n/g,' ').slice(0,180))+'</span>'+(a?'<span>Bạn trả lời: <span class="han">'+esc(a.value||'—')+'</span> · Đáp án: <span class="han">'+esc(q.reference??q.answers?.[0]??'—')+'</span></span><small class="muted">'+esc(fmtDateTime(a.at))+'</small>':'')+'</div><div class="wrap">'+button('Làm lại câu này','one:'+q.id,'arrow')+(action?button(label,action):'')+'</div></article>'};
 let body;
 if(reviewTab==='words')body=words.length?'<div class="row split form-actions"><p>'+words.length+' từ đang trong lịch ôn (chưa nhớ rõ). Bấm “Đã thuộc” khi đã nhớ, từ sẽ được hẹn ôn lại sau 7 ngày.</p>'+button('Luyện các từ này','review-words','arrow','primary')+'</div><div class="word-cards form-actions">'+words.map(w=>'<div class="panel word-card"><strong class="zh han" lang="zh-CN">'+esc(w.zh)+'</strong><div class="grow"><span>'+esc(w.pinyin)+'</span><small class="muted">'+esc(w.vi)+' · '+esc(lessonLabel(w.n))+'</small></div><div class="cards" style="gap:6px">'+button('Đã thuộc','word:known:'+w.id,'check')+button('Mở thẻ','word-link:'+w.n+':'+w.i)+'</div></div>').join('')+'</div>':note('Không còn từ chưa thuộc. Tuyệt vời!','ok','check');
 else if(reviewTab==='wrong'){
  const order=[...wrong].sort((a,b)=>(questionCard(state,a.id)?.due??0)-(questionCard(state,b.id)?.due??0));
  body=wrong.length?note('<span><strong>Câu sai quay lại theo lịch:</strong> ngày mai, rồi 3 ngày sau. Làm đúng ở '+QUESTION_CLEAR+' ngày khác nhau thì câu được xem là đã vững và rời danh sách. Làm đúng lại ngay trong ngày chưa được tính.</span>','','target')+
   '<div class="row split form-actions"><p>'+dueWrong.length+' câu đến hạn hôm nay · '+wrong.length+' câu đang trong lịch ôn.</p><div class="wrap">'+(dueWrong.length?button('Ôn câu đến hạn · '+dueWrong.length,'review-due','arrow','primary'):'')+button('Luyện tất cả câu sai','review-wrong','shuffle',dueWrong.length?'':'primary')+'</div></div><div class="cards form-actions">'+order.map(q=>qcard(q)).join('')+'</div>':note('Không còn câu sai nào trong lịch ôn. Tuyệt vời!','ok','check');
 }
 else body=marked.length?'<div class="row split form-actions"><p>'+marked.length+' câu bạn đã đánh dấu.</p>'+button('Luyện câu đã đánh dấu','review-marked','arrow','primary')+'</div><div class="cards form-actions">'+marked.map(q=>qcard(q,'mark:'+q.id,'Bỏ đánh dấu')).join('')+'</div>':note('Chưa có câu nào được đánh dấu. Dùng nút “Đánh dấu để ôn” khi làm bài.');
 return pageHead(tr('Cần ôn lại · ','Review list · ','待复习 · ')+courseName,'Từ đang ôn và câu sai theo lịch ôn ngắt quãng, lưu riêng theo khóa.',total?button('Ôn tất cả · '+total+' mục','review-all','arrow','primary'):'')+seg(tabs.map(([k,t])=>['rtab:'+k,t,reviewTab===k]),'Loại nội dung')+body;
}

// ----- Tiến độ -----
function progress(){
 const g=graded(),correct=g.filter(a=>a.grade).length,wrongCount=g.length-correct,self=state.attempts.length-g.length;
 const viewedCount=Object.keys(state.views?.questions??{}).length;
 const completed=masteredLessons();
 const stat=(icon,cls,value,label)=>'<div class="stat"><div class="iconbox hz '+cls+'">'+icon+'</div><div><strong>'+esc(value)+'</strong><small>'+esc(label)+'</small></div></div>';
 const stats='<div class="grid4 stats">'+stat('书','',completed+'/'+lessonCount(),tr('Bài hoàn thành','Lessons completed','已完成课程'))+
  stat('练','warm',state.attempts.length.toLocaleString('vi-VN'),'Lượt trả lời · '+viewedCount.toLocaleString('vi-VN')+' câu đã xem')+
  stat('%','blue',g.length?pct(correct,g.length)+'%':'—','Tỷ lệ đúng (câu chấm tự động)')+
  stat('✓','violet',knownWords().toLocaleString('vi-VN'),tr('Từ đã thuộc','Words learned','已掌握词汇'))+'</div>';

 const tried=attemptedSet();
 const rows=lessons.map(l=>{
  const s=lessonStatus(l,tried),open=lessonMastery(l,tried).filter(step=>!step.done).map(step=>step.title);
  return '<button type="button" class="progress-row" data-action="go:lesson/'+l.n+'"><span class="row split"><span><strong>'+esc(lessonLabel(l.n))+'</strong> · <span class="han" lang="zh-CN">'+esc(l.zh)+'</span></span><span class="row"><small class="muted">'+s.done+'/'+s.total+' mục đạt</small><span class="badge" data-k="'+s.k+'">'+esc(s.label)+'</span></span></span>'+barHtml(pct(s.done,s.total),'thin')+
   (s.done&&open.length?'<small class="muted">Còn: '+esc(open.join(', '))+'</small>':'')+'</button>';
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
  '<div class="today-grid">'+goalCard()+journeyCard()+predictionPanel()+'</div><div class="section">'+rhythmPanel()+'</div>'+
  '<div class="main-split"><section class="panel main progress-list" aria-labelledby="pb-h"><h2 id="pb-h">Tiến độ theo bài</h2><div>'+rows+'</div></section><aside class="side-col">'+
  '<section class="panel"><h3>Kết quả câu hỏi</h3><p>'+correct.toLocaleString('vi-VN')+' đúng · '+wrongCount.toLocaleString('vi-VN')+' sai · '+self.toLocaleString('vi-VN')+' tự đối chiếu (không tính điểm)</p><div class="splitbar" role="img" aria-label="'+pct(correct,sum)+'% đúng, '+pct(wrongCount,sum)+'% sai, '+pct(self,sum)+'% tự đối chiếu"><i style="width:'+pct(correct,sum)+'%;background:var(--green-btn)"></i><i style="width:'+pct(wrongCount,sum)+'%;background:var(--bad)"></i><i style="width:'+pct(self,sum)+'%;background:#d9a441"></i></div>'+
  '<h4 class="form-actions">Ngữ pháp cần ôn</h4>'+grammar+'</section>'+
  '<section class="panel"><h3>Lịch sử kiểm tra &amp; đề</h3><div class="form-actions">'+(history||'<p>Chưa có bài kiểm tra hoặc đề nào.</p>')+'</div>'+(catalog.examCatalog?'<div class="form-actions">'+button('Tất cả đề ôn thi','go:exams','text')+'</div>':'')+'</section>'+
  appCard(true)+emailPrefsCard()+'<section class="panel"><h3>Quyền học của bạn</h3><div class="form-actions">'+(grants||'<p>Không có thông tin quyền.</p>')+'</div></section></aside></div>';
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
 return questions.filter(q=>(q.origin==='bank'?origin==='bank'||!origin&&f.has('include-level'):ns.includes(q.lesson))&&skills.includes(q.kind)&&(!level||q.level===level)&&(!origin||(origin==='extra'?['extra','guided','curriculum','auto'].includes(q.origin):origin==='bank'?q.origin==='bank':['original','practice'].includes(q.origin)))&&!q.resource&&(mode!=='wrong'||wrong.has(q.id))&&(mode!=='words'||state.words[q.word]==='unknown')&&(mode!=='scored'||q.answers?.length)&&(!q.audio||lessonSkill(q)!=='listen'||canPlay(q.audio,q.pinyin)));
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
const originBadge=q=>({teacher:['Giáo viên','ok'],original:['Bài tập gốc','muted'],practice:['Câu luyện theo bài','muted'],bank:['Theo cấp HSK','warn'],guided:['Tình huống','muted'],curriculum:['Ngữ pháp','muted'],extra:['Mở rộng','muted']}[q.origin]??[q.origin??'—','muted']);
// Câu hỏi giáo viên trên máy chủ: null = chưa tải.
let teacherServer=null,teacherSyncedAt=0,teacherLoading=false;
async function loadTeacherServer(){
 if(teacherLoading)return;
 teacherLoading=true;
 try{
  const response=await fetch('/api/teacher-questions/'+courseId);
  if(!response.ok)throw new Error();
  teacherServer=(await response.json()).questions??[];
  teacherSyncedAt=Date.now();
 }catch{teacherServer=teacherServer??[];notify('Chưa tải được câu hỏi trên máy chủ.')}
 finally{teacherLoading=false;if(location.hash.startsWith('#teacher'))render()}
}
const serverEntry=id=>teacherServer?.find(x=>x.id===id);
const teacherDrafts=()=>(teacherServer??[]).filter(x=>x.status==='draft'&&!getQuestion(x.id)).map(x=>({...x.question,id:x.id,lesson:x.lesson,origin:'teacher'}));
const teacherQuestion=id=>teacherDrafts().find(q=>q.id===id)??getQuestion(id);
function teacherRows(){
 const term=searchText(teacherFilter.q);
 return [...teacherDrafts(),...questions].filter(q=>(teacherFilter.lesson===''||(teacherFilter.lesson==='bank'?q.origin==='bank':q.lesson===+teacherFilter.lesson))&&(teacherFilter.kind===''||q.kind===+teacherFilter.kind)&&(!term||searchText((q.prompt??'')+' '+(q.zh??'')+' '+(q.id??'')).includes(term)));
}
const rowBadge=q=>{const e=serverEntry(q.id);return e?(e.status==='live'?['Đã xuất bản','ok']:['Nháp','warn']):originBadge(q)};
function questionEditor(){
 const q=teacherPick==='new'?{id:'',kind:0,level:'Trung bình',prompt:'',lesson:teacherLesson,options:['','','',''],answers:[]}:teacherQuestion(teacherPick);
 if(!q)return '<section class="panel cards"><h2>Biên tập câu hỏi</h2><p>Chọn một câu trong danh sách để xem và sửa, hoặc bấm “+ Thêm câu hỏi”.</p>'+note('<span>Câu lưu trên máy chủ. “Nháp” chỉ giáo viên thấy; “Xuất bản” hiện ngay cho học viên '+esc(courseName)+' trên mọi thiết bị.</span>')+'</section>';
 const readonly=q.origin==='bank',entry=serverEntry(q.id),status=entry?.status??'draft';
 const mc=Boolean(q.options?.length)||teacherPick==='new';
 const opts=[...(q.options??[]),'','','',''].slice(0,Math.max(4,q.options?.length??0));
 const voices=q.zh?Object.entries(flashcardReaders).map(([id,label])=>'<span class="badge" data-k="'+(readerSource(voiceKey(q.zh,q.pinyin),id)?'ok':'muted')+'">'+esc(label)+(readerSource(voiceKey(q.zh,q.pinyin),id)?'':' · chưa có')+'</span>').join(''):'<small class="muted">Câu không có chữ Hán để đọc.</small>';
 const dis=readonly?' disabled':'';
 const actions={create:'Tạo câu hỏi',save:'Lưu thay đổi',restore:'Khôi phục phiên bản cũ',delete:'Xóa câu hỏi'};
 const history=(entry?.history??[]).map((h,i)=>'<div class="kv"><div class="grow"><strong>'+esc(actions[h.action]??h.action)+' · '+(h.status==='live'?'xuất bản':h.status==='draft'?'nháp':'đã xóa')+'</strong><small class="muted">'+esc(h.actor)+' · '+esc(fmtDateTime(h.at))+'</small></div>'+(i?button('Khôi phục','tq-restore:'+h.id):'<span class="badge" data-k="muted">Hiện tại</span>')+'</div>').join('');
 const preview='<div class="teacher-preview"><div class="chips">'+chip(esc(kinds[q.kind]??''))+(entry?.status==='live'?'':chip('Nháp · học viên chưa thấy','warm'))+'</div><strong>'+esc(q.prompt||'Yêu cầu của câu hỏi')+'</strong>'+(q.zh?'<span class="han preview-zh" lang="zh-CN">'+esc(q.zh)+'</span>':'')+(q.options?.length?'<div class="opt-grid">'+q.options.map((o,i)=>'<div class="option"><span>'+String.fromCharCode(65+i)+'</span><span class="han">'+esc(o)+'</span></div>').join('')+'</div>':'')+'</div>';
 return '<div class="cards"><form id="q-form" class="panel cards" data-id="'+esc(q.id??'')+'"><div class="row split"><h2>'+(teacherPick==='new'?'Thêm câu hỏi':'Sửa câu hỏi')+'</h2><small class="muted">'+esc(q.id||'Mã mới tự tạo')+'</small></div>'+
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
  (readonly?'':'<div class="cards" style="gap:6px"><span class="lbl" id="pub-l">Hiển thị</span><div class="radio-seg" role="radiogroup" aria-labelledby="pub-l"><label><input type="radio" name="status" value="draft" '+(status!=='live'?'checked':'')+'>Nháp</label><label><input type="radio" name="status" value="live" '+(status==='live'?'checked':'')+'>Xuất bản cho học viên</label></div></div>')+
  '<small class="muted">Nguồn: '+esc(entry?'Giáo viên · sửa bởi '+entry.updatedBy:originBadge(q)[0])+(q.slide?' · slide '+q.slide:'')+(q.lesson?' · '+lessonLabel(q.lesson):'')+'</small>'+
  (readonly?'':'<div class="wrap"><button class="btn primary">Lưu lên máy chủ</button>'+(entry?button('Xóa câu','tq-delete','','danger'):'')+(q.lesson?'<a class="btn" href="#lesson/'+q.lesson+'">Xem trong bài học →</a>':'')+'</div>')+'</form>'+
  '<section class="panel cards"><h3 style="margin:0">Học viên sẽ thấy</h3>'+preview+'</section>'+
  (history?'<section class="panel"><h3 style="margin:0 0 6px">Lịch sử sửa</h3>'+history+'</section>':'')+'</div>';
}
async function putTeacherQuestion(body){
 const response=await fetch('/api/teacher-questions/'+courseId,{method:'PUT',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||'Máy chủ chưa lưu được câu hỏi.');
 return result;
}
async function afterTeacherSave(id,message){
 await Promise.all([loadTeacherServer(),loadLiveTeacherQuestions()]);
 refreshData();teacherPick=id??teacherPick;render();notify(message);
}
async function saveTeacherQuestion(formEl){
 const f=new FormData(formEl),l=getLesson(f.get('lesson'));
 const optionValues=f.getAll('option').map(v=>String(v).trim()),correct=f.get('correct');
 const options=optionValues.filter(Boolean);
 const q={kind:+f.get('kind'),level:String(f.get('level')),prompt:String(f.get('prompt')).trim()};
 for(const key of ['zh','pinyin','vi','explanation']){const v=String(f.get(key)??'').trim();if(v)q[key]=v}
 if(f.has('option')&&options.length){
  const answer=correct!==null?optionValues[+correct]:'';
  if(!answer){notify('Chọn phương án đúng.');return}
  q.options=options;q.answers=[answer];
 }else q.answers=String(f.get('answers')??'').split('\n').map(v=>v.trim()).filter(Boolean);
 const id=formEl.dataset.id||null,original=id&&getQuestion(id);
 if(original?.slide)q.slide=original.slide;
 if(original?.audio)q.audio=original.audio;
 if(original&&original.origin!=='teacher'&&original.lesson!==l.n){notify('Câu có sẵn không chuyển được sang bài khác. Hãy thêm câu mới.');return}
 const status=f.get('status')==='live'?'live':'draft';
 try{
  const result=await putTeacherQuestion({id,lesson:l.n,status,question:q});
  await afterTeacherSave(result.id,status==='live'?'Đã lưu và xuất bản. Học viên '+courseName+' thấy câu này ở lần mở bài tiếp theo.':'Đã lưu bản nháp lên máy chủ.');
 }catch(err){notify(err.message)}
}
async function importLocalEdits(){
 const items=Object.entries(edits).flatMap(([n,o])=>(o.questions??[]).map(q=>({lesson:+n,q})));
 let ok=0;
 for(const {lesson,q} of items){
  const {id,origin,lesson:_,...question}=q;
  try{await putTeacherQuestion({id:/^[a-z0-9-]{1,100}$/i.test(id??'')?id:null,lesson,status:'live',question});ok++}catch{}
 }
 if(ok===items.length&&persist('content',{}))for(const key of Object.keys(edits))delete edits[key];
 await afterTeacherSave(null,'Đã chuyển '+ok+'/'+items.length+' câu từ trình duyệt lên máy chủ.');
}

// ===== Báo lỗi nội dung: học viên gửi, quản trị viên xem trong tab "Báo lỗi" =====
let reportList=null,reportOpen=0,reportFilter='open';
async function loadReports(){
 try{
  const response=await fetch('/api/admin/reports?status='+reportFilter,{headers:{Accept:'application/json'}});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error??'Chưa tải được báo lỗi.');
  reportList=body.reports;reportOpen=body.open;
 }catch(error){reportList=[];notify(error.message)}
 if(location.hash==='#teacher')render();
}
const reportReasons=[['answer','Sai đáp án'],['pinyin','Sai pinyin'],['translation','Sai bản dịch'],['text','Sai chữ / chính tả'],['audio','Lỗi âm thanh'],['other','Lỗi khác']];
// Hộp thoại báo lỗi dùng chung. target = {kind, ref, context, title}.
function openReport(target){
 let dialog=$('report-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='report-dialog';dialog.className='report-dialog';
  document.body.append(dialog);
  dialog.addEventListener('submit',async event=>{
   event.preventDefault();
   if(event.submitter?.value==='cancel'){dialog.close();return}
   const form=event.target,send=form.querySelector('[type=submit][value=send]');
   send.disabled=true;
   try{
    const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({
     level:courseId,kind:dialog.dataset.kind,ref:dialog.dataset.ref,reason:form.reason.value,note:form.note.value.trim(),context:dialog.dataset.context})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error??body.message??'Chưa gửi được báo lỗi.');
    dialog.close();notify('Cảm ơn bạn! Báo lỗi đã được gửi tới giáo viên.');
   }catch(error){notify(error instanceof TypeError?'Không kết nối được. Vui lòng thử lại.':error.message)}
   finally{send.disabled=false}
  });
 }
 Object.assign(dialog.dataset,{kind:target.kind,ref:target.ref,context:String(target.context??'').slice(0,3000)});
 dialog.innerHTML='<form method="dialog" class="cards"><h2>Báo lỗi nội dung</h2><p class="muted">'+esc(target.title??'')+'</p>'+
  '<fieldset class="report-reasons"><legend>Lỗi gì?</legend>'+reportReasons.map(([k,t],i)=>'<label class="check"><input type="radio" name="reason" value="'+k+'" '+(k===(target.reason??'answer')||!target.reason&&i===0?'checked':'')+'>'+t+'</label>').join('')+'</fieldset>'+
  '<label class="lbl" for="report-note">Mô tả thêm (không bắt buộc)</label><textarea id="report-note" name="note" rows="3" maxlength="500" placeholder="VD: đáp án đúng phải là 您好"></textarea>'+
  '<div class="wrap" style="justify-content:flex-end"><button class="btn" type="submit" value="cancel" formnovalidate>Hủy</button><button class="btn primary" type="submit" value="send">Gửi báo lỗi</button></div></form>';
 dialog.showModal();
 dialog.querySelector('textarea')?.focus();
}
function teacher(){
 if(teacherServer===null)void loadTeacherServer();
 if(teacherTab==='reports'&&reportList===null)void loadReports();
 const tabs=[['bank','Câu hỏi'],['reports','Báo lỗi'+(reportOpen?' · '+reportOpen:'')],['share','Lượt ôn chia sẻ'],['json','Nhập JSON']];
 const localCount=Object.values(edits).reduce((n,o)=>n+(o.questions?.length??0),0);
 const sync='<span class="sync-chip" role="status">'+svg('check')+(teacherServer===null?'Đang tải từ máy chủ…':'Đã đồng bộ máy chủ · '+new Date(teacherSyncedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}))+'</span>';
 const importNote=localCount?'<div class="form-actions">'+note('<span><strong>'+localCount+' câu đang lưu trên trình duyệt này</strong> (cách lưu cũ, học viên không thấy).</span>'+button('Chuyển lên máy chủ và xuất bản','tq-import','arrow','primary'),'warn')+'</div>':'';
 let body='';
 if(teacherTab==='bank'){
  const rows=teacherRows(),size=25,last=Math.max(0,Math.ceil(rows.length/size)-1);
  teacherPage=Math.min(teacherPage,last);
  body='<div class="two-col"><section class="panel cards" aria-label="Danh sách câu hỏi"><div class="toolbar">'+
   '<label>Bài<select id="t-lesson"><option value="">Tất cả</option>'+lessons.map(l=>'<option value="'+l.n+'" '+(teacherFilter.lesson===String(l.n)?'selected':'')+'>'+esc(lessonLabel(l.n))+'</option>').join('')+'<option value="bank" '+(teacherFilter.lesson==='bank'?'selected':'')+'>Theo cấp HSK</option></select></label>'+
   '<label>Kỹ năng<select id="t-kind"><option value="">Tất cả</option>'+kinds.map((k,i)=>'<option value="'+i+'" '+(teacherFilter.kind===String(i)?'selected':'')+'>'+esc(k)+'</option>').join('')+'</select></label>'+
   '<label>Tìm<input id="t-search" type="search" placeholder="Nội dung hoặc mã…" value="'+esc(teacherFilter.q)+'"></label>'+button('+ Thêm câu hỏi','tq-new','','primary')+'</div>'+
   '<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Nội dung</th><th scope="col">Bài</th><th scope="col">Dạng</th><th scope="col">Nguồn</th></tr></thead><tbody>'+
   rows.slice(teacherPage*size,(teacherPage+1)*size).map(q=>{const [src,k]=rowBadge(q);return '<tr class="'+(q.id===teacherPick?'current':'')+'"><td><button type="button" class="source-pick" data-action="tq:'+esc(q.id)+'" aria-pressed="'+(q.id===teacherPick)+'"><strong>'+esc(q.prompt.replace(/\n/g,' ').slice(0,90))+'</strong><small class="muted han">'+esc(q.zh??'')+' · '+esc(q.level??'')+'</small></button></td><td>'+esc(q.origin==='bank'?'Cấp HSK':lessonLabel(q.lesson))+'</td><td><span class="chip">'+esc(kinds[q.kind]??'—')+'</span></td><td><span class="badge" data-k="'+k+'">'+src+'</span></td></tr>'}).join('')+
   '</tbody></table></div><div class="row split"><small class="muted">'+rows.length+' câu'+(last?' · trang '+(teacherPage+1)+'/'+(last+1):'')+'</small><div class="wrap">'+(teacherPage?button('‹ Trước','tpage:-1'):'')+(teacherPage<last?button('Sau ›','tpage:1'):'')+'</div></div></section>'+questionEditor()+'</div>';
 }else if(teacherTab==='reports'){
  const kindName={question:'Câu hỏi',dialogue:'Hội thoại',word:'Từ vựng',ai:'Nội dung AI'};
  const rows=(reportList??[]).map(r=>'<article class="panel report-card"><div class="row split"><div class="chips">'+chip(esc(kindName[r.kind]??r.kind))+chip(esc(r.reason))+'<span class="badge" data-k="muted">'+esc(r.ref)+'</span></div><small class="muted">'+esc(fmtDateTime(r.createdAt))+'</small></div>'+
   (r.note?'<p><strong>'+esc(r.note)+'</strong></p>':'')+(r.context?'<pre class="report-context han">'+esc(r.context)+'</pre>':'')+
   '<div class="row split"><small class="muted">'+esc(r.email)+'</small><div class="wrap">'+(r.kind==='question'&&getQuestion(r.ref)?button('Mở câu này','tq:'+r.ref,'text'):'')+
   button(r.status==='open'?'Đã xử lý':'Mở lại','report-status:'+r.id+':'+(r.status==='open'?'resolved':'open'),r.status==='open'?'check':'',r.status==='open'?'primary':'')+'</div></div></article>').join('');
  body='<div class="row split form-actions"><p>Học viên báo lỗi đáp án, pinyin, bản dịch… Sửa nội dung rồi đánh dấu “Đã xử lý”.</p>'+seg([['report-filter:open','Đang mở',reportFilter==='open'],['report-filter:resolved','Đã xử lý',reportFilter==='resolved']],'Lọc báo lỗi','group')+'</div>'+
   (reportList===null?'<p>Đang tải…</p>':rows?'<div class="cards form-actions">'+rows+'</div>':note(reportFilter==='open'?'Không có báo lỗi nào đang mở.':'Chưa có báo lỗi đã xử lý.','ok','check'));
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
 return pageHead(tr('Câu hỏi & lượt ôn','Questions & review sets','题目与复习'),'Giáo viên xem, thêm, sửa câu hỏi theo bài hoặc cấp HSK, và tạo link ôn tập để chia sẻ. Câu hỏi được lưu trên máy chủ.','<div class="wrap">'+sync+seg(tabs.map(([k,t])=>['ttab:'+k,t,teacherTab===k]),'Mục')+'</div>')+importNote+body;
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
 },
 // Từ còn yếu của bài: đang ôn trước, rồi đến từ chưa học; AI sẽ lồng các từ này vào hội thoại.
 weakWords:n=>{
  const vocab=lessons.find(lesson=>lesson.n===Number(n))?.vocab??[];
  return [...vocab.filter(w=>wstatus(w.id)==='learning'),...vocab.filter(w=>wstatus(w.id)==='new')].map(w=>w.zh).filter(Boolean);
 },
 onDialogue:()=>{if(storage('dialogue-day',null)!==dayKey()){persist('dialogue-day',dayKey());if(location.hash==='#today')render()}}
}):null;
let miniAfterNavigation=false;
// ===== Chạm vào chữ Hán để tra =====
let lookupDict=null,lookupMax=1;
function dictionary(){
 if(lookupDict)return lookupDict;
 lookupDict=new Map();
 for(const w of wordlist??[])if(w?.zh&&!lookupDict.has(w.zh))lookupDict.set(w.zh,{zh:w.zh,pinyin:w.pinyin,vi:w.vi,level:w.level});
 for(const l of lessons)l.vocab.forEach((w,i)=>{
  if(!w?.zh)return;
  const entry=lookupDict.get(w.zh)??{zh:w.zh,pinyin:w.pinyin,vi:w.vi,level:isWorkplace?null:course};
  entry.lesson??=l.n;entry.index??=i;entry.id??=w.id;entry.example??=w.examples?.[0];
  lookupDict.set(w.zh,entry);
 });
 for(const key of lookupDict.keys())lookupMax=Math.max(lookupMax,[...key].length);
 return lookupDict;
}
// Bọc từng từ chữ Hán (khớp dài nhất theo từ điển) thành nút tra. Phần chữ khác được escape bình thường.
function zhText(text){
 const dict=dictionary();
 return String(text??'').split(/(\p{Script=Han}+)/u).map((part,i)=>{
  if(!(i%2))return esc(part);
  const chars=[...part];let out='';
  for(let k=0;k<chars.length;){
   let len=Math.min(lookupMax,chars.length-k);
   while(len>1&&!dict.has(chars.slice(k,k+len).join('')))len--;
   const word=chars.slice(k,k+len).join('');
   out+=dict.has(word)?'<span class="zh-tok" role="button" tabindex="0" data-action="lookup:'+encodeURIComponent(word)+'">'+esc(word)+'</span>':esc(word);
   k+=len;
  }
  return out;
 }).join('');
}
function lookupPanel(){
 let el=document.getElementById('lookup-pop');
 if(!el){el=document.createElement('div');el.id='lookup-pop';el.setAttribute('role','dialog');el.hidden=true;document.body.append(el)}
 return el;
}
function hideLookup(){const el=document.getElementById('lookup-pop');if(el&&!el.hidden){el.hidden=true;lookupAnchor?.focus?.();lookupAnchor=null}}
let lookupAnchor=null;
function showLookup(word,anchor){
 const dict=dictionary(),entry=dict.get(word);
 if(!entry)return;
 lookupAnchor=anchor;
 document.querySelectorAll('.zh-tok.on').forEach(x=>x.classList.remove('on'));
 anchor?.classList.add('on');
 const parts=[...word].length>1?[...word].map(c=>dict.get(c)).filter(Boolean):[];
 const vocab=entry.id?{known:'known',learning:'unknown'}[wstatus(entry.id)]??null:null;
 const el=lookupPanel();
 el.setAttribute('aria-label','Tra từ '+word);
 el.innerHTML='<div class="lk-head"><span class="han lk-zh" lang="zh-CN">'+esc(word)+'</span><div class="grow"><div class="wrap"><strong class="lk-py">'+esc(entry.pinyin??'')+'</strong>'+(entry.level?'<span class="badge" data-k="ok">HSK '+esc(entry.level)+'</span>':'')+(entry.lesson?'<span class="badge" data-k="muted">'+esc(lessonLabel(entry.lesson))+'</span>':'')+'</div>'+hvLine(entry)+'<span class="lk-vi">'+esc(entry.vi??'')+'</span></div><button type="button" class="iconbtn" data-action="lookup-close" aria-label="Đóng">'+svg('close')+'</button></div>'+
  (parts.length?'<div class="wrap">'+parts.map(p=>'<span class="lk-part"><b class="han">'+esc(p.zh)+'</b> '+esc(p.pinyin??'')+' · '+esc(p.vi??'')+'</span>').join('')+'</div>':'')+
  (entry.example?'<div class="lk-ex han" lang="zh-CN">'+esc(entry.example)+'</div>':'')+
  '<div class="wrap">'+audioButton(voiceKey(word,entry.pinyin),'Nghe')+
  (entry.id?(vocab==='unknown'?'<span class="badge" data-k="warn">Đã có trong Cần ôn lại</span>':button('Thêm vào cần ôn','lookup-save:'+encodeURIComponent(entry.id),'bookmark','primary'))+button('Mở thẻ từ','word-link:'+entry.lesson+':'+entry.index):'<small class="muted">Từ này không có trong danh sách bài của '+esc(courseName)+'.</small>')+'</div>';
 el.hidden=false;
 const r=anchor.getBoundingClientRect(),w=Math.min(380,innerWidth-16);
 el.style.width=w+'px';
 el.style.left=Math.max(8,Math.min(r.left+scrollX,scrollX+innerWidth-w-8))+'px';
 el.style.top=(r.bottom+scrollY+8)+'px';
 const recent=storage('lookups',[]).filter(x=>x!==word);
 persist('lookups',[word,...recent].slice(0,30));
 el.querySelector('[data-action="lookup-close"]')?.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')hideLookup();
 if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('zh-tok')){e.preventDefault();e.target.click()}
});
document.addEventListener('click',e=>{if(!e.target.closest?.('#lookup-pop,.zh-tok'))hideLookup()},true);
window.addEventListener('hashchange',hideLookup);

// ===== Luyện viết chữ Hán (Hanzi Writer, dữ liệu nét tự phục vụ ở /build/hanzi) =====
let writeMode='watch',writeChar=null,writer=null,writeStep=0,writeLoader=null;
const writingStore=storage('writing',{});
const lessonChars=l=>[...new Set(l.vocab.flatMap(w=>[...(w.zh??'')]).filter(c=>/\p{Script=Han}/u.test(c)))];
function loadHanziWriter(){
 if(window.HanziWriter)return Promise.resolve();
 writeLoader??=new Promise((done,fail)=>{const s=document.createElement('script');s.src='/build/hanzi/hanzi-writer.min.js';s.onload=done;s.onerror=()=>{writeLoader=null;fail(new Error('load'))};document.head.append(s)});
 return writeLoader;
}
function writeResult(html,k=''){const el=$('write-result');if(el)el.innerHTML=html?note(html,k):''}
async function mountWriter(){
 const el=$('hanzi-stage');
 if(!el)return;
 try{await loadHanziWriter()}catch{writeResult('Chưa tải được công cụ viết chữ. Kiểm tra kết nối rồi tải lại trang.','bad');return}
 if(!el.isConnected)return;
 el.innerHTML='';
 const size=Math.min(340,el.clientWidth||340);
 writer=window.HanziWriter.create(el,writeChar,{width:size,height:size,padding:18,showOutline:writeMode!=='free',showCharacter:false,
  strokeColor:'#0f241e',outlineColor:'#d8cfbd',highlightColor:'#d9480f',drawingColor:'#13684c',drawingWidth:22,strokeAnimationSpeed:1,delayBetweenStrokes:300,
  charDataLoader:(char,onLoad,onError)=>fetch('/build/hanzi/'+encodeURIComponent(char)+'.json').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(onLoad).catch(onError),
  onLoadCharDataError:()=>writeResult('Chưa có dữ liệu nét cho chữ '+esc(writeChar)+'.','warn')});
 if(writeMode==='watch'){writeStep=0;writer.animateCharacter();return}
 let mistakes=0;
 writer.quiz({showHintAfterMisses:writeMode==='trace'?1:3,highlightOnComplete:true,
  onMistake:d=>{mistakes++;writeResult('<span>Nét '+(d.strokeNum+1)+' chưa đúng hướng hoặc vị trí. '+(writeMode==='trace'?'Viết theo nét gợi ý màu cam.':'Sai 3 lần sẽ hiện gợi ý.')+'</span>','warn')},
  onCorrectStroke:d=>writeResult('<span>Đúng nét '+(d.strokeNum+1)+' · còn '+d.strokesRemaining+' nét.</span>','ok'),
  onComplete:d=>{
   const prev=writingStore[writeChar];
   writingStore[writeChar]={best:Math.min(prev?.best??99,d.totalMistakes),at:Date.now(),mode:writeMode};
   persist('writing',writingStore);
   writeResult('<strong>'+(d.totalMistakes?'Hoàn thành · '+d.totalMistakes+' lần sai':'Hoàn hảo! Không sai nét nào.')+'</strong><span>'+(writeMode==='free'?'Viết lại để luyện nhanh hơn, hoặc chọn chữ khác.':'Thử chế độ “Tự viết” khi đã quen.')+'</span>',d.totalMistakes?'warn':'ok');
  }});
}
function writingStage(l){
 const chars=lessonChars(l);
 if(!chars.length)return note('Bài này chưa có từ vựng để luyện viết.');
 if(!chars.includes(writeChar))writeChar=chars[0];
 const dict=dictionary(),info=dict.get(writeChar)??{};
 const words=l.vocab.filter(w=>(w.zh??'').includes(writeChar)).slice(0,4);
 const modes=[['watch','Xem thứ tự nét'],['trace','Viết theo'],['free','Tự viết']];
 const hint={watch:'Xem từng nét theo đúng thứ tự. Bấm “Từng nét” để đi chậm.',trace:'Dùng chuột hoặc ngón tay viết đè lên chữ mờ, nét sai sẽ có gợi ý.',free:'Tự viết chữ trong khung. Sai 3 lần ở một nét mới hiện gợi ý.'}[writeMode];
 const done=chars.filter(c=>writingStore[c]).length;
 setTimeout(mountWriter);
 return '<div class="tab-head"><h2>Luyện viết chữ Hán</h2>'+seg(modes.map(([k,t])=>['wmode:'+k,t,writeMode===k]),'Chế độ viết')+'</div>'+
  '<div class="write-grid"><section class="panel write-list" aria-label="Chữ trong bài"><span class="lbl">Chữ trong bài · '+done+'/'+chars.length+' đã viết</span>'+
  chars.map(c=>{const s=writingStore[c];return '<button type="button" class="write-char'+(c===writeChar?' on':'')+'" data-action="wchar:'+encodeURIComponent(c)+'" aria-pressed="'+(c===writeChar)+'"><span class="han">'+esc(c)+'</span><small>'+(s?(s.best===0?'Viết thạo':'Đang luyện'):'Chưa luyện')+'</small></button>'}).join('')+'</section>'+
  '<section class="panel write-main"><p class="muted">'+hint+'</p><div class="write-box"><svg class="write-grid-bg" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0V100M0 50H100" /><path class="diag" d="M0 0L100 100M100 0L0 100" /></svg><div id="hanzi-stage" role="img" aria-label="Khung viết chữ '+esc(writeChar)+'"></div></div>'+
  '<div class="wrap" style="justify-content:center">'+(writeMode==='watch'?button('Xem lại','wplay','shuffle')+button('Từng nét','wstep','arrow','primary'):button('Viết lại','wrestart','shuffle','primary'))+'</div><div id="write-result" aria-live="polite"></div></section>'+
  '<aside class="side-col"><section class="panel"><div class="row" style="gap:14px"><span class="han write-big" lang="zh-CN">'+esc(writeChar)+'</span><div class="grow write-info"><strong class="lk-py">'+esc(info.pinyin??'')+'</strong><span>'+esc(info.vi??'')+'</span></div></div><div class="form-actions">'+audioButton(voiceKey(writeChar,info.pinyin),'Nghe')+'</div></section>'+
  (words.length?'<section class="panel"><h3 style="margin:0 0 6px">Từ có chữ này</h3>'+words.map(w=>'<div class="kv"><span><b class="han">'+esc(w.zh)+'</b> <small class="muted">'+esc(w.pinyin)+'</small></span><small>'+esc(w.vi)+'</small></div>').join('')+'</section>':'')+
  '<small class="muted">Thứ tự nét theo dữ liệu mở Hanzi Writer / Make Me a Hanzi (Arphic Public License).</small></aside></div>';
}

// ===== Tùy chọn email nhắc học (trang Tiến độ) =====
let emailPrefs=null,emailPrefsLoading=false;
async function loadEmailPrefs(){
 if(emailPrefsLoading)return;
 emailPrefsLoading=true;
 try{const r=await fetch('/api/email-prefs');if(r.ok)emailPrefs=await r.json()}catch{}
 finally{emailPrefsLoading=false;if(location.hash==='#progress'){const el=$('email-prefs');if(el)el.outerHTML=emailPrefsCard()}}
}
async function saveEmailPrefs(){
 const body={streak:$('pref-streak').checked,weekly:$('pref-weekly').checked,hour:+$('pref-hour').value};
 try{
  const r=await fetch('/api/email-prefs',{method:'PUT',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error);
  emailPrefs=await r.json();notify('Đã lưu tùy chọn email.');
 }catch(err){notify(err.message||'Chưa lưu được tùy chọn email.')}
}
function emailPrefsCard(){
 if(viewer.admin)return '';
 if(!emailPrefs){void loadEmailPrefs();return '<section class="panel" id="email-prefs"><h3>Email nhắc học</h3><p>Đang tải…</p></section>'}
 const p=emailPrefs;
 return '<section class="panel email-prefs" id="email-prefs"><h3>Email nhắc học</h3>'+
  '<label class="pref-row"><span><strong>Nhắc khi sắp mất chuỗi</strong><small>Gửi nếu hôm đó bạn chưa học lúc giờ nhắc, kèm số thẻ và câu sai đến hạn ôn.</small></span><input type="checkbox" role="switch" id="pref-streak" data-pref '+(p.streak?'checked':'')+'></label>'+
  '<label class="pref-row"><span><strong>Tổng kết tuần của tôi</strong><small>Sáng Chủ nhật: phút học, số câu, tỷ lệ đúng.</small></span><input type="checkbox" role="switch" id="pref-weekly" data-pref '+(p.weekly?'checked':'')+'></label>'+
  '<label class="pref-row"><span><strong>Giờ nhắc</strong><small>Tối đa 1 email nhắc mỗi ngày.</small></span><select id="pref-hour" data-pref>'+Array.from({length:17},(_,i)=>i+6).map(h=>'<option value="'+h+'" '+(h===p.hour?'selected':'')+'>'+String(h).padStart(2,'0')+':00</option>').join('')+'</select></label>'+
  (p.ready?'':note('Máy chủ chưa cấu hình gửi email nên chưa gửi được thư nhắc.','warn'))+'</section>';
}

// ===== Luyện nói: nhại theo câu mẫu, chấm bằng nhận dạng giọng nói của trình duyệt =====
let speakKind='sentence',speakIdx=0,speakPhase='idle',speakResult=null,speakAudioUrl=null,speakStarted=0,speakTimer=null,speakRecognizer=null,speakRecorder=null,speakStream=null,speakHeard=[];
const speakingStore=storage('speaking',{});
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
const hanOnly=text=>[...String(text??'')].filter(c=>/\p{Script=Han}/u.test(c));
const toneless=p=>String(p??'').split(/[\s,，/]+/)[0].normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const charPinyin=c=>dictionary().get(c)?.pinyin??'';
function speakItems(l){
 if(speakKind==='words')return l.vocab.filter(w=>hanOnly(w.zh).length).map(w=>({zh:w.zh,pinyin:w.pinyin,vi:w.vi}));
 const seen=new Set();
 return l.dialogues.flatMap(d=>d.utterances).filter(u=>{const n=hanOnly(u.zh).length;if(!n||n>40||seen.has(u.zh))return false;seen.add(u.zh);return true}).map(u=>({zh:u.zh,pinyin:u.pinyin,vi:u.vi}));
}
// So khớp chữ mẫu với chữ máy nghe được (khoảng cách Levenshtein, truy vết từng chữ mẫu).
function scoreSpeech(target,heard){
 const T=hanOnly(target),H=hanOnly(heard),n=T.length,m=H.length;
 const d=Array.from({length:n+1},(_,i)=>Array.from({length:m+1},(_,j)=>i?(j?0:i):j));
 const sub=(a,b)=>a===b?0:toneless(charPinyin(a))&&toneless(charPinyin(a))===toneless(charPinyin(b))?0.5:1;
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+sub(T[i-1],H[j-1]));
 const marks=Array(n);
 for(let i=n,j=m;i>0;){
  if(j>0&&d[i][j]===d[i-1][j-1]+sub(T[i-1],H[j-1])){const s=sub(T[i-1],H[j-1]);marks[i-1]={zh:T[i-1],st:s===0?'ok':s===0.5?'near':'bad',heard:H[j-1]};i--;j--}
  else if(j>0&&d[i][j]===d[i][j-1]+1)j--;
  else{marks[i-1]={zh:T[i-1],st:'bad',heard:''};i--}
 }
 const score=n?Math.round(100*marks.reduce((s,x)=>s+(x.st==='ok'?1:x.st==='near'?0.5:0),0)/n):0;
 return {score,marks,heard};
}
function stopSpeakStream(){speakStream?.getTracks().forEach(t=>t.stop());speakStream=null;clearInterval(speakTimer)}
// Chấm bằng máy chủ (Whisper) khi trình duyệt không có nhận dạng giọng nói (Firefox, một số Safari)
// hoặc khi nhận dạng của trình duyệt lỗi mạng; cần trợ giảng AI đang bật.
let speakServer=false,speakBlob=null,speakToken=0;
const serverScoring=()=>Boolean(viewer.aiAvailable&&(!SpeechRec||speakServer));
function scoreSpoken(item){
 const results=(speakHeard.length?speakHeard:['']).map(h=>scoreSpeech(item.zh,h));
 speakResult=results.sort((a,b)=>b.score-a.score)[0];
 const prev=speakingStore[item.zh],heardAny=speakHeard.some(Boolean);
 speakingStore[item.zh]={best:heardAny?Math.max(prev?.best??0,speakResult.score):(prev?.best??0),tries:(prev?.tries??0)+1,at:Date.now()};
 persist('speaking',speakingStore);
}
async function transcribeSpeech(blob){
 if(!blob||blob.size<1200)throw new Error('Bản ghi quá ngắn. Bấm ghi âm, đọc hết câu rồi bấm dừng.');
 const type=blob.type||'audio/webm',form=new FormData();
 form.append('audio',blob,'speech.'+(type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm'));
 const response=await fetch('/api/ai/transcribe',{method:'POST',headers:{Accept:'application/json'},body:form});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error??body.message??'Chưa chấm được phát âm. Vui lòng thử lại.');
 return String(body.text??'').trim();
}
function finishSpeaking(){
 if(speakPhase!=='rec')return;
 try{speakRecorder?.state==='recording'&&speakRecorder.stop()}catch{}
 stopSpeakStream();
 const item=speakItems(getLesson(location.hash.split('/')[1]??state.last))[speakIdx];
 if(item&&!speakHeard.length&&serverScoring()){
  const token=++speakToken;
  speakPhase='scoring';render();
  speakBlob.then(transcribeSpeech)
   .then(text=>{if(token!==speakToken)return;speakHeard=text?[text]:[];scoreSpoken(item)})
   .catch(error=>{if(token!==speakToken)return;speakResult=null;notify(error instanceof TypeError?'Không kết nối được để chấm phát âm.':error.message)})
   .finally(()=>{if(token!==speakToken)return;speakPhase='done';render()});
  return;
 }
 if(item&&SpeechRec)scoreSpoken(item);
 else speakResult=null;
 speakPhase='done';render();
}
async function startSpeaking(){
 if(speakPhase==='scoring')return;
 if(speakPhase==='rec'){speakRecognizer?.stop();setTimeout(finishSpeaking,400);return}
 speakResult=null;speakHeard=[];speakRecognizer=null;sayReset(null);
 if(speakAudioUrl){URL.revokeObjectURL(speakAudioUrl);speakAudioUrl=null}
 stopAudio();
 try{
  speakStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const chunks=[];
  speakRecorder=new MediaRecorder(speakStream);
  speakRecorder.ondataavailable=e=>chunks.push(e.data);
  const recorder=speakRecorder;
  speakBlob=new Promise(resolve=>{recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});speakAudioUrl=URL.createObjectURL(blob);const b=$('speak-replay');if(b)b.disabled=false;resolve(blob)}});
  speakRecorder.start();
 }catch{notify(window.isSecureContext&&navigator.mediaDevices?'Chưa dùng được micro. Hãy cho phép FangSchool truy cập micro trong trình duyệt.':'Micro chỉ dùng được khi mở FangSchool qua HTTPS (hoặc localhost).');stopSpeakStream();return}
 if(SpeechRec&&!serverScoring()){
  speakRecognizer=new SpeechRec();
  speakRecognizer.lang='zh-CN';speakRecognizer.interimResults=false;speakRecognizer.maxAlternatives=5;speakRecognizer.continuous=false;
  speakRecognizer.onresult=e=>{speakHeard=[...e.results[0]].map(r=>r.transcript)};
  speakRecognizer.onerror=e=>{
   // Nhận dạng của trình duyệt hỏng (mạng, dịch vụ bị chặn): lượt này và các lượt sau chấm bằng máy chủ.
   if(viewer.aiAvailable&&['network','service-not-allowed','language-not-supported'].includes(e.error)){speakServer=true;notify('Nhận dạng của trình duyệt đang lỗi, FangSchool sẽ chấm bằng AI.');return}
   if(e.error==='not-allowed')notify('Trình duyệt chặn nhận dạng giọng nói.');else if(e.error==='network')notify('Nhận dạng giọng nói cần kết nối mạng.')};
  speakRecognizer.onend=()=>finishSpeaking();
  try{speakRecognizer.start()}catch{}
 }
 speakPhase='rec';speakStarted=Date.now();render();
 speakTimer=setInterval(()=>{const t=$('speak-timer');if(t)t.textContent='0:'+String(Math.floor((Date.now()-speakStarted)/1000)).padStart(2,'0');if(Date.now()-speakStarted>15000){speakRecognizer?.stop();finishSpeaking()}},250);
}
function resetSpeaking(){
 if(speakPhase==='rec'){speakRecognizer?.abort?.();try{speakRecorder?.stop()}catch{}stopSpeakStream()}
 speakToken++;
 speakPhase='idle';speakResult=null;speakHeard=[];
}
window.addEventListener('hashchange',()=>{if(speakPhase==='rec'||speakPhase==='scoring'){resetSpeaking()}});
function speakingStage(l){
 const items=speakItems(l);
 const kinds=[['sentence','Nhại theo câu'],['words','Luyện từ & thanh điệu']];
 const head='<div class="tab-head"><h2>Luyện nói · nhại theo câu mẫu</h2>'+seg(kinds.map(([k,t])=>['skind:'+k,t,speakKind===k]),'Kiểu luyện')+'</div>';
 if(!items.length)return head+note(speakKind==='sentence'?'Bài này chưa có câu hội thoại để luyện nói. Thử “Luyện từ & thanh điệu”.':'Bài này chưa có từ vựng.');
 if(speakIdx>=items.length)speakIdx=0;
 const item=items[speakIdx],done=speakPhase==='done'&&speakResult&&speakResult.heard;
 const silent=speakPhase==='done'&&speakResult&&!speakResult.heard;
 const marks=done?speakResult.marks:null;
 let mi=0;
 const chars=[...item.zh].map(c=>{if(!/\p{Script=Han}/u.test(c))return '<span class="sp-punct">'+esc(c)+'</span>';const mk=marks?.[mi++];return '<span class="sp-char'+(mk?' '+mk.st:'')+'" title="'+esc(charPinyin(c))+'">'+esc(c)+'</span>'}).join('');
 const color={ok:'var(--ok)',near:'#d9a441',bad:'var(--bad)'};
 const fixes=done?speakResult.marks.filter(x=>x.st!=='ok').slice(0,6).map(x=>note('<span><strong class="han">'+esc(x.zh)+' '+esc(charPinyin(x.zh))+'</strong> · '+(x.st==='near'?'gần đúng — máy nghe thành <span class="han">'+esc(x.heard)+'</span> '+esc(charPinyin(x.heard))+', kiểm tra lại thanh điệu.':x.heard?'máy nghe thành <span class="han">'+esc(x.heard)+'</span> '+esc(charPinyin(x.heard))+'.':'chưa nghe thấy chữ này, đọc rõ và chậm hơn.')+'</span>',x.st==='near'?'warn':'bad')).join(''):'';
 const score=done?speakResult.score:0;
 const list='<section class="panel speak-list" aria-label="Câu luyện nói"><span class="lbl">'+(speakKind==='sentence'?'Câu trong bài':'Từ trong bài')+' · '+items.length+'</span>'+
  items.map((x,i)=>{const s=speakingStore[x.zh];return '<button type="button" class="speak-item'+(i===speakIdx?' on':'')+'" data-action="sitem:'+i+'" aria-pressed="'+(i===speakIdx)+'"><span class="han">'+esc(x.zh)+'</span><span class="row split"><small class="muted">'+(s?s.tries+' lần thử':'Chưa luyện')+'</small><span class="badge" data-k="'+(!s?'muted':s.best>=85?'ok':s.best>=70?'warn':'bad')+'">'+(s?s.best+' điểm':'—')+'</span></span></button>'}).join('')+'</section>';
 const main='<div class="cards"><section class="panel speak-card"><span class="muted speak-kicker">'+(speakKind==='sentence'?'Câu ':'Từ ')+(speakIdx+1)+' / '+items.length+' · đọc theo giọng mẫu</span>'+
  '<div class="sp-line han" lang="zh-CN">'+chars+'</div><div class="sp-py">'+esc(item.pinyin??'')+'</div><div class="muted">'+esc(item.vi??'')+'</div>'+
  (speakPhase==='rec'?'<div class="sp-rec" role="status"><span class="rec-dot"></span><strong>Đang ghi âm · <span id="speak-timer">0:00</span></strong><span class="sp-wave" aria-hidden="true">'+Array.from({length:14},(_,i)=>'<i style="animation-delay:'+(i*0.07).toFixed(2)+'s"></i>').join('')+'</span></div>':'')+
  (speakPhase==='scoring'?'<div class="sp-rec" role="status" aria-busy="true"><strong>Đang chấm phát âm…</strong></div>':'')+
  '<div class="wrap" style="justify-content:center">'+audioButton(voiceKey(item.zh,item.pinyin),'Nghe mẫu')+
  '<button type="button" class="btn '+(speakPhase==='rec'?'danger':'primary')+' sp-rec-btn" data-action="srec" aria-pressed="'+(speakPhase==='rec')+'"'+(speakPhase==='scoring'?' disabled':'')+'><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'+(speakPhase==='rec'?'Dừng và chấm điểm':speakPhase==='done'?'Ghi âm lại':'Bấm để ghi âm')+'</button>'+
  (speakPhase==='done'?'<button type="button" class="btn" id="speak-replay" data-action="splay" '+(speakAudioUrl?'':'disabled')+'>'+svg('audio')+'Nghe lại bản của bạn</button>':'')+'</div></section>'+
  (done?'<section class="panel speak-result"><div class="score-ring" style="--p:'+score+'"><span>'+score+'</span></div><div class="grow"><h3 style="margin:0">'+(score>=85?'Rất tốt! Phát âm gần giống giọng mẫu.':score>=70?'Khá tốt, chỉ cần sửa vài âm.':'Cần luyện thêm các chữ được tô đỏ.')+'</h3><p>Máy nghe được: <span class="han">'+esc(speakResult.heard||'(không nhận ra)')+'</span></p>'+fixes+
   '<div class="wrap muted" style="font-size:12.5px"><span><b style="color:'+color.ok+'">■</b> Đúng</span><span><b style="color:'+color.near+'">■</b> Gần đúng</span><span><b style="color:'+color.bad+'">■</b> Sai / thiếu</span></div></div></section>':'')+
  (speakPhase==='done'&&speakBlob?'<section class="panel speak-tone"><div class="row split"><h3 style="margin:0">Đường thanh điệu</h3>'+(say.key===item.zh&&say.phase==='analyzing'?'<small class="muted">Đang phân tích…</small>':say.key===item.zh&&say.phase==='done'?'':button('Xem đường thanh điệu của bạn','speak-tone','audio','primary'))+'</div>'+(say.key===item.zh&&say.phase==='done'?toneView(item)+toneScoreNote()+(say.error?note(esc(say.error),'warn'):'')+'<small class="muted">So đường xanh (giọng bạn) với giọng mẫu và khuôn thanh. Phân tích ngay trên máy.</small>':'')+'</section>':'')+
  (silent?note('<strong>Chưa nhận ra giọng nói.</strong><span>Kiểm tra micro, nói to, rõ và gần micro hơn rồi bấm “Ghi âm lại”. Nhận dạng cần kết nối mạng.</span>','warn'):'')+
  (speakPhase==='done'&&!SpeechRec&&!viewer.aiAvailable?note('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói nên chưa chấm được điểm. Hãy nghe lại bản của bạn và so với giọng mẫu, hoặc dùng Chrome/Edge để được chấm.','warn'):'')+
  note(serverScoring()
   ?'Chấm bằng nhận dạng giọng nói AI của FangSchool (Whisper): bản ghi được gửi lên máy chủ để chuyển thành chữ rồi so với câu mẫu, không được lưu lại. Điểm chỉ mang tính tham khảo.'
   :'Chấm bằng nhận dạng giọng nói tiếng Trung có sẵn trong Chrome/Edge: trình duyệt gửi âm thanh tới dịch vụ nhận dạng của trình duyệt (Google hoặc Microsoft) để chuyển thành chữ. FangSchool không lưu bản ghi âm. Điểm chỉ mang tính tham khảo.')+'</div>';
 return head+(SpeechRec||viewer.aiAvailable?'':note('Trình duyệt này chưa có nhận dạng giọng nói. Bạn vẫn ghi âm và nghe lại được; để được chấm điểm hãy dùng Chrome hoặc Edge.','warn'))+'<div class="speak-grid">'+list+main+'</div>';
}

function render(){
 const [page='home',n,tab]=(location.hash.slice(1)||'home').split('/');
 chrome(page);
 document.body.classList.toggle('focus',page==='quiz'&&Boolean(quiz?.session)&&!quiz?.done);
 document.body.classList.toggle('quiz-mode',page==='quiz'&&Boolean(quiz)&&!quiz.done);
 $('app').innerHTML=({home,today:todayPage,story:storyPage,chat:tutor?()=> '':home,lessons:lessonDirectory,lesson:()=>lessonPage(n,tab),bank,listening:workplaceListeningPage,exams:()=>exams.page(n,tab),practice,quiz:quizPage,progress,review,teacher:viewer.admin?teacher:home}[page]??home)();
 if(tutor){
  tutor.update(page,location.hash.slice(1)||'home');
  if(miniAfterNavigation&&page!=='chat'){miniAfterNavigation=false;tutor.showMini()}
 }
 if(page==='quiz'&&quiz&&!quiz.done){
  const question=getQuestion(quiz.ids[quiz.index]);
  if(question)syncProgress.recordView('questions',question.id);
 }
 afterRender(page);
}
// Sau khi vẽ: tự đọc từ mới / thẻ nghe trong buổi học; pháo giấy và đếm số trên biên lai.
function afterRender(page){
 if(page!=='quiz'||!quiz)return;
 if(quiz.session&&!quiz.done){
  const auto=document.querySelector('[data-autoplay]'),key=quiz.index+(srsFlip?'b':'f');
  if(auto&&quiz.session.autoplayed!==key){quiz.session.autoplayed=key;setTimeout(()=>{if(document.contains(auto)&&!auto.classList.contains('active'))auto.click()},280)}
 }
 const fresh=quiz.done&&(quiz.session||quiz.checkResult)&&!quiz.celebrated;
 if(fresh){
  quiz.celebrated=true;saveQuiz();sfx('done');
  confetti(document.querySelector('.rc-hero,.check-result')??document.body,40);
  countUp(document.querySelector('.receipt,.check-result')??document);
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
  navigator.serviceWorker?.controller?.postMessage('logout');
  // Huỷ đăng ký thông báo trên máy này trước khi đăng xuất, để người dùng sau không nhận nhắc học của người trước.
  (pushState==='on'?disablePush(true):Promise.resolve()).then(()=>fetch('/api/logout',{method:'POST'})).then(response=>{if(response.ok)location.assign('/');else notify('Chưa đăng xuất được.')}).catch(()=>notify('Chưa đăng xuất được.'));
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
  case 'lookup':{const w=decodeURIComponent(x??'');if(trigger)showLookup(w,trigger);break}
  case 'lookup-close':hideLookup();break;
  case 'lookup-save':{const id=decodeURIComponent(x??'');markWord(id,false);save();notify('Đã thêm vào Cần ôn lại.');const a=lookupAnchor;hideLookup();if(a)showLookup(a.textContent,a);break}
  case 'wmode':writeMode=['watch','trace','free'].includes(x)?x:'watch';render();break;
  case 'wchar':writeChar=decodeURIComponent(x??'');render();break;
  case 'wplay':writer?.hideCharacter?.();writeStep=0;writer?.animateCharacter?.();break;
  case 'wstep':{if(!writer)break;if(!writeStep)writer.hideCharacter();if(typeof writer.animateStroke==='function'){writer.animateStroke(writeStep).catch?.(()=>{});writeStep++;writeResult('<span>Nét '+writeStep+'</span>')}else writer.animateCharacter();break}
  case 'wrestart':void mountWriter();break;
  case 'skind':resetSpeaking();speakKind=x==='words'?'words':'sentence';speakIdx=0;render();break;
  case 'sitem':resetSpeaking();speakIdx=+x||0;render();break;
  case 'srec':void startSpeaking();break;
  case 'splay':if(speakAudioUrl){stopAudio();new Audio(speakAudioUrl).play().catch(()=>notify('Chưa phát được bản ghi.'))}break;
  case 'ttab':teacherTab=x;render();break;
  case 'tq':teacherPick=action.slice(3);render();document.getElementById('q-form')?.scrollIntoView({block:'nearest'});break;
  case 'tq-new':teacherPick='new';render();document.querySelector('#q-form textarea')?.focus();break;
  case 'tq-restore':{const e=serverEntry(teacherPick);if(e)putTeacherQuestion({id:e.id,status:e.status,restore:+x}).then(()=>afterTeacherSave(e.id,'Đã khôi phục phiên bản cũ.')).catch(err=>notify(err.message));break}
  case 'tq-delete':{const e=serverEntry(teacherPick);if(e&&confirm('Xóa câu này? Học viên sẽ không thấy câu nữa.'))putTeacherQuestion({id:e.id,lesson:e.lesson,status:'deleted',question:e.question}).then(()=>{teacherPick=null;return afterTeacherSave(null,'Đã xóa câu hỏi.')}).catch(err=>notify(err.message));break}
  case 'tq-import':void importLocalEdits();break;
  case 'tpage':teacherPage=Math.max(0,teacherPage+(+x));render();break;
  case 'share-copy':{const link=shareLinks[+x];if(link)navigator.clipboard?.writeText(link.url).then(()=>notify('Đã sao chép link lượt ôn.')).catch(()=>notify(link.url));break}
  case 'vmode':stopAudio();vocabMode=x;vocabPick=null;vocabOpts=null;flip=false;render();break;
  case 'vpick':{
   const cur=getLesson(state.last),w=cur.vocab[flash]??cur.vocab[0];
   if(!w||vocabPick!==null||!vocabOpts)break;
   vocabPick=+x;
   // Chọn sai → thẻ quay lại ngày mai. Chọn đúng một từ chưa có thẻ → bắt đầu ôn (hẹn 3 ngày).
   const picked=vocabOpts.items[vocabPick]?.id===w.id;sfx(picked?'ok':'bad');buzz(picked?'ok':'bad');
   if(!picked){markWord(w.id,false);save()}
   else if(!ensureStudy(state).srs[w.id]){rateCard(state,w.id,'ok');save()}
   render();document.querySelector('.qcard .note')?.focus?.();break;
  }
  case 'vnext':{stopAudio();const cur=getLesson(state.last);flash=(flash+1)%Math.max(1,cur.vocab.length);vocabPick=null;vocabOpts=null;flip=false;render();break}
  case 'gpoint':gPoint=+x;render();break;
  case 'ltab':stopAudio();listenTab=x;render();break;
  case 'setting':if(['hideZh','hidePy','showVi'].includes(x)){settings[x]=!settings[x];persist('settings',settings);render()}break;
  case 'rtab':reviewTab=x;if(location.hash==='#review')render();else go('review');break;
  case 'review-all':{const ids=new Set([...wrongQuestions(),...questions.filter(q=>state.marks[q.id]||q.word&&wstatus(q.word)==='learning')].map(q=>q.id));start(questions.filter(q=>ids.has(q.id)),'Ôn tất cả mục cần ôn',Math.min(50,ids.size),'smart');break}
  case 'qfilter':quizFilter=x;render();break;
  case 'self':{
   const answer=applyGrade(+x,y==='1',{selfGraded:true});
   if(!answer)break;
   render();notify(answer.grade?'Đã ghi nhận câu đúng.':'Đã thêm câu vào “Cần ôn lại”, sẽ gặp lại vào ngày mai.');break;
  }
  case 'ai-grade':void aiGrade([+x]);break;
  case 'ai-grade-all':void aiGrade(quiz?.answers.map((a,i)=>a&&!a.skipped&&a.grade===null&&a.value?.trim()?i:-1).filter(i=>i>=0)??[]);break;
  case 'prev':if(quiz&&quiz.index>0){stopAudio();quiz.index--;quiz.selection='';quiz.picked=[];saveQuiz();render();window.scrollTo(0,0)}break;
  case 'goal':if(goalChoices.includes(+x)){ensureStudy(state).goal=+x;save();const card=$('goal-card');if(card)card.outerHTML=goalCard();$('goal-card')?.querySelector('[aria-pressed="true"]')?.focus()}break;
  case 'sess-start':startSession(x==='mini');break;
  case 'sess-flip':srsFlip=!srsFlip;sfx('flip');render();document.querySelector('.srs-flash')?.focus();break;
  case 'sess-rate':{
   const item=sessionItem(quiz?.ids[quiz.index]);
   if(!item?.w||!['hard','ok','easy'].includes(x))break;
   rateCard(state,item.w.id,x);
   state.words[item.w.id]=wstatus(item.w.id)==='known'?'known':'unknown';
   sessionAnswer({special:'card',rating:x});sfx(x==='hard'?'flip':'ok');save();sessionNext();break;
  }
  case 'sess-learn':{
   const item=sessionItem(quiz?.ids[quiz.index]);
   if(!item?.w)break;
   // Từ mới: gặp lại ngày mai để chuyển vào trí nhớ dài hạn; "đã biết" thì giãn lịch 7 ngày.
   rateCard(state,item.w.id,x==='known'?'easy':'hard');
   state.words[item.w.id]=x==='known'?'known':'unknown';
   sessionAnswer({special:'learn',known:x==='known'});save();sessionNext();break;
  }
  case 'sess-say':{
   sessionAnswer({special:'say',score:say.score});sayReset(null);sessionNext();break;
  }
  case 'sess-skip':sessionAnswer({special:'skip'});sessionNext();break;
  case 'sess-exit':
   if(!quiz?.session)break;
   if(quiz.answers.some(Boolean)){if(confirm('Kết thúc buổi học sớm và xem kết quả?')){sayReset(null);finish()}}
   else{quiz.done=true;saveQuiz();go('home')}
   break;
  case 'say-rec':{const item=sessionItem(quiz?.ids[quiz.index]);if(item?.w)void sayRecord(item.w);break}
  case 'say-play':if(say.audio){stopAudio();new Audio(say.audio).play().catch(()=>notify('Chưa phát được bản ghi.'))}break;
  case 'speak-tone':{const item=speakItems(getLesson(location.hash.split('/')[1]??state.last))[speakIdx];if(item&&speakBlob)void speakTone(item);break}
  case 'sound':{const on=toggleSound();notify(on?'Đã bật âm thanh phản hồi.':'Đã tắt âm thanh phản hồi.');render();break}
  case 'check':startCheck(x==='w'?'w':'p');break;
  case 'hv-drill':{const ids=new Set(hvWords().map(w=>w.id));start(questions.filter(q=>ids.has(q.word)&&q.options?.length&&q.answers?.length&&!q.audio),'Từ đọc giống tiếng Việt',10,'smart');break}
  case 'story-new':void newStory();break;
  case 'story-say':void storySay(+x,trigger);break;
  case 'story-all':storyChain++;void storySay(0,trigger,storyChain);break;
  case 'story-tr':{if(x==='all'){storyShow=storyShow.size===story?.sentences?.length?new Set():new Set(story?.sentences?.map((_,i)=>i))}else{const i=+x;storyShow.has(i)?storyShow.delete(i):storyShow.add(i)}render();break}
  case 'story-q':{const q=story?.questions?.[+x];if(!q||storyPicks[+x]!==undefined)break;storyPicks[+x]=+y;const ok=+y===q.answer;sfx(ok?'ok':'bad');buzz(ok?'ok':'bad');render();break}
  case 'install':if(installPrompt){installPrompt.prompt();installPrompt.userChoice.finally(()=>{installPrompt=null;render()})}break;
  case 'push-on':void enablePush();break;
  case 'push-off':void disablePush();break;
  case 'push-test':void testPush();break;
  case 'flip':flip=!flip;render();document.querySelector('.flash')?.focus();break;
  case 'flash':{stopAudio();const length=getLesson(state.last).vocab.length;flash=(flash+(+x)+length)%length;flip=false;render();break}
  case 'pickflash':stopAudio();flash=+x;flip=false;render();break;
  case 'word-link':state.last=+x;save();flash=+y;flip=false;go('lesson/'+x);break;
  case 'word':{
   if(x!=='known'&&x!=='unknown'||!y)break;
   const step=markWord(y,x==='known');save();render();
   notify(x==='known'?'Đã thuộc · hẹn ôn lại sau '+dayWord(step)+' để chắc nhớ lâu.':'Đã thêm vào lịch ôn · gặp lại vào ngày mai.');break;
  }
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
  case 'review-words':start(questions.filter(q=>q.word&&wstatus(q.word)==='learning'),'Ôn từ chưa thuộc');break;
  case 'review-due':start(dueWrongQuestions(),'Ôn câu sai đến hạn');break;
  case 'report-q':{
   const q=getQuestion(action.slice('report-q:'.length));
   if(!q)break;
   openReport({kind:'question',ref:q.id,title:locationLabel(q)+' · '+q.prompt.replace(/\s+/g,' ').slice(0,90),
    context:[locationLabel(q),'Đề: '+q.prompt,q.options?.length?'Lựa chọn: '+q.options.join(' / '):'','Đáp án: '+(q.reference??q.answers?.join(' / ')??'—'),q.zh?'Câu: '+q.zh:'',q.pinyin?'Pinyin: '+q.pinyin:'',q.vi?'Nghĩa: '+q.vi:''].filter(Boolean).join('\n')});
   break;
  }
  case 'report-d':{
   const lesson=getLesson(+x),d=lesson?.dialogues?.[+y];
   if(!d)break;
   openReport({kind:'dialogue',ref:lesson.n+'-d'+y,reason:'translation',title:lessonLabel(lesson.n)+' · Hội thoại '+(d.part??+y+1),
    context:lessonLabel(lesson.n)+' · Hội thoại '+(d.part??+y+1)+'\n'+d.utterances.map(u=>(u.who?u.who+': ':'')+u.zh+(u.pinyin?' | '+u.pinyin:'')+(u.vi?' | '+u.vi+(u.auto?.includes('vi')?' (dịch tự động)':''):'')).join('\n')});
   break;
  }
  case 'report-status':{
   fetch('/api/admin/reports/'+(+x),{method:'PATCH',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({status:y})})
    .then(response=>{if(!response.ok)throw new Error('Chưa cập nhật được.');notify(y==='resolved'?'Đã đánh dấu đã xử lý.':'Đã mở lại báo lỗi.');return loadReports()})
    .catch(error=>notify(error.message));
   break;
  }
  case 'report-filter':reportFilter=x==='resolved'?'resolved':'open';reportList=null;render();break;
  case 'auto-ex':{
   const lesson=getLesson(+x),items=lesson.questions.filter(q=>q.origin==='auto'&&q.mode===y);
   start(items,lessonLabel(lesson.n)+' · '+(y==='cloze'?'Điền từ vào câu':'Sắp xếp câu'),Math.min(10,items.length),'smart',null,'lesson/'+lesson.n+'/extra');
   break;
  }
  case 'today-wrong':start(dueWrongQuestions(),'Buổi học hôm nay · Câu sai đến hạn',5,'smart',null,'today');break;
  case 'today-talk':if(!tutor?.startLessonDialogue(+x))notify('Trợ giảng AI đang bận, thử lại sau giây lát.');break;
  case 'ask-why':{
   // "Vì sao sai?": mở trợ giảng AI ngay trên trang, gửi kèm đề, câu trả lời và đáp án.
   const answer=quiz?.answers[+x],q=answer&&getQuestion(answer.id);
   if(!q||!tutor)break;
   const clip=(text,max)=>{const s=String(text??'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max-1)+'…':s};
   const message='Vì sao câu trả lời của mình sai? Giải thích ngắn gọn giúp mình.\nĐề: '+clip(q.prompt,220)+'\nMình trả lời: '+clip(answer.value||'(bỏ trống)',80)+'\nĐáp án đúng: '+clip(q.reference??q.answers?.[0]??'',90);
   if(!tutor.ask(message,{lesson:q.lesson}))notify('Trợ giảng AI đang trả lời câu khác, thử lại sau giây lát.');
   break;
  }
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
// Phím tắt khi làm bài: 1–4 chọn đáp án, Enter kiểm tra / câu tiếp, Space lật thẻ, 1–3 chấm thẻ.
document.addEventListener('keydown',e=>{
 if(location.hash!=='#quiz'||!quiz||quiz.done||e.ctrlKey||e.metaKey||e.altKey)return;
 const t=e.target;
 if(e.defaultPrevented||t.matches?.('textarea,input,select')||t.isContentEditable||document.getElementById('lookup-pop')?.hidden===false)return;
 // Đang đứng ở một nút (Tab tới): để Enter/Space bấm đúng nút đó.
 if((e.key==='Enter'||e.key===' ')&&t.closest?.('button,a,[role=button],summary')&&!t.closest('.qcard .option,.srs-flash'))return;
 const click=selector=>{const el=document.querySelector(selector);if(!el||el.disabled)return false;e.preventDefault();el.click();return true};
 const item=sessionItem(quiz.ids[quiz.index]);
 if(item?.kind==='card'){
  if(e.key===' '||e.key==='Enter'&&!srsFlip)click('[data-action="sess-flip"]');
  else if(srsFlip&&['1','2','3'].includes(e.key))click('[data-action="sess-rate:'+['hard','ok','easy'][+e.key-1]+'"]');
  return;
 }
 if(item?.kind==='learn'){if(e.key==='Enter'||e.key===' ')click('[data-action="sess-learn:new"]');else if(/^[bB]$/.test(e.key))click('[data-action="sess-learn:known"]');else if(/^[rR]$/.test(e.key))click('.learn-audio [data-action^="speak:"]');return}
 if(item)return;
 if(/^[1-6]$/.test(e.key))click('.qcard .cards > .option:nth-child('+e.key+')');
 else if(e.key==='Enter')click('.qnav [data-action="next"]')||click('#check-answer');
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
 if(t.id==='exam-date'){const v=/^\d{4}-\d{2}-\d{2}$/.test(t.value)?t.value:'';ensureStudy(state).plan.exam=v;save();notify(v?'Đã lưu ngày thi '+fmtDate(new Date(v+'T00:00:00').getTime())+'.':'Đã xoá ngày thi.');render()}
 if(t.id==='rate'){settings.rate=+t.value;setAudioRate(settings.rate);persist('settings',settings)}
 if(t.id==='exam-rate')exams?.setRate(Number(t.value));
 if(t.dataset.setting){settings[t.dataset.setting]=t.checked;persist('settings',settings);render()}
 if(t.id==='teacher-lesson'){teacherLesson=+t.value;render()}
 if(t.dataset?.pref!==undefined)void saveEmailPrefs();
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
// Rời trang truyện: dừng giọng đọc và chuỗi "Nghe cả truyện".
function stopStory(){storyChain++;storyPlayer.onended=null;storyPlayer.pause()}
window.addEventListener('pagehide',stopStory);
window.addEventListener('hashchange',()=>{if(location.hash!=='#story')stopStory()});
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
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(refreshPush).then(()=>{if(state&&['','#home','#progress'].includes(location.hash))render()}).catch(()=>{});
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
 await loadLiveTeacherQuestions();
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
