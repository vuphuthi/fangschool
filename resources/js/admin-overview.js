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
   [count(data.learners.filter(x=>x.last_at>=now-7*86400000&&x.last_at<=now).length)+' / '+count(data.learners.length),'Học trong 7 ngày'],
   [count(data.totals.questions_viewed)+' · '+count(data.totals.attempts),'Câu đã xem · đã trả lời'],
   [graded?Math.round(data.totals.correct*100/graded)+'%':'—','Tỷ lệ đúng (câu chấm tự động)'],
   [count(data.totals.exams_viewed)+' · '+count(data.totals.exams),'Đề đã mở · đã nộp']
  ];
  stats.replaceChildren(...boxes.map(([value,label])=>{
   const card=element('div',undefined,'stat'),body=element('div');
   body.append(element('strong',value),element('small',label));card.append(body);
   return card;
  }));
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
  levels.replaceChildren(grid);
 }

 const scopeLabels=learner=>[...(learner.max_level?['HSK 1'+(learner.max_level>1?'–'+learner.max_level:'')]:[]),
  ...Object.entries(trackKey).filter(([,key])=>learner.workplace?.[key]).map(([id])=>courseName(id))];
 function learnerState(learner,now){
  const any=active(learner,now)||Object.values(learner.workplace??{}).some(grant=>active(grant,now));
  if(!any)return ['Không còn quyền','bad'];
  if(learner.last_at>=now-7*86400000)return ['Đang học','ok'];
  return learner.studied?['Tạm nghỉ','warn']:['Chưa học','muted'];
 }
 function filteredRows(){
  const term=search.value.trim().toLowerCase(),max=Number(filter.value);
  return learners.filter(learner=>learner.email.includes(term)&&(!max||(trackKey[max]?Object.hasOwn(learner.workplace??{},trackKey[max]):learner.max_level===max)));
 }
 function renderList(){
  const rows=filteredRows();
  const size=15,last=Math.max(0,Math.ceil(rows.length/size)-1);
  page=Math.min(page,last);
  const root=document.createDocumentFragment(),now=Date.now();
  const buttons=new Map();
  if(!rows.length){root.append(element('p',learners.length?'Không có học viên nào khớp bộ lọc.':'Chưa có học viên được cấp quyền.'))}
  else{
   const wrap=element('div',undefined,'table-wrap'),table=element('table',undefined,'table'),head=element('thead'),body=element('tbody'),tr=element('tr');
   for(const label of ['Học viên','Khóa có quyền','Câu xem / trả lời','Lượt nộp đề','Đề đã mở','Hoạt động gần nhất',''])tr.append(Object.assign(element('th',label),{scope:'col'}));
   head.append(tr);table.append(head,body);wrap.append(table);root.append(wrap);
   for(const learner of rows.slice(page*size,(page+1)*size)){
    const row=element('tr'),who=element('td'),[state,k]=learnerState(learner,now);
    const badge=element('span',state,'badge');badge.dataset.k=k;
    who.append(element('strong',learner.email,'email-cell'),element('br'),badge);
    const button=element('button','Mở báo cáo','btn');button.type='button';
    button.addEventListener('click',()=>openReport(learner,button));
    buttons.set(learner.email,button);
    const action=element('td');action.append(button);
    row.append(who,element('td',scopeLabels(learner).join(', ')||'—'),element('td',count(learner.questions_viewed)+' / '+count(learner.attempts)),
     element('td',count(learner.exams)),element('td',count(learner.exams_viewed)),element('td',learner.last_at?date.format(learner.last_at):'Chưa ghi nhận','muted'),action);
    body.append(row);
   }
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
 function exportCsv(){
  const now=Date.now(),cellText=value=>'"'+String(value).replace(/"/g,'""')+'"';
  const lines=[['Email','Trạng thái','Khóa có quyền','Câu đã xem','Lượt trả lời','Đề đã mở','Lượt nộp đề','Hoạt động gần nhất'].map(cellText).join(',')];
  for(const learner of filteredRows())lines.push([learner.email,learnerState(learner,now)[0],scopeLabels(learner).join('; '),learner.questions_viewed,learner.attempts,learner.exams_viewed,learner.exams,learner.last_at?date.format(learner.last_at):''].map(cellText).join(','));
  const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=Object.assign(document.createElement('a'),{href:url,download:'fangschool-tien-do-'+new Date().toISOString().slice(0,10)+'.csv'});
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
 byId('export-csv')?.addEventListener('click',exportCsv);
 void refresh();
}
