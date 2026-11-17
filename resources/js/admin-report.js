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
  for(const value of fields(item)){const td=tr.insertCell();td.textContent=value}
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
  for(const [key,text] of [['all','Tất cả'],['wrong','Sai'],['correct','Đúng'],['review','Tự đối chiếu']]){
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

function render(state,catalog){
 const result=document.createDocumentFragment();
 const report=summarize(state,catalog);
 const {lessons,byLesson,bySkill,attempts,history,complete,questionById,wordById,paperById}=report;
 const graded=report.correct+report.incorrect;
 const exams=history.filter(item=>item.examCode||item.practicePaper);
 const stats=node('div',undefined,'report-stats');
 for(const [value,label] of [
  [number(attempts.length),'Lượt trả lời'],
  [number(report.correct)+' đúng · '+number(report.incorrect)+' sai','Câu có chấm điểm'],
  [graded?Math.round(100*report.correct/graded)+'%':'—','Tỷ lệ đúng'],
  [number(report.viewed.questions.length),'Câu đã xem'],
  [number(report.viewed.exams.length),'Đề đã mở'],
  [number(report.known)+' thuộc · '+number(report.words.length-report.known)+' cần ôn','Từ vựng'],
  [number(exams.length),'Lượt nộp đề']
 ]){
  const card=node('div',undefined,'report-stat');card.append(node('strong',value),node('small',label));stats.append(card);
 }
 result.append(stats);
 const last=lessons.find(lesson=>lesson.n===state.last);
 result.append(node('p','Hoạt động gần nhất · '+dateText(report.maxActivity)+(last?' · Mở gần nhất '+labelFor(last.n):''),'report-meta'));
 if(lessons.length){
  addGroup(result,'Tiến độ theo bài',table(['Bài học','Câu đã luyện','Tỷ lệ đúng','Kiểm tra cuối bài'],lessons,lesson=>{
   const item=byLesson.get(lesson.n),total=rows(lesson.questions).filter(q=>!q.resource).length;
   return [labelFor(lesson.n)+' · '+str(lesson.vi,str(lesson.zh)),number(item?.ids.size)+'/'+number(total),
    item?.graded?Math.round(100*item.correct/item.graded)+'%':'—',complete.has(lesson.n)?'Đã nộp':'Chưa nộp'];
  }),true);
 }
 if(bySkill.size){
  const ordered=[...bySkill].sort(([,a],[,b])=>a.correct/a.graded-b.correct/b.graded);
  addGroup(result,'Kết quả theo kỹ năng',table(['Kỹ năng','Đúng','Sai','Tỷ lệ đúng'],ordered,([label,item])=>[
   label,number(item.correct),number(item.graded-item.correct),Math.round(100*item.correct/item.graded)+'%'
  ]));
 }
 addGroup(result,'Lịch sử kiểm tra và làm đề · '+number(history.length),
  pagedList(history,['Bài hoặc đề','Điểm','Chi tiết theo phần','Thời điểm'],item=>{
   const parts=rows(item.sections).map(section=>str(section.name)+' '+number(section.correct)+'/'+number(section.graded??section.total));
   if(!parts.length)for(const [key,skill] of records(item.skills))if(skill&&typeof skill==='object')parts.push((explicitSkills[key]??key)+' '+number(skill.correct)+'/'+number(skill.total));
   return [str(item.title,str(paperById.get(item.examCode)?.title)),integer(item.graded)?number(item.correct)+'/'+number(item.graded):'Tự đối chiếu',parts.join(' · ')||'—',dateText(item.at)];
  },'Chưa nộp lượt ôn hoặc bài kiểm tra nào.'));
 const responseView=examResponses(history,paperById);
 if(responseView)addGroup(result,'Phiếu trả lời từng đề',responseView);
 addGroup(result,'Đề ôn thi đã mở · '+number(report.viewed.exams.length),
  pagedList(report.viewed.exams,['Đề','Trang đã mở','Trạng thái','Mở gần nhất'],item=>{
   const paper=paperById.get(item.id),pages=paper?.pages?.length;
   return [str(paper?.title,item.id),number(item.pages.size)+(pages?'/'+number(pages):''),
    item.submitted?'Đã nộp đề':'Chưa nộp đề',dateText(item.at)];
  },'Chưa có lượt mở đề được ghi nhận.'));
 addGroup(result,'Câu đã xem · '+number(report.viewed.questions.length),
  pagedList(report.viewed.questions,['Câu hỏi','Trạng thái','Xem gần nhất'],item=>[
   str(questionById.get(item.id)?.prompt,item.id),item.answered?'Đã trả lời':'Chưa trả lời',dateText(item.at)
  ],'Chưa có câu đã xem được ghi nhận.'));
 addGroup(result,'Chi tiết câu đã trả lời · '+number(attempts.length),
  pagedList(attempts,['Câu hỏi','Đã trả lời','Kết quả','Thời điểm'],attempt=>{
   const q=questionById.get(attempt.id);
   return [str(q?.prompt,attempt.id),str(attempt.value),statusLabels[typeof attempt.grade==='boolean'?attempt.grade:null],dateText(attempt.at)];
  },'Chưa có câu trả lời cho bộ lọc này.',attempt=>attempt.grade===true?'correct':attempt.grade===false?'wrong':'review'));
 addGroup(result,'Từ vựng đã đánh dấu · '+number(report.words.length),
  pagedList([...report.words].sort((a,b)=>a[1].localeCompare(b[1])),['Từ','Pinyin','Nghĩa','Trạng thái'],([id,status])=>{
   const word=wordById.get(id);
   return [str(word?.zh,id),str(word?.pinyin),str(word?.vi),status==='known'?'Đã thuộc':'Cần ôn lại'];
  },'Chưa có từ vựng được đánh dấu.'));
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
