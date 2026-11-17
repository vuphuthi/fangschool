const formats={
 1:[['Nghe hiểu',20],['Đọc hiểu',20]],
 2:[['Nghe hiểu',35],['Đọc hiểu',25]],
 3:[['Nghe hiểu',40],['Đọc hiểu',30],['Viết',10]]
};
const ranges=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const choiceLabel=(schema,key)=>schema==='TF'?(key==='T'?'Đúng':'Sai'):key;
const clock=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
const normalize=value=>String(value??'').normalize('NFKC').replace(/[\s，。！？、；：,.!?;:]/gu,'');
const orderOptions=['ABC','ACB','BAC','BCA','CAB','CBA'];
const freeText=schema=>['sentence','hanzi','sentence-open'].includes(schema);
const choices=schema=>schema==='order'?orderOptions:[...schema];
const mediaPage=(id,page)=>'/exams/'+id+'-p'+page+'.webp';

export function createExamCenter({course,catalog={},storage,persist,heading,esc,button,history,save,render,go,requireAccess,activePractice,onExamPage}){
 const papers=catalog.papers??[];
 const practiceSeries=catalog.practiceSeries??[];
 let exam,keys,draft,submitted,showWrong=false,pageIndex=0,rate=1;
 const schemaFor=n=>exam.questionTypes.find(([from,to])=>n>=from&&n<=to)[2];
 const titleOf=n=>exam.sections.find(([,from,to])=>n>=from&&n<=to)[0];
 const total=()=>keys.length;
 const activeDraft=id=>'exam-'+id+'-draft';
 const route=(part)=>'exams/'+exam.id+'/'+part;
 function select(paper){
  if(exam?.id===paper.id)return;
  exam=paper;
  keys=exam.answerKey;
  draft=storage(activeDraft(exam.id),null);
  pageIndex=exam.pages[draft?.pageIndex]?draft.pageIndex:0;
  submitted=null;
  showWrong=false;rate=1;
 }
 function isCorrect(n,value){
  const key=keys[n-1],answer=normalize(value);
  return !!answer&&(Array.isArray(key)?key:[key]).some(item=>normalize(item)===answer);
 }
 const needsReview=(n,value)=>['sentence','sentence-open'].includes(schemaFor(n))&&!!normalize(value)&&!isCorrect(n,value);
 const controls=(label,action,type='')=>button(label,'exam:'+action,'',type);
 const prettyDate=at=>new Date(at).toLocaleString('vi-VN');
 const saved=()=>history().filter(item=>papers.some(paper=>item.examCode===paper.id));
 const counts=paper=>paper.sections.map(([name,a,b])=>(b-a+1)+' '+name.toLowerCase()).join(' · ');

 function cards(list){
  return list.map(paper=>{
   const pending=storage(activeDraft(paper.id),null);
   const legacy=activePractice?.()===paper.id;
   return '<article class="panel exam-feature"><h3>'+esc(paper.code??paper.title)+'</h3><p>'+esc(counts(paper))+(paper.originalCode?' · '+esc(paper.originalCode):catalog.edition?' · FangSchool biên soạn':'')+'</p><div class="wrap form-actions">'+
    (pending?controls('Tiếp tục làm đề','resume:'+paper.id,'primary'):legacy?controls('Tiếp tục lượt cũ','resume-practice:'+paper.id,'primary'):'')+
    controls('Luyện không tính giờ','start:'+paper.id+':practice',pending?'':'primary')+
    controls('Làm có giờ · '+paper.seconds/60+' phút','start:'+paper.id+':timed')+'</div></article>';
  }).join('');
 }
 function historyList(list){
  return [...list].reverse().slice(0,10).map(item=>{
   const paper=papers.find(p=>p.id===(item.examCode??item.practicePaper));
   return '<div class="exam-history"><span>'+esc(paper?.title??item.title)+'<br><small>'+esc(prettyDate(item.at))+'</small></span><strong>'+item.correct+'/'+item.graded+' câu đúng</strong>'+
    (item.examCode?controls('Xem lại','result:'+item.examCode+':'+item.at):'')+'</div>';
  }).join('')||'<p>Kết quả sẽ được lưu theo email sau khi bạn nộp đề.</p>';
 }
 function seriesLibrary(key){
  const selected=practiceSeries.find(series=>series.key===key)??practiceSeries[0];
  const tabs=practiceSeries.map(series=>'<a class="btn '+(series===selected?'active':'')+'" href="#exams/'+esc(series.key)+'"'+(series===selected?' aria-current="page"':'')+'>'+esc(series.label)+'</a>').join('');
  const items=papers.filter(paper=>paper.group===selected.key);
  const recent=history().filter(item=>items.some(paper=>paper.id===(item.examCode??item.practicePaper)));
  return heading('Đề ôn thi · HSK 4')+
   '<nav class="wrap form-actions" aria-label="Bộ đề HSK 4">'+tabs+'</nav>'+
   '<section class="form-actions" aria-label="'+esc(selected.label)+'"><div class="section-head"><div><h2>'+esc(selected.label)+'</h2><p>'+esc(selected.description)+'</p></div><span class="label">'+items.length+' bài luyện</span></div>'+
   '<div class="exam-paper-grid">'+cards(items)+'</div></section>'+
   '<section class="panel form-actions"><h2>Lịch sử làm bài · '+esc(selected.label)+'</h2>'+historyList(recent)+'</section>';
 }
 function library(){
  if(!papers.length)return heading('Đề ôn thi','Chưa có đề cho cấp này.');
  const format=catalog.edition?papers[0].sections.map(([name,a,b])=>[name,b-a+1]):formats[course];
  const overview='<div class="exam-format">'+format.map(([name,count])=>'<div><strong>'+count+'</strong><small>'+name+'</small></div>').join('')+'</div>';
  return heading('Đề ôn thi · HSK '+course+(catalog.edition?' bản '+catalog.edition:''),catalog.edition?'Đề luyện ngắn FangSchool biên soạn từ bài học 3.0.':'Luyện đề theo cấu trúc HSK 2.0.')+overview+'<div class="stack">'+
   '<section aria-labelledby="online-exams"><div class="section-head"><h2 id="online-exams">Làm đề trực tuyến</h2><span class="label">'+papers.length+' đề</span></div><div class="exam-paper-grid">'+cards(papers)+'</div></section>'+
   '<section class="panel"><h2>Lịch sử làm đề</h2>'+historyList(saved())+'</section></div>';
 }

 function rows(a,b){
  return ranges(a,b).map(n=>{
   const schema=schemaFor(n);
   const value=draft.answers[n]??'';
   const controls=freeText(schema)
    ?'<input type="text" class="exam-writing" data-exam-answer="'+n+'" aria-label="Đáp án tiếng Trung câu '+n+'" lang="zh-CN" autocomplete="off" maxlength="'+(schema==='hanzi'?8:150)+'" value="'+esc(value)+'" placeholder="'+(schema==='hanzi'?'Nhập chữ Hán':schema==='sentence-open'?'Đặt câu theo hình':'Nhập câu đã sắp xếp')+'">'
    :'<div class="wrap">'+choices(schema).map(key=>button(choiceLabel(schema,key),'exam:pick:'+n+':'+key,'',value===key?'active':'','aria-pressed="'+(value===key)+'"')).join('')+'</div>';
   const clip=exam.recordings?.[n];
   const audio=clip?'<audio class="exam-question-audio" data-exam-audio controls preload="none" aria-label="Nghe câu '+n+'" src="'+esc(clip)+'"></audio>':'';
   return '<fieldset class="exam-answer"><legend>Câu '+n+'</legend>'+(exam.prompts?.[n]?'<p class="lines" lang="vi">'+esc(exam.prompts[n])+'</p>':'')+audio+controls+'</fieldset>';
  }).join('');
 }
 function pageLabel(page){
  return 'Câu '+page[1]+'–'+page[2];
 }
 function sheet(){
  const [pdfPage,a,b]=exam.pages[pageIndex];
  const label=titleOf(a)+' · '+pageLabel(exam.pages[pageIndex]);
  if(exam.prompts)return '<section class="panel"><h2>'+label+'</h2><div id="exam-rows">'+rows(a,b)+'</div></section>';
  return '<section class="panel exam-reader"><div class="section-head"><h2>'+label+'</h2><a class="btn" href="'+esc(exam.pdf)+'" target="_blank" rel="noopener">'+(exam.originalCode||!exam.group?'Mở PDF gốc ↗':'Mở PDF đề ↗')+'</a></div>'+
   '<a class="exam-image-link" href="'+esc(mediaPage(exam.id,pdfPage))+'" target="_blank" rel="noopener" aria-label="Mở ảnh đề bài cỡ lớn"><img class="exam-image" src="'+esc(mediaPage(exam.id,pdfPage))+'" width="1061" height="1500" alt="Trang đề. '+label+'. Chạm để xem ảnh lớn."></a></section>'+
   '<section class="panel exam-sheet"><h2>Phiếu trả lời</h2><p>'+ (freeText(schemaFor(a))?'Dùng bàn phím tiếng Trung để nhập đáp án.':'Chọn đáp án cho các câu trên trang.') +'</p><div id="exam-rows">'+rows(a,b)+'</div></section>';
 }
 function runner(){
  const timer=draft.deadline?'<strong id="exam-timer" role="timer"></strong>':'<small>Không tính giờ</small>';
  return '<div class="wrap">'+controls('‹ Kho đề','back')+'</div>'+heading(exam.title,'HSK '+course+' · '+counts(exam))+
   '<section class="panel exam-controls"><div class="row split"><span id="exam-progress" class="label">'+Object.keys(draft.answers).length+'/'+total()+' câu đã trả lời</span>'+timer+controls('Nộp bài','submit','primary')+'</div>'+
   (exam.audio?'<div class="form-actions"><label for="exam-audio">Bản thu gốc của đề</label><audio id="exam-audio" data-exam-audio controls preload="none" src="'+esc(exam.audio)+'"></audio></div><p>Phát bản nghe và chuyển trang theo số câu. Khi đến phần Đọc, bạn có thể dừng âm thanh.</p>':
    Object.keys(exam.recordings??{}).length?'<p>Các câu nghe có nút phát ở phiếu trả lời.</p>':'')+
   (!draft.deadline&&(exam.audio||Object.keys(exam.recordings??{}).length)?'<div class="wrap audio-controls"><label for="exam-rate">Tốc độ <select id="exam-rate">'+[.75,1,1.25].map(value=>'<option '+(rate===value?'selected ':'')+'value="'+value+'">'+value+'×</option>').join('')+'</select></label></div>':'')+'</section>'+
   '<div class="panel exam-pagination form-actions"><div class="wrap">'+exam.pages.map((page,i)=>controls(pageLabel(page),'page:'+i,i===pageIndex?'active':'')).join('')+'</div></div>'+
   '<div id="exam-sheet" class="exam-grid form-actions'+(exam.prompts?' exam-inline':'')+'">'+sheet()+'</div>'+
   '<div class="wrap form-actions" id="exam-footer">'+footer()+'</div>';
 }
 function footer(){
  return (pageIndex?controls('‹ Trang trước','page:'+(pageIndex-1)):'')+
   (pageIndex<exam.pages.length-1?controls('Trang tiếp ›','page:'+(pageIndex+1),'primary'):controls('Nộp bài','submit','primary'));
 }
 function result(){
  const {responses,sections,at,correct,graded}=submitted;
  const ordered=ranges(1,total()).filter(n=>!showWrong||!isCorrect(n,responses[n]));
  const pending=ordered.filter(n=>schemaFor(n)==='sentence'&&needsReview(n,responses[n])).length;
  return '<div class="wrap">'+controls('‹ Kho đề','back')+'</div>'+heading('Kết quả · '+exam.title,prettyDate(at))+
   '<section class="panel"><div class="result">'+correct+'/'+graded+'</div><p>Số câu khớp đáp án.'+(graded<total()?' '+(total()-graded)+' câu viết tự đối chiếu.':'')+(pending?' Có '+pending+' câu sắp xếp cần tự đối chiếu.':'')+'</p><div class="exam-format">'+sections.map(({name,correct:count,total,graded:sectionGraded})=>'<div><strong>'+count+'/'+(sectionGraded??total)+'</strong><small>'+name+'</small></div>').join('')+'</div><div class="wrap">'+controls('Làm lại đề','start:'+exam.id+':practice','primary')+(exam.pdf?'<a class="btn" href="'+esc(exam.pdf)+'" target="_blank" rel="noopener">'+(exam.originalCode||!exam.group?'Xem đề gốc ↗':'Mở PDF đề ↗')+'</a>':'')+'</div></section>'+
   '<section class="panel form-actions"><div class="section-head"><h2>Đối chiếu đáp án</h2>'+controls(showWrong?'Xem tất cả':'Chỉ xem câu cần ôn','filter')+'</div>'+
   '<div class="exam-review">'+(ordered.map(n=>{
    const schema=schemaFor(n),value=responses[n];
    const key=keys[n-1];
    const examples=exam.writingExamples?.[n];
    const expected=Array.isArray(key)?key.join(' / '):key===null?(examples?.join(' / ')??'Tự đối chiếu với đề bài'):choiceLabel(schema,key);
    const matched=isCorrect(n,value),review=needsReview(n,value);
    return '<div class="'+(matched?'good':review||schema==='sentence-open'?'neutral':'incorrect')+'"><strong>Câu '+n+'</strong><span>'+esc(value?choiceLabel(schema,value):'Bỏ trống')+'</span><span>Đáp án · '+esc(expected)+'</span>'+(schema==='sentence-open'?'<small>Câu viết tự đối chiếu</small>':review?'<small>Tự đối chiếu cách sắp xếp</small>':'')+(exam.explanations?.[n-1]?'<small>'+esc(exam.explanations[n-1])+'</small>':'')+(exam.prompts?.[n]?'<small class="lines">'+esc(exam.prompts[n])+'</small>':'')+'</div>';
   }).join('')||'<p>Bạn đã trả lời đúng tất cả các câu.</p>')+'</div></section>';
 }
 function tick(){
  const timer=document.getElementById('exam-timer');
  if(!timer||!draft?.deadline)return;
  const remaining=Math.max(0,Math.ceil((draft.deadline-Date.now())/1000));
  timer.textContent=clock(remaining);
  if(remaining===0)finishIfAllowed();
 }
 let finalizing=false;
 async function finishIfAllowed(){
  if(finalizing)return;
  const answerSheet=draft;
  finalizing=true;
  try{if(await requireAccess()&&draft===answerSheet)finish()}finally{finalizing=false}
 }
 function setRate(value){
  rate=[.75,1,1.25].includes(value)?value:1;
  document.querySelectorAll('[data-exam-audio]').forEach(audio=>{audio.playbackRate=rate});
 }
 function updateSheet(){
  document.querySelectorAll('#exam-sheet [data-exam-audio]').forEach(audio=>audio.pause());
  document.getElementById('exam-sheet').innerHTML=sheet();
  document.getElementById('exam-footer').innerHTML=footer();
  setRate(rate);
  onExamPage?.(exam.id,exam.pages[pageIndex][0]);
  [...document.querySelectorAll('.exam-pagination .btn')].forEach((el,i)=>el.classList.toggle('active',i===pageIndex));
 }
 function keep(){
  if(draft)draft.pageIndex=pageIndex;
  persist(activeDraft(exam.id),draft);
 }
 function finish(){
  if(!draft)return;
  document.querySelectorAll('[data-exam-audio]').forEach(audio=>audio.pause());
  const sections=exam.sections.map(([name,a,b])=>({name,total:b-a+1,
   correct:ranges(a,b).filter(n=>isCorrect(n,draft.answers[n])).length,
   graded:ranges(a,b).filter(n=>keys[n-1]!==null).length}));
  submitted={examCode:exam.id,title:exam.title,at:Date.now(),correct:sections.reduce((n,s)=>n+s.correct,0),graded:sections.reduce((n,s)=>n+s.graded,0),sections,responses:draft.answers};
  history().push(submitted);
  save();
  draft=null;keep();showWrong=false;go(route('result'));
 }
 function page(id,subpage){
  if(id==='take'||id==='result'){subpage=id;id='h21332'}
  const paper=papers.find(item=>item.id===id);
  if(paper){
   select(paper);
   if(subpage==='take'&&draft){
    const viewedPage=paper.pages[pageIndex][0];
    queueMicrotask(()=>{onExamPage?.(paper.id,viewedPage);setRate(rate);tick()});
    return runner();
   }
   if(subpage==='result'&&submitted)return result();
  }
  return practiceSeries.length?seriesLibrary(paper?.group??id):library();
 }
 function input(n,value){
  if(!draft||!freeText(schemaFor(n)))return;
  if(value.trim())draft.answers[n]=value;
  else delete draft.answers[n];
  keep();updateProgress();
 }
 function updateProgress(){
  document.getElementById('exam-progress').textContent=Object.keys(draft.answers).length+'/'+total()+' câu đã trả lời';
 }
 async function handle([action,first,second]){
  if(action==='resume-practice'){
   if(activePractice?.()===first&&await requireAccess())go('quiz');
   return;
  }
  if(['start','resume','result'].includes(action)){
   const paper=papers.find(item=>item.id===first);
   if(!paper)return;
   select(paper);
  }
  if(!exam)return;
  if(action==='start'){
   if(draft&&Object.keys(draft.answers).length&&!confirm('Bắt đầu lại và bỏ phiếu đang làm?'))return;
   if(!await requireAccess())return;
   draft={answers:{},deadline:second==='timed'?Date.now()+exam.seconds*1000:null};
   pageIndex=0;keep();go(route('take'));
  }else if(action==='resume'&&draft){
   if(await requireAccess())go(route('take'));
  }
  else if(action==='back')go(exam.group?'exams/'+exam.group:'exams');
  else if(action==='page'&&draft){
   const index=Number(first);
   if(!exam.pages[index])return;
   pageIndex=index;keep();updateSheet();
   document.getElementById('exam-sheet').scrollIntoView({block:'start'});
  }
  else if(action==='pick'&&draft){
   const n=Number(first),[,a,b]=exam.pages[pageIndex];
   if(n<a||n>b||freeText(schemaFor(n))||!choices(schemaFor(n)).includes(second))return;
   draft.answers[n]=second;keep();
   updateProgress();
   document.querySelectorAll('[data-action^="exam:pick:'+n+':"]').forEach(el=>{
    const pressed=el.dataset.action.endsWith(':'+second);
    el.classList.toggle('active',pressed);el.setAttribute('aria-pressed',String(pressed));
   });
  }
  else if(action==='submit'&&draft){
   const blank=total()-Object.keys(draft.answers).length;
   if(!blank||confirm('Còn '+blank+' câu bỏ trống. Bạn vẫn muốn nộp bài?'))await finishIfAllowed();
  }
  else if(action==='result'){
   submitted=saved().find(item=>item.examCode===exam.id&&item.at===Number(second));
   if(submitted){showWrong=false;go(route('result'))}
  }
  else if(action==='filter'&&submitted){showWrong=!showWrong;render()}
 }
 setInterval(tick,1000);
 return {page,handle,input,setRate};
}
