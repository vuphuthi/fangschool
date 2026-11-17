const byId=id=>document.getElementById(id);
const node=(tag,text,css)=>{
 const el=document.createElement(tag);
 if(text!==undefined)el.textContent=text;
 if(css)el.className=css;
 return el;
};
const rows=value=>Array.isArray(value)?value.filter(item=>item!==null&&typeof item==='object'):[];
const records=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.entries(value):[];
const str=(value,fallback='—')=>typeof value==='string'&&value.trim()?value:fallback;
const integer=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const number=value=>integer(value).toLocaleString('vi-VN');
const validTime=value=>Number.isSafeInteger(value)&&value>0&&value<=8.64e15?value:0;
const date=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
const dateText=time=>validTime(time)?date.format(time):'—';
const newest=(left,right)=>validTime(right.at)-validTime(left.at);
const skillNames=['Từ vựng','Ngữ pháp','Nghe','Đọc hiểu','Dịch và viết','Bài tập về nhà'];
const explicitSkills={vocab:'Từ vựng',grammar:'Ngữ pháp',listen:'Nghe',reading:'Đọc hiểu',writing:'Dịch và viết'};
const statusLabels={true:'Đúng',false:'Sai',null:'Tự đối chiếu'};
const labelFor=lesson=>lesson>=100?'Ngữ âm '+(lesson-100):'Bài '+lesson;
const normalizeAnswer=value=>str(value,'').normalize('NFKC').replace(/[\s，。！？、；：,.!?;:]/gu,'');

function table(headers,items,fields){
 const grid=node('table',undefined,'table report-table');
 const thead=grid.createTHead(), head=thead.insertRow();
 for(const title of headers){const cell=node('th',title);cell.scope='col';head.append(cell)}
 const body=grid.createTBody();
 for(const item of items){
  const tr=body.insertRow();
  for(const value of fields(item)){const td=tr.insertCell();if(value instanceof Node)td.append(value);else td.textContent=value}
 }
 const wrap=node('div',undefined,'table-wrap');wrap.append(grid);
 return wrap;
}

function pagedList(items,headers,fields,empty,filter){
 const wrapper=node('div');
 if(!items.length){wrapper.append(node('p',empty));return wrapper}
 const display=node('div'),navigation=node('div',undefined,'wrap report-pages');
 const counter=node('small');counter.setAttribute('role','status');
 const previous=node('button','‹ Trang trước','btn');
 const next=node('button','Trang tiếp ›','btn');
 previous.type=next.type='button';
 navigation.append(previous,counter,next);
 let page=0,visible=items;
 const pageSize=15;
 function view(){
  const last=Math.max(0,Math.ceil(visible.length/pageSize)-1);
  page=Math.min(last,Math.max(0,page));
  display.replaceChildren(visible.length?table(headers,visible.slice(page*pageSize,(page+1)*pageSize),fields):node('p',empty));
  counter.textContent=visible.length?'Trang '+(page+1)+'/'+(last+1)+' · '+number(visible.length)+' mục':'0 mục';
  previous.disabled=page===0;
  next.disabled=page>=last;
  navigation.hidden=visible.length<=pageSize;
 }
 previous.addEventListener('click',()=>{page--;view()});
 next.addEventListener('click',()=>{page++;view()});
 if(filter){
  const label=node('label','Kết quả', 'report-filter');
  const select=node('select');
  for(const [key,text] of [['all','Tất cả'],['wrong','Sai'],['correct','Đúng'],['review','Tự đối chiếu'],['viewed','Đã xem, chưa trả lời']].filter(([key])=>key!=='viewed'||items.some(item=>filter(item)==='viewed'))){
   const option=node('option',text);option.value=key;select.append(option);
  }
  select.addEventListener('change',()=>{
   visible=select.value==='all'?items:items.filter(item=>filter(item)===select.value);
   page=0;view();
  });
  label.append(select);wrapper.append(label);
 }
 wrapper.append(display,navigation);view();
 return wrapper;
}

function addGroup(parent,title,content,open=false){
 const details=node('details',undefined,'report-group');
 details.open=open;
 details.append(node('summary',title),content);
 parent.append(details);
}

function examResponses(history,paperById){
 const exams=history.filter(item=>item.examCode&&records(item.responses).length);
 if(!exams.length)return null;
 const wrapper=node('div'),label=node('label','Lượt làm đề','report-filter'),select=node('select');
 const view=node('div');
 for(const [index,attempt] of exams.entries()){
  const paper=paperById.get(attempt.examCode);
  const option=node('option',str(attempt.title,str(paper?.title))+' · '+dateText(attempt.at));
  option.value=String(index);select.append(option);
 }
 function update(){
  const exam=exams[Number(select.value)],paper=paperById.get(exam.examCode);
  const responseByNumber=new Map(records(exam.responses));
  const numbers=Array.isArray(paper?.answerKey)?paper.answerKey.map((_,index)=>String(index+1)):[...responseByNumber.keys()];
  view.replaceChildren(pagedList(numbers,['Câu','Phần','Học viên trả lời','Đáp án hoặc bài mẫu','Kết quả'],value=>{
   const n=Number(value),given=responseByNumber.get(value),key=paper?.answerKey?.[n-1];
   const schema=paper?.questionTypes?.find(([first,last])=>n>=first&&n<=last)?.[2];
   const part=paper?.sections?.find(([,first,last])=>n>=first&&n<=last)?.[0];
   const candidates=Array.isArray(key)?key:key?[key]:[];
   const reference=candidates.length?candidates:paper?.writingExamples?.[n]??[];
   const label=value=>schema==='TF'?(value==='T'?'Đúng':value==='F'?'Sai':value):value;
   const normalized=normalizeAnswer(given);
   const match=normalized&&candidates.some(candidate=>normalizeAnswer(candidate)===normalized);
   const outcome=key===null?'Tự đối chiếu':!given?'Bỏ trống':!candidates.length?'—':match?'Đúng':schema==='sentence'?'Cần đối chiếu':'Sai';
   return [value,str(part),label(str(given,'Bỏ trống')),reference.map(label).join(' / ')||'—',outcome];
  },'Chưa lưu phiếu trả lời cho lượt này.'));
 }
 label.append(select);wrapper.append(label,view);select.addEventListener('change',update);update();
 return wrapper;
}

function viewedContent(state,attempts,history){
 const answered=new Set(attempts.map(attempt=>attempt.id));
 const submitted=new Set(history.map(item=>item.examCode??item.practicePaper).filter(Boolean));
 const questions=records(state.views?.questions)
  .filter(([,time])=>validTime(time)).map(([id,at])=>({id,at,answered:answered.has(id)})).sort(newest);
 const byExam=new Map();
 for(const [key,at] of records(state.views?.examPages)){
  const match=key.match(/^([a-z0-9-]+):(\d{1,3})$/);
  if(!match||!validTime(at))continue;
  const [,id,page]=match;
  const item=byExam.get(id)??{id,at:0,pages:new Set(),submitted:submitted.has(id)};
  item.at=Math.max(item.at,at);item.pages.add(Number(page));byExam.set(id,item);
 }
 return {questions,exams:[...byExam.values()].sort(newest)};
}

function summarize(state,catalog){
 const lessons=rows(catalog.lessons).filter(lesson=>Number.isInteger(lesson.n));
 const questionById=new Map(),wordById=new Map();
 for(const lesson of lessons){
  for(const q of rows(lesson.questions))if(typeof q.id==='string')questionById.set(q.id,q);
  for(const word of rows(lesson.vocab))if(typeof word.id==='string')wordById.set(word.id,{...word,lesson:lesson.n});
 }
 for(const q of rows(catalog.levelQuestions))if(typeof q.id==='string')questionById.set(q.id,q);
 const paperById=new Map(rows(catalog.examCatalog?.papers).map(paper=>[paper.id,paper]));
 const attempts=rows(state.attempts).filter(item=>typeof item.id==='string'&&!item.skipped).sort(newest);
 const history=rows(state.history).sort(newest);
 const words=records(state.words).filter(([,status])=>status==='known'||status==='unknown');
 const known=words.filter(([,status])=>status==='known').length;
 const correct=attempts.filter(attempt=>attempt.grade===true).length;
 const incorrect=attempts.filter(attempt=>attempt.grade===false).length;
 const complete=new Set(history.map(item=>item.final).filter(n=>Number.isInteger(n)));
 const viewed=viewedContent(state,attempts,history);
 const maxActivity=Math.max(validTime(attempts[0]?.at),validTime(history[0]?.at),viewed.questions[0]?.at??0,viewed.exams[0]?.at??0);
 const byLesson=new Map(),bySkill=new Map();
 for(const attempt of attempts){
  const q=questionById.get(attempt.id);
  const skill=q?(explicitSkills[q.skill]??skillNames[q.kind]):null;
  if(q?.origin!=='bank'&&Number.isInteger(q?.lesson)){
   const current=byLesson.get(q.lesson)??{ids:new Set(),correct:0,graded:0};
   current.ids.add(attempt.id);
   if(attempt.grade===true)current.correct++;
   if(typeof attempt.grade==='boolean')current.graded++;
   byLesson.set(q.lesson,current);
  }
  if(skill&&typeof attempt.grade==='boolean'){
   const current=bySkill.get(skill)??{correct:0,graded:0};
   current.graded++;
   if(attempt.grade)current.correct++;
   bySkill.set(skill,current);
  }
 }
 return {lessons,questionById,wordById,paperById,attempts,history,words,known,correct,incorrect,complete,maxActivity,byLesson,bySkill,viewed};
}

const badge=(text,k)=>{const el=node('span',text,'badge');el.dataset.k=k;return el};
const percent=(a,b)=>b?Math.round(100*a/b):0;
const scaledScore=item=>rows(item.sections).reduce((sum,section)=>sum+percent(integer(section.correct),integer(section.graded??section.total)),0);
function stack(...children){const el=node('div',undefined,'cell-stack');for(const child of children)if(child!==null&&child!==undefined)el.append(child);return el}
function bar(value){const outer=node('div',undefined,'bar thin'),inner=node('i');inner.style.width=value+'%';outer.append(inner);return outer}

function tabbed(definitions){
 const wrapper=node('div',undefined,'report-tabs'),strip=node('div',undefined,'segmented'),panel=node('div',undefined,'report-tab-panel');
 strip.setAttribute('role','tablist');strip.setAttribute('aria-label','Phần báo cáo');
 const buttons=definitions.map(([label,build],index)=>{
  const button=node('button',label,'btn');button.type='button';button.setAttribute('role','tab');
  button.addEventListener('click',()=>select(index));
  return button;
 });
 function select(index){
  buttons.forEach((button,i)=>button.setAttribute('aria-selected',String(i===index)));
  panel.replaceChildren(definitions[index][1]());
 }
 strip.append(...buttons);wrapper.append(strip,panel);select(0);
 return wrapper;
}

function questionRows(report){
 const latest=new Map(),counts=new Map();
 for(const attempt of [...report.attempts].reverse()){latest.set(attempt.id,attempt);counts.set(attempt.id,(counts.get(attempt.id)??0)+1)}
 const items=new Map();
 for(const view of report.viewed.questions)items.set(view.id,{id:view.id,at:view.at});
 for(const [id,attempt] of latest){const item=items.get(id)??{id,at:0};item.at=Math.max(item.at,validTime(attempt.at));item.attempt=attempt;items.set(id,item)}
 return [...items.values()].map(item=>({...item,count:counts.get(item.id)??0})).sort(newest);
}
const questionState=item=>!item.attempt?['Đã xem, chưa trả lời','muted','viewed']:item.attempt.grade===true?['Đúng','ok','correct']:item.attempt.grade===false?['Sai','bad','wrong']:['Tự đối chiếu','warn','review'];

function examRows(report){
 const byId=new Map(report.viewed.exams.map(item=>[item.id,{...item}]));
 for(const item of report.history.filter(entry=>entry.examCode)){
  const row=byId.get(item.examCode)??{id:item.examCode,at:0,pages:new Set(),submitted:true};
  row.at=Math.max(row.at,validTime(item.at));row.submitted=true;
  if(!row.best||scaledScore(item)>scaledScore(row.best))row.best=item;
  row.attempts=(row.attempts??0)+1;
  byId.set(item.examCode,row);
 }
 return [...byId.values()].sort(newest);
}

function lessonGrid(report){
 const wrap=node('div',undefined,'report-grid-wrap'),grid=node('div',undefined,'lesson-grid');
 for(const lesson of report.lessons){
  const item=report.byLesson.get(lesson.n),total=rows(lesson.questions).filter(q=>!q.resource).length;
  const done=report.complete.has(lesson.n),started=Boolean(item?.ids.size),missing=!total&&!rows(lesson.vocab).length;
  const cell=node('div',lesson.n>=100?'Â'+(lesson.n-100):String(lesson.n),'lesson-cell '+(missing?'missing':done?'done':started?'doing':''));
  const tip=labelFor(lesson.n)+' · '+str(lesson.vi,str(lesson.zh))+' · '+(missing?'chưa có học liệu':done?'đã nộp kiểm tra cuối bài':started?number(item.ids.size)+'/'+number(total)+' câu đã luyện':'chưa học');
  cell.title=tip;cell.setAttribute('aria-label',tip);cell.setAttribute('role','img');
  grid.append(cell);
 }
 wrap.append(grid,node('small','Đậm: đã nộp kiểm tra cuối bài · viền: đang học · xám: chưa học · gạch chéo: chưa có học liệu','muted'));
 return wrap;
}

function render(state,catalog){
 const result=document.createDocumentFragment();
 const report=summarize(state,catalog);
 const {lessons,byLesson,attempts,history,complete,questionById,wordById,paperById}=report;
 const graded=report.correct+report.incorrect;
 const exams=history.filter(item=>item.examCode||item.practicePaper);
 const stats=node('div',undefined,'admin-stats report-cards');
 for(const [value,label] of [
  [number(complete.size)+'/'+number(lessons.filter(lesson=>lesson.n<100).length),'Bài đã nộp kiểm tra cuối bài'],
  [number(report.viewed.questions.length)+' · '+number(attempts.length),'Câu đã xem · đã trả lời'],
  [graded?Math.round(100*report.correct/graded)+'%':'—','Tỷ lệ đúng · '+number(report.correct)+' đúng / '+number(report.incorrect)+' sai'],
  [number(report.viewed.exams.length)+' · '+number(exams.length),'Đề đã mở · đã nộp'],
  [number(report.known)+' · '+number(report.words.length-report.known),'Từ đã thuộc · cần ôn']
 ]){
  const card=node('div',undefined,'stat'),body=node('div');body.append(node('strong',value),node('small',label));card.append(body);stats.append(card);
 }
 result.append(stats);
 const last=lessons.find(lesson=>lesson.n===state.last);
 result.append(node('p','Hoạt động gần nhất · '+dateText(report.maxActivity)+(last?' · Mở gần nhất '+labelFor(last.n):''),'report-meta'));

 const courses=node('div',undefined,'report-courses');
 for(const lesson of lessons){
  const item=byLesson.get(lesson.n),total=rows(lesson.questions).filter(q=>!q.resource).length,done=integer(item?.ids.size);
  const line=number(done)+'/'+number(total)+' câu'+(item?.graded?' · '+percent(item.correct,item.graded)+'% đúng':'')+(complete.has(lesson.n)?' · đã nộp kiểm tra':'');
  const row=node('div',undefined,'report-course');
  const head=node('div',undefined,'row split');head.append(node('strong',labelFor(lesson.n)+' · '+str(lesson.zh,str(lesson.vi))),node('small',line,'muted'));
  row.append(head,bar(percent(done,total)));courses.append(row);
 }
 if(lessons.length)result.append(courses);

 result.append(tabbed([
  ['Câu hỏi',()=>{
   const items=questionRows(report);
   return pagedList(items,['Nội dung câu hỏi','Khóa · bài','Gần nhất','Số lần trả lời','Trạng thái'],item=>{
    const q=questionById.get(item.id),[label,k]=questionState(item);
    const kind=q?(explicitSkills[q.skill]??skillNames[q.kind]??''):'';
    return [stack(node('span',str(q?.prompt,item.id).replace(/\n/g,' ').slice(0,140)),q?.zh?node('small',q.zh,'muted han'):null,kind?node('small',kind,'muted'):null),
     q?.origin==='bank'?'Theo cấp HSK':Number.isInteger(q?.lesson)?labelFor(q.lesson):'—',dateText(item.at),number(item.count),badge(label,k)];
   },'Chưa có câu đã xem hoặc đã trả lời.',item=>questionState(item)[2]);
  }],
  ['Đề',()=>{
   const items=examRows(report);
   return pagedList(items,['Đề','Mở gần nhất','Đã xem tới','Trạng thái'],item=>{
    const paper=paperById.get(item.id),pages=paper?.pages?.length,max=Array.isArray(paper?.sections)?paper.sections.length*100:0;
    const score=item.best?scaledScore(item.best):null;
    return [stack(node('strong',str(paper?.title,item.id)),item.attempts?node('small',number(item.attempts)+' lượt nộp','muted'):null),dateText(item.at),
     item.pages.size?number(item.pages.size)+(pages?'/'+number(pages):'')+' trang':'—',
     item.submitted?badge('Đã nộp'+(score!==null&&max?' · '+score+'/'+max:''),score!==null&&max&&score>=max*0.6?'ok':'warn'):badge('Đã mở, chưa nộp','muted')];
   },'Chưa có lượt mở đề được ghi nhận.');
  }],
  ['Lưới bài',()=>lessonGrid(report)],
  ['Lịch sử & phiếu trả lời',()=>{
   const box=node('div',undefined,'cell-stack');
   box.append(pagedList(history,['Bài hoặc đề','Điểm','Chi tiết theo phần','Thời điểm'],item=>{
    const parts=rows(item.sections).map(section=>str(section.name)+' '+number(section.correct)+'/'+number(section.graded??section.total));
    if(!parts.length)for(const [key,skill] of records(item.skills))if(skill&&typeof skill==='object')parts.push((explicitSkills[key]??key)+' '+number(skill.correct)+'/'+number(skill.total));
    const p=percent(integer(item.correct),integer(item.graded));
    return [str(item.title,str(paperById.get(item.examCode)?.title)),integer(item.graded)?badge(number(item.correct)+'/'+number(item.graded),p>=80?'ok':p>=50?'warn':'bad'):badge('Tự đối chiếu','muted'),parts.join(' · ')||'—',dateText(item.at)];
   },'Chưa nộp lượt ôn hoặc bài kiểm tra nào.'));
   const responseView=examResponses(history,paperById);
   if(responseView){box.append(node('h3','Phiếu trả lời từng đề'),responseView)}
   return box;
  }],
  ['Từ vựng',()=>pagedList([...report.words].sort((a,b)=>a[1].localeCompare(b[1])),['Từ','Pinyin','Nghĩa','Trạng thái'],([id,status])=>{
   const word=wordById.get(id);
   return [str(word?.zh,id),str(word?.pinyin),str(word?.vi),badge(status==='known'?'Đã thuộc':'Cần ôn lại',status==='known'?'ok':'warn')];
  },'Chưa có từ vựng được đánh dấu.')]
 ]));
 return result;
}

const courseName=id=>({41:'Công xưởng',42:'Văn phòng'}[id]??'HSK '+(id>30?(id-30)+' · 3.0':id));

export function createLearnerReport(api){
 const panel=byId('learner-report');
 if(!panel)return ()=> {};
 const selector=byId('report-level'),status=byId('report-status'),body=byId('report-body');
 const catalogs=new Map();
 let selected,revision=0,opener=null;
 function loadCatalog(level){
  if(!catalogs.has(level)){
   catalogs.set(level,fetch('/learning/'+level+'.json').then(response=>{
    if(!response.ok)throw new Error('Không mở được danh mục '+courseName(level)+'.');
    return response.json();
   }).catch(error=>{catalogs.delete(level);throw error}));
  }
  return catalogs.get(level);
 }
 async function reload(){
  if(!selected)return;
  const id=++revision,level=Number(selector.value),email=selected.email;
  body.replaceChildren();status.removeAttribute('data-error');status.textContent='Đang tải tiến độ '+courseName(level)+'…';
  try{
   const report=await api('admin/progress?'+new URLSearchParams({email,level}));
   if(id!==revision)return;
   if(!report.state){status.textContent='Học viên chưa đồng bộ tiến độ '+courseName(level)+'.';return}
   const catalog=await loadCatalog(level);
   if(id!==revision)return;
   status.textContent='';
   body.replaceChildren(render(report.state,catalog));
  }catch(error){
   if(id!==revision)return;
   status.textContent=error.message||'Không tải được báo cáo. Vui lòng thử lại.';
   status.setAttribute('data-error','');
  }
 }
 selector.addEventListener('change',reload);
 byId('reload-report').addEventListener('click',reload);
 byId('close-report').addEventListener('click',()=>{
  revision++;selected=null;panel.hidden=true;body.replaceChildren();status.textContent='';
  (opener?.isConnected?opener:byId('overview-search'))?.focus();opener=null;
 });
 return (learner,button)=>{
  if(selected?.email!==learner.email)selector.value=String(learner.report_level??learner.max_level);
  selected=learner;opener=button;
  byId('report-email').textContent=learner.email;
  panel.hidden=false;panel.scrollIntoView({block:'start'});byId('report-title').focus({preventScroll:true});
  void reload();
 };
}
