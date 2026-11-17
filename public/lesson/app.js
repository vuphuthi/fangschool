import {sameOriginFetch as fetch} from '../request.js';
import {createExamCenter} from './exams.js?v=8';
import {openProgress} from './study-progress.js';
import {assessmentPlan,lessonSkill,lessonSkills,grammarModes,bankGroups,bankNames,kinds} from './study-common.js';
import {playRecording, setAudioRate, stopAudio} from './audio-player.js?v=3';
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
const courseName='HSK '+course;
const lessonCount=()=>lessons.filter(l=>l.n<100).length;
const lessonLabel=n=>n>=100?'Ngữ âm '+(n-100):'Bài '+n;
const locationLabel=q=>q.origin==='bank'?esc(q.topic):lessonLabel(q.lesson);
const baseQuery='?hsk='+course;
const examDestination=()=>location.hash.startsWith('#exams')?'#exams':'';
const courseTabs=()=>'<nav class="course-tabs" aria-label="Cấp độ HSK">'+[1,2,3,4].filter(n=>n<=viewer.maxLevel).map(n=>
 '<a class="course-tab'+(n===course?' active':'')+'" href="/?hsk='+n+examDestination()+'"'+(n===course?' aria-current="page"':'')+'>HSK ' +n+'</a>').join('')+'</nav>';
const storageKey=key=>'bao-hsk'+(key==='settings'?2:course)+':'+viewer.email+':'+key;
function storage(key,fallback){try{return JSON.parse(localStorage.getItem(storageKey(key)))??fallback}catch{return fallback}}
function persist(key,val){try{localStorage.setItem(storageKey(key),JSON.stringify(val));return true}catch{notify('Trình duyệt đang chặn lưu dữ liệu.');return false}}
let state,syncProgress;
const settings=storage('settings',{theme:'light',lang:'vi',rate:1,hideZh:false,hidePy:false,showVi:false});
let catalog,exams,wordlist=[],levelQuestions=[],lessons=[],questions=[],quiz=storage('session',null),flash=0,flip=false,expanded=false,timeout,teacherLesson=1;
const edits=storage('content',{});
const names={exams:['Đề ôn thi','Mock exams','模拟试卷'],bank:['Luyện theo cấp HSK','Practice by HSK level','按HSK等级练习'],home:['Tổng quan','Overview','首页'],lessons:['Bài học','Lessons','课程'],practice:['Ôn tập tổng hợp','Mixed review','综合复习'],review:['Cần ôn lại','Review list','待复习'],progress:['Tiến độ','Progress','学习进度'],teacher:['Giáo viên','Teacher','教师'],lesson:['Ôn theo bài','Lesson review','单课复习'],quiz:['Làm câu hỏi','Practice','答题']};
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
const navs=[['home','home'],['lessons','book'],['bank','target'],['exams','text'],['practice','shuffle'],['review','bookmark'],['progress','chart']];
function chrome(page){
 document.documentElement.dataset.theme=settings.theme;
 document.documentElement.lang=settings.lang==='zh'?'zh-CN':settings.lang;
 const title=k=>tr(...(names[k]??names.home));
 $('sidebar').innerHTML='<div class="brand"><span class="brand-mark">'+svg('book')+'</span><span>Fang<em>School</em></span></div><div class="nav-label">'+tr('HỌC TẬP','STUDY','学习')+'</div>'+
 navs.filter(([k])=>k!=='exams'||catalog?.examCatalog).map(([k,i])=>'<button class="nav '+((page===k||(page==='lesson'&&k==='lessons'))?'active':'')+'" data-action="go:'+k+'">'+svg(i)+esc(title(k))+'</button>').join('')+
 (viewer.admin?'<div class="nav-label">QUẢN LÝ</div><a class="nav" href="/admin">'+svg('teacher')+'Quản lý quyền</a><button class="nav '+(page==='teacher'?'active':'')+'" data-action="go:teacher">'+svg('book')+esc(title('teacher'))+'</button>':'')+
 '<div class="side-foot"><div><b>'+esc(viewer.email)+'</b>'+button('Đăng xuất','logout')+'</div></div>';

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
const skills=()=>'<section class="skills"><div class="section-head"><h2>'+tr('Luyện theo kỹ năng','Practice by skill','分技能练习')+'</h2></div><div class="grid4">'+skillNames.map((i,j)=>'<button class="skill" data-action="preset:'+i+'"><span class="iconbox">'+svg(['text','book','head','shuffle'][j])+'</span><b>'+esc(kinds[i])+'</b></button>').join('')+'</div></section>';
function home(){
 const wrong=wrongQuestions().length, unknown=Object.values(state.words).filter(x=>x==='unknown').length;
 return '<section class="hero"><div><span class="eyebrow">FANGSCHOOL · TIẾNG TRUNG</span><h1>'+courseName+tr(' — Trung tâm ôn tập',' — Review center',' — 复习中心')+'</h1><p>'+tr('Ôn '+lessonCount()+' bài và luyện thêm từ vựng, ngữ pháp, nghe và đọc theo cấp độ.','Review '+lessonCount()+' lessons and practice with new examples.','复习 '+lessonCount()+' 课，并用新例句练习。')+'</p><div class="wrap">'+button(quiz&&!quiz.done?tr('Tiếp tục lượt ôn','Resume practice','继续答题'):tr('Tiếp tục học','Continue learning','继续学习'),quiz&&!quiz.done?'go:quiz':'go:lesson/'+state.last,'arrow','primary')+button('Luyện theo cấp HSK','go:bank','target','secondary')+'</div></div><div class="hero-art" aria-hidden="true"><i class="orbit"></i><i class="orbit two"></i><div class="tile back">习</div><div class="tile front">复</div><span class="spark">✦</span><span class="spark bottom">✦</span></div></section>'+
 statCards()+'<div class="body-grid"><section><div class="section-head"><div><h2>'+tr('Lộ trình '+lessonCount()+' bài',lessonCount()+'-lesson course','课程路线')+'</h2><p>'+tr('Chọn bài để xem lại nội dung đã học','Choose a lesson to review','选择一课开始复习')+'</p></div>'+button(expanded?'Thu gọn':'Xem tất cả','expand','chev')+'</div><div class="lessons">'+lessons.slice(0,expanded?lessons.length:6).map(lessonCard).join('')+'</div></section>'+
 '<aside class="stack"><section class="panel quick"><div class="iconbox warm">'+svg('bolt')+'</div><h3>'+tr('Ôn tập nhanh','Quick practice','快速复习')+'</h3><p>'+tr('10 câu có chấm điểm, trộn từ nhiều bài.','10 scored questions from several lessons.','十道来自不同课程的评分题。')+'</p>'+button(tr('Bắt đầu ôn nhanh','Start practice','开始复习'),'quick','arrow','primary')+'</section><section class="panel"><h3>'+tr('Cần ôn lại','Review list','待复习')+'</h3><button class="review-link" data-action="go:review"><span>'+svg('bookmark')+' Những từ chưa thuộc</span><b>'+unknown+'</b></button><button class="review-link" data-action="go:review"><span>'+svg('target')+' Câu trả lời sai</span><b>'+wrong+'</b></button></section></aside></div>'+skills();
}
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
const stageInfo=(label,title,description)=>'<header class="practice-stage"><span class="label">'+esc(label)+'</span><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></header>';
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
 const original=getLesson(lesson).dialogues.find(d=>d.part===+part);
 return (original?button('Nghe bản thu gốc','original-audio:'+lesson+':'+original.i,'audio','','aria-pressed="false"'):'')+
  (selectedReader()==='current'?'':audioButton(text,'Nghe bản đọc bài khóa','',true));
}
const flashcardVoiceControls=word=>readerControls()+'<div class="wrap" aria-live="polite">'+audioButton(voiceKey(word.zh,word.pinyin),'Phát âm','primary')+'</div>';
const dialogueAudio=(lesson,dialogue)=>{
 const text=dialogue.utterances.map(x=>x.zh).join(' ');
 const original=Boolean(dialogue.recording)||course===2&&Object.hasOwn(audioFiles,'original-'+lesson.n+'-'+dialogue.i+'.mp3');
 const recorded='hsk4-recording:'+lesson.n+':'+dialogue.part;
 const selected=selectedReader();
 const alternate=dialogue.recording&&selected==='current'?'':audioButton(dialogue.recording?recorded:text,'Nghe toàn bài',original?'':'primary',original);
 return alternate+(original?button('Nghe bản thu gốc','original-audio:'+lesson.n+':'+dialogue.i,'audio','primary','aria-pressed="false"'):'');
};
function lessonPage(n,tab='vocab'){
 const l=getLesson(n),w=l.vocab[flash]??l.vocab[0];
 if(l.n>=100&&tab==='vocab')tab='extra';
 const tabs=[['vocab','Từ vựng'],['grammar','Ngữ pháp'],['listen','Hội thoại & nghe'],['ex','Bài luyện'],['extra','Luyện mở rộng'],['final','Kiểm tra cuối bài']].filter(([key])=>l.n<100||!['vocab','listen','final'].includes(key));
 let body='';
 if(tab==='vocab'&&w){
  body='<div class="detail"><section class="panel"><div class="row split"><h2>Flashcard</h2><small>'+((l.vocab.indexOf(w))+1)+' / '+l.vocab.length+'</small></div><button class="flash" data-action="flip" aria-pressed="'+flip+'"><b class="han" lang="zh-CN">'+esc(w.zh)+'</b>'+(flip?'<span>'+esc(w.pinyin)+'</span><span>'+esc(w.vi)+'</span>':'<small>Chạm để xem pinyin và nghĩa</small>')+'</button><div class="wrap">'+flashcardVoiceControls(w)+button('Chưa thuộc','word:unknown:'+w.id,'bookmark',state.words[w.id]==='unknown'?'danger':'')+button('Đã thuộc','word:known:'+w.id,'check',state.words[w.id]==='known'?'primary':'')+'</div><div class="row split form-actions">'+button('‹ Từ trước','flash:-1')+button('Từ tiếp ›','flash:1')+'</div>'+(flip&&w.examples?.length?'<div class="info lines">'+esc(w.examples.join('\n'))+'</div>':'')+'</section><section class="panel"><div class="section-head"><h3>'+l.vocab.length+' từ vựng</h3>'+button('Luyện từ','lessonquiz:'+l.n+':0','arrow','primary')+'</div><div class="list-items">'+l.vocab.map((x,i)=>'<button class="list-item '+(x.id===w.id?'active':'')+'" data-action="pickflash:'+i+'"><b class="han">'+esc(x.zh)+'</b><small>'+esc(x.pinyin)+'</small>'+(state.words[x.id]==='known'?svg('check'):state.words[x.id]==='unknown'?svg('bookmark'):'')+'</button>').join('')+'</div></section></div>';
  body+=nextStage(l,'grammar','Tiếp theo · Ngữ pháp');
 }else if(tab==='grammar'){
  body=grammarStage(l);
 }else if(tab==='listen'){
  body=listenStage(l);
 }else if(tab==='ex'){
  body=exerciseStage(l);
 }else if(tab==='extra'){
  body=transferStage(l);
 }else if(tab==='final'){
  body=finalStage(l);
 }else body=inform('Chưa có nội dung cho mục này.');
 return button('‹ Tất cả bài học','go:lessons')+'<div class="heading"><div class="lesson-title">'+badge(lessonLabel(l.n))+badge(courseName)+'</div><h1 class="han" lang="zh-CN">'+esc(l.zh)+'</h1><p>'+esc(l.vi)+'</p></div><div class="tabs">'+tabs.map(([k,t])=>button(t,'go:lesson/'+l.n+'/'+k,'',tab===k?'active':'')).join('')+'</div>'+body;
}
const curriculumItems=(l,mode)=>l.questions.filter(q=>q.origin==='curriculum'&&q.mode===mode&&(!q.audio||canPlay(q.audio,q.pinyin)));
function grammarStage(l){
 const points=l.grammarPoints??[];
 const sample=(zh,py,vi)=>'<div class="example-block"><strong class="han" lang="zh-CN">'+esc(zh)+'</strong><span>'+esc(py)+'</span><small>'+esc(vi)+'</small></div>';
 const note=l.note?'<section class="panel grammar-note"><h3 class="han">'+esc(l.note[0])+'</h3><p>'+esc(l.note[1])+'</p><p><strong>Điểm dễ nhầm</strong> · '+esc(l.note[2])+'</p></section>':'';
 const cards=points.map(point=>'<article class="panel grammar-card"><h3 class="han">'+esc(point.pattern)+'</h3><p>'+esc(point.explanation)+'</p>'+sample(point.zh,point.pinyin,point.vi)+'<div class="wrap">'+audioButton(voiceKey(point.zh,point.pinyin),'Nghe ví dụ')+questionAction(point.questions[0],'Thử mẫu này')+'</div></article>').join('');
 const practice=l.questions.filter(q=>lessonSkill(q)==='grammar'&&[1,4].includes(q.kind)&&!q.resource&&q.answers?.length);
 const activity=mastery(practice);
 const modes=['apply','order','correct','translate'].map(mode=>{
  const items=curriculumItems(l,mode);
  return items.length?button(grammarModes[mode]+' · '+items.length,'grammar-mode:'+l.n+':'+mode):'';
 }).join('');
 const more=l.focus.map(q=>'<article class="panel grammar-card"><h3 class="han" lang="zh-CN">'+esc(q.answers[0])+'</h3><p>'+esc(q.explanation)+'</p>'+sample(q.zh,q.pinyin,q.vi)+'<div class="wrap">'+audioButton(voiceKey(q.zh,q.pinyin),'Nghe ví dụ')+questionAction(q,'Thử mẫu này')+'</div></article>').join('');
 const hasExamples=[...points,...l.focus].some(example=>canPlay(example.zh,example.pinyin));
 return stageInfo('Bước 1','Hiểu và dùng mẫu câu','Đọc cấu trúc, xem ví dụ rồi chọn dạng bài để tự áp dụng.')+note+
 (hasExamples?'<div class="form-actions">'+readerControls()+'</div>':'')+
 '<div class="stage-grid form-actions">'+cards+'</div>'+
 (practice.length?'<section class="panel form-actions"><h3>Luyện ngữ pháp trong bài</h3><p>'+activity.done+'/'+practice.length+' câu ngữ pháp đã luyện'+(activity.wrong?' · '+activity.wrong+' câu sai gần nhất':'')+'</p><div class="wrap form-actions">'+button('Luyện trộn','grammar-mode:'+l.n+':mixed','arrow','primary')+modes+(activity.wrong?button('Làm lại câu sai','lesson-weak:'+l.n+':grammar','target'):'')+'</div></section>':'')+
 (more?'<details class="panel source form-actions"><summary>Ví dụ và mẫu câu khác · '+l.focus.length+'</summary><div class="stage-grid form-actions">'+more+'</div></details>':'')+
 (l.n<100?nextStage(l,'listen','Tiếp theo · Nghe hiểu'):nextStage(l,'extra','Tiếp theo · Luyện ngữ âm'));
}
function listenStage(l){
 const listening=courseQuiz(l,'listen'),secondListening=courseQuiz(l,'listen2'),reading=courseQuiz(l,'read');
 const playable=listening&&canPlay(listening.audio,listening.pinyin);
 const dictation=l.questions.filter(q=>q.kind===2&&q.audio&&!q.options&&q.answers?.length&&canPlay(q.audio,q.pinyin));
 const transcript=l.dialogues.map((d,i)=>'<details class="panel source"><summary>'+(d.recording?'Bài khóa · Phần ':'Hội thoại ')+(i+1)+'</summary><div class="wrap form-actions">'+dialogueAudio(l,d)+'</div>'+d.utterances.map(u=>'<div class="dialogue-row row split"><div><small>'+esc(u.who)+'</small>'+(!settings.hideZh?' <strong class="han" lang="zh-CN">'+esc(u.zh)+'</strong>':'')+(!settings.hidePy&&u.pinyin?'<p>'+esc(u.pinyin)+'</p>':'')+(settings.showVi?'<p>'+esc(u.vi||'Chưa có bản dịch cho câu này.')+'</p>':'')+'</div>'+audioButton(voiceKey(u.zh,u.pinyin),'Nghe')+'</div>').join('')+'</details>').join('');
 return stageInfo('Bước 2','Nghe để lấy ý','Đọc câu hỏi trước để biết cần nghe thông tin gì. Thử ở 1× rồi dùng 0,75× khi cần nghe lại.')+
 '<section class="panel"><div class="row split"><div><h3>'+esc(l.scenario?.topic??'Luyện nghe')+'</h3><p>'+esc(l.scenario?.prompt??'')+ '</p></div>'+readerControls()+'</div><div class="wrap form-actions">'+(playable?questionAction(listening,'Nghe và trả lời','primary'):'')+(secondListening&&canPlay(secondListening.audio)?questionAction(secondListening,'Nghe và trả lời · Phần 2'):'')+questionAction(reading,'Đọc và trả lời')+ (curriculumItems(l,'listen').length?button('Nghe và nhận diện cấu trúc','grammar-mode:'+l.n+':listen','head'):'')+ (dictation.length?button('Luyện nghe chép lại','lesson-dictation:'+l.n,'head'):'')+'</div></section>'+
 '<h3 class="form-actions">Hội thoại · nghe và đối chiếu</h3><div class="wrap form-actions">'+audioToggles()+'</div><div class="stack form-actions">'+transcript+'</div>'+nextStage(l,'ex','Tiếp theo · Bài luyện');
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
function bank(){
 const attempted=new Set(state.attempts.map(a=>a.id));
 const words=wordlist.filter(w=>w.level<=course);
 const breakdown=bankNames.map(group=>{
  const items=levelQuestions.filter(q=>q.group===group),done=items.filter(q=>attempted.has(q.id)).length;
  return '<article class="panel"><h3>'+esc(bankGroups[group])+'</h3><p>'+done+'/'+items.length+' câu đã thử</p>'+meter(Math.round(100*done/items.length))+'</article>';
 }).join('');
 const reviewWords=words.map(w=>'<tr data-word-search="'+esc(searchText(w.zh+' '+w.readings.join(' ')+' '+w.vi))+'"><td class="han" lang="zh-CN">'+esc(w.zh)+'</td><td>'+esc(w.pinyin)+'</td><td>'+esc(w.vi)+'</td><td>HSK '+w.level+'</td></tr>').join('');
 return heading('Luyện theo cấp · '+courseName,'Chọn kỹ năng để ôn theo trình độ, kể cả chủ điểm nằm ngoài bài bạn đang học.')+
 '<div class="grid4">'+breakdown+'</div>'+
 '<section class="panel form-actions"><form id="bank-form" class="filter"><div class="wrap">'+
 '<label>Kỹ năng<select name="group"><option value="">Tất cả</option>'+bankNames.map(group=>'<option value="'+group+'">'+esc(bankGroups[group])+'</option>').join('')+'</select></label>'+
 '<label>Phạm vi từ vựng<select name="layer"><option value="">Cấp hiện tại và nền tảng</option><option value="current">Chỉ từ mới của '+courseName+'</option></select></label>'+
 '<label>Chế độ<select name="mode"><option value="mixed">Trộn câu hỏi</option><option value="new">Câu chưa làm</option><option value="wrong">Làm lại câu sai</option></select></label>'+
 '<label>Số câu<select name="count"><option>10</option><option>20</option><option>30</option><option>50</option></select></label></div>'+
 '<div><button type="submit" class="btn primary">Bắt đầu luyện '+svg('arrow')+'</button></div></form></section>'+
 '<section class="panel form-actions"><details><summary>Tra từ vựng HSK 2.0 · '+words.length+' mục</summary><div class="row wrap form-actions"><label for="vocab-search">Tìm từ</label>'+
 '<input id="vocab-search" type="search" placeholder="Hán tự, pinyin hoặc nghĩa"><small id="vocab-count" role="status">'+words.length+' từ</small></div>'+
 '<div class="table-wrap"><table class="table"><thead><tr><th>Hán tự</th><th>Pinyin</th><th>Nghĩa</th><th>Cấp</th></tr></thead><tbody>'+reviewWords+'</tbody></table></div>'+
 '<small>Phân cấp và pinyin từ <a href="https://github.com/drkameleon/complete-hsk-vocabulary" target="_blank" rel="noopener">Complete HSK Vocabulary</a> · <a href="./hsk-vocabulary-LICENSE.txt">MIT</a></small></details></section>';
}

function practice(){
 return heading(...[tr('Ôn tập tổng hợp','Mixed review','综合复习'),tr('Tạo một lượt ôn từ những bài và kỹ năng bạn chọn.','Build a session from your chosen lessons and skills.','选择课程和技能，创建复习练习。')])+'<div class="detail"><form class="panel filter" id="practice-form"><fieldset><legend>Phạm vi bài học</legend><div class="wrap">'+button('Bài 1–5','range:5')+button('Bài 1–10','range:10')+button('Chọn tất cả','range:999')+'</div><div class="wrap form-actions">'+lessons.map(l=>'<label class="check"><input type="checkbox" name="lesson" value="'+l.n+'" checked>'+lessonLabel(l.n)+'</label>').join('')+'</div></fieldset><fieldset><legend>Kỹ năng</legend><div class="wrap">'+kinds.map((k,i)=>'<label class="check"><input type="checkbox" name="kind" value="'+i+'" '+(preset===null||preset===i?'checked':'')+'>'+esc(k)+'</label>').join('')+'</div></fieldset><div class="wrap"><label>Số câu<select name="count">'+[10,20,30,50].map(n=>'<option>'+n+'</option>').join('')+'</select></label><label>Nguồn câu hỏi<select name="origin"><option value="">Tất cả</option><option value="slides">Bài tập gốc và câu luyện theo bài</option><option value="extra">Luyện mở rộng theo bài</option><option value="bank">Kiến thức theo cấp HSK</option></select></label><label>Độ khó<select name="level"><option value="">Tất cả</option><option>Dễ</option><option>Trung bình</option><option>Khó</option></select></label><label>Chế độ<select name="mode"><option value="smart">Ôn tập thông minh</option><option value="random">Ngẫu nhiên</option><option value="wrong">Câu từng sai</option><option value="words">Từ chưa thuộc</option><option value="scored">Chỉ câu tự chấm</option></select></label></div><div class="wrap"><button class="btn primary">Bắt đầu ôn '+svg('arrow')+'</button><button class="btn" name="share" value="1">Tạo link đề</button></div><label class="check"><input type="checkbox" name="include-level"> Trộn thêm kho kiến thức theo cấp</label><div id="share-box"></div></form><aside class="panel"><h3>Ôn tập thông minh</h3><p>Ưu tiên câu sai gần nhất, từ chưa thuộc và nội dung ít được ôn. Mỗi câu chỉ xuất hiện một lần trong lượt.</p><div class="info">Câu tự luận chưa có đáp án sẽ lưu bài làm để tự đối chiếu. Các câu này không tính vào điểm.</div></aside></div>';
}
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
function quizPage(){
 if(!quiz)return heading('Chưa có lượt ôn')+button('Chọn nội dung luyện','go:practice','arrow','primary');
 const q=getQuestion(quiz.ids[quiz.index]);
 if(!q&&!quiz.done)return heading('Nội dung đã cập nhật')+button('Tạo lượt mới','go:practice','arrow','primary');
 if(quiz.done){
  const graded=quiz.answers.filter(a=>a.grade!==null),correct=graded.filter(a=>a.grade).length,wrong=graded.filter(a=>!a.grade);
  const skipped=quiz.answers.filter(a=>a.skipped).length;
  const breakdown=quiz.practicePaper?'<section class="stage-grid form-actions">'+practiceScores(quiz.practicePaper,quiz.answers).map(section=>'<article class="panel"><h3>'+esc(section.name)+'</h3><p>'+section.correct+'/'+section.graded+' đúng · '+section.total+' câu</p></article>').join('')+'</section>':quiz.final?'<section class="stage-grid form-actions">'+Object.entries(scoreSkills(quiz.answers)).map(([skill,v])=>'<article class="panel"><h3>'+lessonSkills[skill]+'</h3><p>'+v.correct+'/'+v.total+' đúng'+(v.skipped?' · '+v.skipped+' câu bỏ qua':'')+'</p></article>').join('')+'</section>':'';
  return '<div class="quiz">'+heading('Kết quả lượt ôn',quiz.title)+'<section class="panel"><div class="result">'+(graded.length?correct+' / '+graded.length:'—')+'</div><p>'+(quiz.answers.length-skipped)+' câu đã luyện · '+wrong.length+' câu sai · '+(quiz.answers.length-graded.length-skipped)+' câu tự đối chiếu'+(skipped?' · '+skipped+' câu bỏ qua':'')+'</p><div class="wrap form-actions">'+button('Làm lại lượt này','redo','shuffle','primary')+(wrong.length?button('Làm lại câu sai','redo-wrong','target'):'')+(quiz.returnTo?button(quiz.returnTo.startsWith('exams/')?'Về kho đề':'Về bài học','go:'+quiz.returnTo,'book','primary'):button('Xem tiến độ','go:progress','chart'))+'</div></section>'+breakdown+(quiz.answers.some(a=>{const x=getQuestion(a.id);return x&&canPlay(x.audio??x.zh,x.pinyin)})?readerControls():'')+'<div class="stack form-actions">'+quiz.answers.map(a=>{const x=getQuestion(a.id);return x?'<section class="panel answer-review"><div class="wrap">'+badge(a.skipped?'Đã bỏ qua':a.grade===true?'Đúng':a.grade===false?'Cần ôn lại':'Tự đối chiếu')+'</div><h3 class="lines">'+esc(x.prompt)+'</h3><p>Bạn trả lời · '+esc(a.value||'—')+'</p><p>Đáp án · '+esc(x.reference??x.answers?.[0]??'Đối chiếu cùng giáo viên.')+'</p><p>'+esc(x.explanation)+'</p>'+(x.pinyin?'<p>'+esc(x.pinyin)+'</p>':'')+(x.zh?'<p class="han lines">'+esc(x.zh)+'</p>':'')+((x.audio||x.zh&&canPlay(x.zh,x.pinyin))?questionAudio(x,'Nghe lại'):'')+(x.vi?'<p>'+esc(x.vi)+'</p>':'')+'</section>':''}).join('')+'</div></div>';
 }
 const a=quiz.answers[quiz.index],opts=quiz.options[q.id],marked=state.marks[q.id];
 const chunks=quiz.chunks?.[q.id];
 const selectedChunks=quiz.picked??[];
 const isGuidedOrder=chunks&&q.origin==='curriculum'&&!a;
 const orderUI=chunks&&!a?'<div class="wrap">'+chunks.map((chunk,i)=>button(chunk,'chunk:'+i,'','',selectedChunks.includes(i)?'disabled':'')).join('')+button('Xóa cụm đã chọn','clear-chunks')+'</div>':'';
 const options=opts?'<div class="stack">'+opts.map((o,i)=>{
  const good=a&&!quiz.assessment&&q.answers.some(x=>normalize(x)===normalize(o)),selected=(a?.value??quiz.selection)===o;
  return '<button type="button" class="option '+(good?'good':selected?(a&&!quiz.assessment?'bad':'selected'):'')+'" data-action="answer:'+i+'" '+(a?'disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span><span>'+esc(o)+'</span></button>';
 }).join('')+'</div>':'<textarea id="response" name="response" rows="3" placeholder="Nhập câu trả lời của bạn" '+(a||isGuidedOrder?'readonly':'')+' required>'+esc(a?.value??quiz.selection)+'</textarea>';
 const response=a&&quiz.assessment?'<div class="info" role="status">Đã lưu câu trả lời. Đáp án và điểm sẽ hiện sau khi nộp toàn bộ.</div>':a?'<div class="feedback '+(a.grade===true?'':'warn')+'" role="status"><h3>'+({true:'Chính xác!',false:'Cần ôn lại',null:'Đã lưu · Tự đối chiếu'}[String(a.grade)])+'</h3><p>Câu trả lời của bạn · '+esc(a.value)+'</p><p><strong>'+esc(q.reference?'Đáp án mẫu · '+q.reference:q.answers?.[0]??'Câu mở · Đối chiếu cùng giáo viên.')+'</strong></p>'+(a.grade===null&&(q.kind===4&&q.reference||q.origin==='curriculum'&&(q.order||q.mode==='correct'))?'<p>Đối chiếu ý và cấu trúc. Cách diễn đạt khác đáp án mẫu có thể vẫn đúng.</p>':'')+(q.zh?'<p class="han">'+esc(q.zh)+'</p>':'')+(q.pinyin?'<p>'+esc(q.pinyin)+'</p>':'')+(q.vi?'<p>'+esc(q.vi)+'</p>':'')+'<p>'+esc(q.explanation)+'</p>'+(q.zh&&!q.audio&&canPlay(q.zh,q.pinyin)?questionAudio(q,'Nghe lại'):'')+'</div>':'';
 return '<div class="quiz">'+heading(quiz.title)+'<div class="row split"><b>Câu '+(quiz.index+1)+' / '+quiz.ids.length+'</b><small>'+locationLabel(q)+'</small></div>'+meter(Math.round((quiz.index+(a?1:0))/quiz.ids.length*100))+'<section class="panel"><div class="wrap">'+badge(q.origin==='bank'?bankGroups[q.group]:kinds[q.kind])+badge(q.level)+badge(q.origin==='teacher'?'GIÁO VIÊN':q.origin==='bank'?'THEO CẤP HSK':q.origin==='guided'?'TÌNH HUỐNG':q.origin==='curriculum'?grammarModes[q.mode]:'THEO BÀI')+'</div><h2 class="prompt lines">'+esc(q.prompt)+'</h2>'+(q.audio?'<div class="form-actions">'+readerControls()+'<div class="wrap form-actions">'+questionAudio(q,'Nghe câu hỏi')+'</div></div>':a&&canPlay(q.zh,q.pinyin)?readerControls():'')+'<form id="answer-form"><div class="form-actions">'+orderUI+options+'</div>'+response+'<div class="wrap form-actions">'+(a?button(quiz.index+1===quiz.ids.length?(quiz.assessment?'Nộp bài':'Xem kết quả'):'Câu tiếp theo','next','arrow','primary'):'<button id="check-answer" class="btn primary" '+(opts&&!quiz.selection||isGuidedOrder&&selectedChunks.length!==chunks.length?'disabled':'')+'>'+(quiz.assessment?'Lưu câu trả lời':'Kiểm tra đáp án')+'</button>')+button(marked?'Đã đánh dấu':'Đánh dấu để ôn','mark:'+q.id,'bookmark',marked?'active':'')+(!a&&q.audio?button('Bỏ qua câu nghe','skip-audio'):'')+'</div></form></section>'+'</div>';
}
function review(){
 const wrong=wrongQuestions(),marked=questions.filter(q=>state.marks[q.id]),words=dueWords();
 const section=(title,list,action)=>'<section class="panel"><div class="row split"><h2>'+title+' · '+list.length+'</h2>'+(list.length?button('Luyện lại',action,'arrow','primary'):'')+'</div><div class="list-items">'+(list.length?list.map(q=>'<button class="list-item" data-action="one:'+esc(q.id)+'"><span><small>'+locationLabel(q)+'</small><br>'+esc(q.prompt.replace(/\n/g,' ').slice(0,145))+'</span></button>').join(''):'<p>Chưa có mục nào.</p>')+'</div></section>';
 return heading(tr('Cần ôn lại','Review list','待复习'))+'<div class="stack">'+section('Câu trả lời sai',wrong,'review-wrong')+section('Câu đã đánh dấu',marked,'review-marked')+'<section class="panel"><div class="row split"><h2>Từ chưa thuộc · '+words.length+'</h2>'+(words.length?button('Luyện từ','review-words','arrow','primary'):'')+'</div><div class="list-items">'+(words.length?words.map(w=>'<button class="list-item" data-action="word-link:'+w.n+':'+w.i+'"><b class="han">'+esc(w.zh)+'</b><small>'+esc(w.pinyin)+' · '+esc(w.vi)+'</small></button>').join(''):'<p>Đánh dấu từ chưa thuộc trong flashcard để xem ở đây.</p>')+'</div></section></div>';
}
function progress(){
 const g=graded(),correct=g.filter(a=>a.grade).length;
 return heading(tr('Tiến độ học tập','Your progress','学习进度'),'Lịch sử luyện tập, từ đã đánh dấu và kết quả được lưu theo email.')+statCards()+'<div class="body-grid"><section class="panel"><h2>Tiến độ theo bài</h2><div class="list-items">'+lessons.map(l=>{const total=l.questions.filter(q=>!q.resource).length,ids=new Set(l.questions.map(q=>q.id)),done=new Set(state.attempts.filter(a=>ids.has(a.id)).map(a=>a.id)).size;return '<div><div class="row split"><a href="#lesson/'+l.n+'">Bài '+l.n+' · <span class="han">'+esc(l.zh)+'</span></a><small>'+done+'/'+total+' câu</small></div>'+meter(total?Math.round(done/total*100):0)+'</div>'}).join('')+'</div></section><div class="stack"><section class="panel"><h2>Kết quả câu hỏi</h2><p>'+correct+' đúng · '+(g.length-correct)+' sai · '+(state.attempts.length-g.length)+' tự đối chiếu</p><h3 class="form-actions">Ngữ pháp cần ôn</h3><div class="list-items">'+(wrongQuestions().filter(x=>lessonSkill(x)==='grammar').slice(0,12).map(q=>'<button class="list-item" data-action="one:'+q.id+'">Bài '+q.lesson+' · '+esc(q.zh??q.prompt)+'</button>').join('')||'<p>Chưa có câu ngữ pháp sai.</p>')+'</div></section><section class="panel"><h2>Lịch sử kiểm tra</h2><div class="list-items">'+(state.history.slice(-12).reverse().map(h=>'<div class="dialogue-row"><b>'+esc(catalog.examCatalog?.papers.find(paper=>paper.id===h.examCode)?.title??h.title)+'</b><p>'+h.correct+'/'+h.graded+' đúng · '+new Date(h.at).toLocaleString('vi-VN')+'</p></div>').join('')||'<p>Chưa hoàn thành lượt ôn nào.</p>')+'</div></section></div></div>';
}
const jsonExample={questions:[{kind:4,slide:32,level:'Khó',prompt:'Dịch sang tiếng Trung…',answers:['Câu trả lời mẫu'],explanation:'Giải thích bằng tiếng Việt.',pinyin:'',vi:'',zh:''}]};
function teacher(){
 const l=getLesson(teacherLesson);
 return '<div class="teacher">'+heading(tr('Khu vực giáo viên','Teacher workspace','教师工作区'),'Quản lý học liệu và tạo đề ôn tập cho '+courseName+'.')+inform('Chỉnh sửa và nhập JSON được lưu trên trình duyệt này. Báo cáo theo học viên cần hệ thống đăng nhập và cơ sở dữ liệu.','warn')+'<div class="panel wrap"><label>Bài học <select id="teacher-lesson">'+lessons.map(x=>'<option '+(l.n===x.n?'selected':'')+' value="'+x.n+'">Bài '+x.n+' · '+esc(x.zh)+'</option>').join('')+'</select></label>'+button('Tạo đề theo phạm vi bài','go:practice','shuffle','primary')+'</div><section class="panel"><h2>Nguồn bài '+l.n+'</h2><p>'+l.slides.length+' slide · '+l.vocab.length+' từ · '+l.questions.length+' câu và bài tập</p><div class="list-items"><details class="source"><summary>Từ vựng đã tách</summary><div class="table-wrap"><table class="table"><thead><tr><th>Hán tự</th><th>Pinyin</th><th>Nghĩa</th><th>Slide</th></tr></thead><tbody>'+l.vocab.map(w=>'<tr><td>'+esc(w.zh)+'</td><td>'+esc(w.pinyin)+'</td><td>'+esc(w.vi)+'</td><td>'+w.slide+'</td></tr>').join('')+'</tbody></table></div></details><details class="source"><summary>Chọn câu để chỉnh sửa</summary><div class="list-items">'+l.questions.map(q=>'<button class="list-item" data-action="edit:'+esc(q.id)+'">'+(q.slide?'Slide '+q.slide+' · ':'')+esc(q.prompt.slice(0,100))+'</button>').join('')+'</div></details></div></section><form id="edit-form" class="panel"><h2>Thêm hoặc chỉnh sửa câu hỏi</h2><p>Số slide là thông tin tham chiếu tùy chọn. Để trống mảng đáp án cho câu tự đối chiếu.</p><div class="wrap form-actions"><label>Nhập JSON <input id="import" type="file" accept=".json,application/json"></label>'+button('Mẫu JSON','example')+'</div><textarea class="form-actions" id="json" aria-label="Dữ liệu câu hỏi JSON" required>'+esc(JSON.stringify(jsonExample,null,2))+'</textarea><div class="wrap form-actions"><button class="btn primary">Lưu cho bài '+l.n+'</button><a href="#lesson/'+l.n+'">Xem bài dành cho học viên →</a></div></form></div>';
}
function render(){
 const [page='home',n,tab]=(location.hash.slice(1)||'home').split('/');
 chrome(page);
 $('app').innerHTML=({home,lessons:()=>heading(tr('Danh sách bài · '+courseName,'Lessons · '+courseName,'课程 · '+courseName),'Chọn bài để học theo chủ điểm và luyện các kỹ năng.')+'<div class="lessons">'+lessons.map(lessonCard).join('')+'</div>',lesson:()=>lessonPage(n,tab),bank,exams:()=>exams.page(n,tab),practice,quiz:quizPage,progress,review,teacher:viewer.admin?teacher:home}[page]??home)();
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
  case 'flip':flip=!flip;render();document.querySelector('.flash')?.focus();break;
  case 'flash':{stopAudio();const length=getLesson(state.last).vocab.length;flash=(flash+(+x)+length)%length;flip=false;render();break}
  case 'pickflash':stopAudio();flash=+x;flip=false;render();break;
  case 'word-link':state.last=+x;save();flash=+y;flip=false;go('lesson/'+x);break;
  case 'word':state.words[y]=x;save();render();notify(x==='known'?'Đã đánh dấu thuộc từ.':'Đã thêm từ vào danh sách cần ôn.');break;
  case 'preset':preset=+x;go('practice');break;
  case 'range':document.querySelectorAll('[name="lesson"]').forEach(i=>i.checked=Number(i.value)<=+x);break;
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
document.addEventListener('input',e=>{
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
 if(t.id==='import'&&t.files[0]){try{const text=await t.files[0].text();JSON.parse(text);$('json').value=text;notify('Đã đọc JSON. Chọn Lưu để áp dụng cho bài.')}catch{notify('Không đọc được JSON. Hãy kiểm tra định dạng.')} }
});
document.addEventListener('submit',e=>{
 e.preventDefault();
 if(e.target.id==='answer-form'){const q=getQuestion(quiz.ids[quiz.index]);if(q.origin==='curriculum'&&q.order&&(quiz.picked?.length??0)!==q.order.length)return;submitAnswer(q.options?.length||q.origin==='curriculum'&&q.order?quiz.selection:$('response')?.value??'');return}
 if(e.target.id==='bank-form'){
  const form=new FormData(e.target),group=form.get('group'),mode=form.get('mode');
  const attempted=new Set(state.attempts.map(a=>a.id));
  const wrong=new Set(wrongQuestions().map(q=>q.id));
  const pool=levelQuestions.filter(q=>(!group||q.group===group)
   &&(form.get('layer')!=='current'||q.group!=='vocab'||q.wordLevel===course)
   &&(mode!=='new'||!attempted.has(q.id))&&(mode!=='wrong'||wrong.has(q.id)));
  start(pool,courseName+' · '+(bankGroups[group]??'Luyện tổng hợp'),Math.min(Number(form.get('count')),pool.length),group?'random':'balanced');
 }
 if(e.target.id==='practice-form'){
  const f=new FormData(e.target),ns=f.getAll('lesson').map(Number),skills=f.getAll('kind').map(Number),level=f.get('level'),mode=f.get('mode'),origin=f.get('origin'),count=+f.get('count');
  const wrong=new Set(wrongQuestions().map(q=>q.id));
  const pool=questions.filter(q=>(q.origin==='bank'?origin==='bank'||!origin&&f.has('include-level'):ns.includes(q.lesson))&&skills.includes(q.kind)&&(!level||q.level===level)&&(!origin||(origin==='extra'?['extra','guided','curriculum'].includes(q.origin):origin==='bank'?q.origin==='bank':['original','practice'].includes(q.origin)))&&!q.resource&&(mode!=='wrong'||wrong.has(q.id))&&(mode!=='words'||state.words[q.word]==='unknown')&&(mode!=='scored'||q.answers?.length));
  if(e.submitter?.name==='share'){
   const ids=shuffle(pool.filter(q=>q.origin!=='teacher')).slice(0,count).map(q=>q.id);
   if(!ids.length){notify('Chưa có câu gốc phù hợp để tạo link.');return}
   const u=new URL(location.href);u.hash='';u.search=baseQuery;u.searchParams.set('de',ids.join(','));copyLink(u.href);
  }else start(pool,'Ôn tập tổng hợp',count,mode);
 }
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
  if(access.maxLevel<course){location.assign('/');return false}
  if(access.maxLevel!==viewer.maxLevel){location.reload();return false}
  return true;
 }catch{return false}
}
syncProgress=await openProgress(course,()=>storage('progress',null),value=>persist('progress',value),()=>location.reload(),()=>notify('Chưa đồng bộ được tiến độ. Bản lưu trên thiết bị vẫn còn.'));
state=syncProgress.state;
window.addEventListener('focus',stillAllowed);
setInterval(stillAllowed,30_000);
setTimeout(stillAllowed,Math.min(2_147_000_000,Math.max(0,viewer.expiresAt-Date.now()+100)));
try{
 const result=await fetch('/learning/'+course+'.json');
 if(result.status===401||result.status===403){location.assign('/');throw new Error('Phiên học đã hết hạn.')}
 if(!result.ok)throw new Error('Nguồn dữ liệu không khả dụng.');
 catalog=await result.json();
 wordlist=catalog.wordlist;
 audioFiles=catalog.audioFiles;
 exams=createExamCenter({course,catalog:catalog.examCatalog,storage,persist,heading,esc,button,history:()=>state.history,save,render,go,requireAccess:stillAllowed,activePractice:()=>quiz&&!quiz.done?quiz.practicePaper?.id:null});
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
