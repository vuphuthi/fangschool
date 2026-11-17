const selectionKey='fangschool-admin-selected-learner';
const courseName=id=>({41:'Công xưởng',42:'Văn phòng'}[id]??'HSK '+(id>30?(id-30)+' · 3.0':id));
const trackKey={41:'factory',42:'office'};
const active=(grant,now)=>grant&&!grant.revoked&&grant.expires_at>now;
const byId=id=>document.getElementById(id);
const count=value=>(Number.isSafeInteger(value)&&value>=0?value:0).toLocaleString('vi-VN');
const date=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
const element=(tag,text,css)=>{
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(css)node.className=css;
 return node;
};

export function showLearnerProgress(email){
 try{sessionStorage.setItem(selectionKey,email)}catch{}
 location.assign('/admin/progress');
}

function summarize(data){
 const learners=data.learners.map(grant=>({...grant,attempts:0,exams:0,exams_viewed:0,questions_viewed:0,last_at:0,report_level:grant.max_level||(grant.workplace?.factory?41:42),studied:false}));
 const byEmail=new Map(learners.map(learner=>[learner.email,learner]));
 const levels=[1,2,3,4,31,32,41,42].map(level=>({level,learners:0,attempts:0,exams:0,correct:0,incorrect:0,exams_viewed:0,questions_viewed:0}));
 const totals={attempts:0,correct:0,incorrect:0,exams:0,exams_viewed:0,questions_viewed:0};
 for(const row of data.progress){
  const learner=byEmail.get(row.email),level=levels.find(item=>item.level===row.level);
  if(!learner||!level)continue;
  learner.attempts+=row.attempts;
  learner.exams+=row.exams;
  learner.exams_viewed+=row.exams_viewed??0;
  learner.questions_viewed+=row.questions_viewed??0;
  learner.studied||=Boolean(row.studied);
  if(row.last_at>learner.last_at){
   learner.last_at=row.last_at;
   learner.report_level=row.level;
  }
  if(row.studied)level.learners++;
  level.attempts+=row.attempts;
  level.exams+=row.exams;
  level.correct+=row.correct;level.incorrect+=row.incorrect;
  level.exams_viewed+=row.exams_viewed??0;level.questions_viewed+=row.questions_viewed??0;
  for(const key of Object.keys(totals))totals[key]+=row[key]??0;
 }
 learners.sort((a,b)=>b.last_at-a.last_at||a.email.localeCompare(b.email));
 return {learners,levels,totals};
}

export function initProgressDashboard(api,openReport){
 const status=byId('overview-status');
 if(!status)return;
 const stats=byId('overview-stats'),levels=byId('overview-levels'),list=byId('overview-learners');
 const search=byId('overview-search'),filter=byId('overview-hsk'),reload=byId('reload-overview');
 let learners=[],page=0,loading=false,preselected=null;
 try{preselected=sessionStorage.getItem(selectionKey);sessionStorage.removeItem(selectionKey)}catch{}

 function overview(data){
  const now=Date.now(),graded=data.totals.correct+data.totals.incorrect;
  const boxes=[
   [count(data.learners.filter(x=>active(x,now)||Object.values(x.workplace??{}).some(grant=>active(grant,now))).length),'Đang có quyền học'],
   [count(data.learners.filter(x=>x.studied).length),'Học viên có tiến độ'],
   [count(data.learners.filter(x=>x.last_at>=now-7*86400000&&x.last_at<=now).length),'Hoạt động 7 ngày qua'],
   [count(data.totals.attempts),'Lượt trả lời'],
   [count(data.totals.questions_viewed),'Câu đã xem'],
   [count(data.totals.exams_viewed),'Đề đã mở'],
   [graded?Math.round(data.totals.correct*100/graded)+'%':'—','Tỷ lệ đúng chung'],
   [count(data.totals.exams),'Lượt nộp đề']
  ];
  stats.replaceChildren(...boxes.map(([value,label])=>{
   const card=element('div',undefined,'report-stat');
   card.append(element('strong',value),element('small',label));
   return card;
  }));
  const heading=element('h3','Hoạt động theo khóa học');
  const grid=element('div',undefined,'admin-level-grid');
  for(const item of data.levels){
   const card=element('article',undefined,'admin-level');
   const graded=item.correct+item.incorrect;
   const progress=element('progress');
   progress.max=Math.max(1,data.learners.length);progress.value=item.learners;
   progress.setAttribute('aria-label','Số học viên có tiến độ '+courseName(item.level));
   card.append(element('strong',courseName(item.level)),element('span',count(item.learners)+' học viên có tiến độ'),
    progress,element('small',count(item.attempts)+' lượt trả lời · '+count(item.exams)+' lượt nộp đề'),
    element('small',count(item.questions_viewed)+' câu đã xem · '+count(item.exams_viewed)+' đề đã mở'),
    element('small','Tỷ lệ đúng · '+(graded?Math.round(100*item.correct/graded)+'%':'—')));
   grid.append(card);
  }
  levels.replaceChildren(heading,grid);
 }

 function renderList(){
  const term=search.value.trim().toLowerCase(),max=Number(filter.value);
  const rows=learners.filter(learner=>learner.email.includes(term)&&(!max||(trackKey[max]?Object.hasOwn(learner.workplace??{},trackKey[max]):learner.max_level===max)));
  const size=12,last=Math.max(0,Math.ceil(rows.length/size)-1);
  page=Math.min(page,last);
  const root=document.createDocumentFragment(),now=Date.now();
  const buttons=new Map();
  if(!rows.length){root.append(element('p',learners.length?'Không tìm thấy email phù hợp.':'Chưa có học viên được cấp quyền.'))}
  for(const learner of rows.slice(page*size,(page+1)*size)){
   const row=element('article',undefined,'grant-row');
   const identity=element('div'),activity=element('div',undefined,'learner-activity');
   identity.append(element('strong',learner.email));
   const scopes=[...(learner.max_level?[[learner,'HSK tối đa '+learner.max_level]]:[]),
    ...Object.entries(trackKey).filter(([,key])=>learner.workplace?.[key]).map(([id,key])=>[learner.workplace[key],courseName(id)])];
   for(const [grant,label] of scopes)identity.append(element('small',label+' · '+(active(grant,now)?'Đang hoạt động':grant.revoked?'Đã thu hồi':'Đã hết hạn')));
   activity.append(element('span',count(learner.questions_viewed)+' câu đã xem · '+count(learner.exams_viewed)+' đề đã mở'),
    element('small',count(learner.attempts)+' lượt trả lời · '+count(learner.exams)+' lượt nộp đề'),
    element('small','Gần nhất '+(learner.last_at?date.format(learner.last_at):'chưa ghi nhận')));
   const button=element('button','Xem tiến độ','btn');button.type='button';
   button.addEventListener('click',()=>openReport(learner,button));
   buttons.set(learner.email,button);
   row.append(identity,activity,button);root.append(row);
  }
  if(last>0){
   const navigation=element('div',undefined,'wrap report-pages');
   for(const [offset,label,disabled] of [[-1,'‹ Trang trước',page===0],[1,'Trang tiếp ›',page===last]]){
    const button=element('button',label,'btn');button.type='button';button.disabled=disabled;
    button.addEventListener('click',()=>{page+=offset;renderList()});
    navigation.append(button);
   }
   navigation.append(element('small','Trang '+(page+1)+'/'+(last+1)+' · '+count(rows.length)+' học viên'));root.append(navigation);
  }
  list.replaceChildren(root);
  return buttons;
 }

 async function refresh(){
  if(loading)return;
  loading=true;reload.disabled=true;status.removeAttribute('data-error');
  status.textContent='Đang tải thống kê…';
  try{
   const data=summarize(await api('admin/progress/overview'));
   learners=data.learners;
   overview(data);
   const selected=learners.find(learner=>learner.email===preselected);
   if(selected){search.value=selected.email;filter.value='';page=0}
   const buttons=renderList();
   status.textContent='';
   if(selected){openReport(selected,buttons.get(selected.email));preselected=null}
  }catch(error){
   status.textContent=error.message||'Không tải được thống kê. Vui lòng thử lại.';
   status.setAttribute('data-error','');
  }finally{loading=false;reload.disabled=false}
 }

 const applyFilter=()=>{page=0;renderList()};
 search.addEventListener('input',applyFilter);
 filter.addEventListener('change',applyFilter);
 reload.addEventListener('click',refresh);
 void refresh();
}
