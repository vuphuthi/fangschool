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
const pct=(a,b)=>b?Math.round(a/b*100):0;

export function createExamCenter({course,catalog={},storage,persist,heading,esc,button,history,save,render,go,requireAccess,activePractice,onExamPage}){
 const papers=catalog.papers??[];
 const practiceSeries=catalog.practiceSeries??[];
 let exam,keys,draft,submitted,showWrong=false,pageIndex=0,rate=1,listFilter='all',detailMode='practice',confirmNew=false,confirmSubmit=false,resultPart='all';
 const schemaFor=n=>exam.questionTypes.find(([from,to])=>n>=from&&n<=to)[2];
 const titleOf=n=>exam.sections.find(([,from,to])=>n>=from&&n<=to)[0];
 const total=()=>keys.length;
 const activeDraft=id=>'exam-'+id+'-draft';
 const route=(part)=>'exams/'+exam.id+'/'+part;
 const chip=text=>'<span class="chip">'+text+'</span>';
 const badge=(text,k)=>'<span class="badge" data-k="'+k+'">'+text+'</span>';
 const note=(html,k='')=>'<div class="note" '+(k?'data-k="'+k+'"':'')+' role="status"><div>'+html+'</div></div>';
 const bar=p=>'<div class="bar thin"><i style="width:'+p+'%"></i></div>';
 const head=(title,desc,chips='',extra='')=>'<header class="page-head"><div>'+(chips?'<div class="chips">'+chips+'</div>':'')+'<h1>'+esc(title)+'</h1>'+(desc?'<p>'+esc(desc)+'</p>':'')+'</div>'+extra+'</header>';
 const seg=(items,label)=>'<div class="segmented" role="tablist" aria-label="'+esc(label)+'">'+items.map(([action,text,on])=>'<button type="button" class="btn" role="tab" aria-selected="'+Boolean(on)+'" data-action="exam:'+esc(action)+'">'+text+'</button>').join('')+'</div>';
 function select(paper){
  if(exam?.id===paper.id)return;
  exam=paper;
  keys=exam.answerKey;
  draft=storage(activeDraft(exam.id),null);
  pageIndex=exam.pages[draft?.pageIndex]?draft.pageIndex:0;
  submitted=null;
  showWrong=false;rate=1;confirmNew=false;confirmSubmit=false;resultPart='all';
 }
 function isCorrect(n,value){
  const key=keys[n-1],answer=normalize(value);
  return !!answer&&(Array.isArray(key)?key:[key]).some(item=>normalize(item)===answer);
 }
 const needsReview=(n,value)=>['sentence','sentence-open'].includes(schemaFor(n))&&!!normalize(value)&&!isCorrect(n,value);
 const controls=(label,action,type='',attrs='')=>button(label,'exam:'+action,'',type,attrs);
 const prettyDate=at=>new Date(at).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
 const saved=()=>history().filter(item=>papers.some(paper=>item.examCode===paper.id));
 const counts=paper=>paper.sections.map(([name,a,b])=>(b-a+1)+' '+name.toLowerCase()).join(' · ');
 const questionCount=paper=>paper.answerKey.length;
 const maxScore=paper=>paper.sections.length*100;
 const passScore=paper=>Math.round(maxScore(paper)*0.6);
 // Điểm quy đổi: mỗi phần 100 điểm theo tỷ lệ câu đúng trên câu chấm tự động.
 const scaled=item=>Math.round((item.sections??[]).reduce((n,s)=>n+pct(s.correct,s.graded??s.total),0));
 const statusOf=paper=>{
  const pending=storage(activeDraft(paper.id),null),done=saved().filter(item=>item.examCode===paper.id);
  if(pending)return {key:'wip',label:'Đang làm · '+Object.keys(pending.answers).length+'/'+questionCount(paper),k:'warn',pending,done};
  if(done.length)return {key:'done',label:'Đã nộp · '+scaled(done.at(-1))+'/'+maxScore(paper),k:scaled(done.at(-1))>=passScore(paper)?'ok':'bad',pending,done};
  return {key:'new',label:'Chưa làm',k:'muted',pending,done};
 };

 function cards(list){
  return list.map(paper=>{
   const s=statusOf(paper),legacy=activePractice?.()===paper.id;
   const best=s.done.length?Math.max(...s.done.map(scaled)):null;
   return '<article class="panel exam-card"><div class="row split"><h3>'+esc(paper.code??paper.title)+'</h3>'+badge(s.label,s.k)+'</div><span class="muted">'+esc(counts(paper))+' · '+paper.seconds/60+' phút'+(paper.originalCode?' · '+esc(paper.originalCode):catalog.edition?' · FangSchool biên soạn':'')+'</span>'+
    (best!==null?'<small>Điểm cao nhất '+best+'/'+maxScore(paper)+' · '+s.done.length+' lượt nộp</small>':'<small>Thang điểm '+maxScore(paper)+' · đạt từ '+passScore(paper)+'</small>')+
    '<div class="wrap">'+(s.pending?controls('Làm tiếp','resume:'+paper.id,'primary'):legacy?controls('Tiếp tục lượt cũ','resume-practice:'+paper.id,'primary'):controls('Luyện không tính giờ','start:'+paper.id+':practice','primary')+controls('Làm có giờ · '+paper.seconds/60+' phút','start:'+paper.id+':timed'))+
    controls('Chi tiết đề','detail:'+paper.id)+(s.done.length?controls('Xem kết quả','result:'+paper.id+':'+s.done.at(-1).at):'')+'</div></article>';
  }).join('')||'<p>Không có đề nào trong mục này.</p>';
 }
 function historyList(list,scope=papers){
  const open=scope.map(paper=>({paper,pending:storage(activeDraft(paper.id),null)})).filter(x=>x.pending);
  const rows=[...list].reverse().slice(0,10).map(item=>{
   const paper=papers.find(p=>p.id===(item.examCode??item.practicePaper));
   const score=item.examCode&&paper?scaled(item):null;
   return '<div class="kv"><div class="grow"><strong>'+esc(paper?.title??item.title)+'</strong><small class="muted">'+esc(prettyDate(item.at))+' · '+item.correct+'/'+item.graded+' câu đúng</small></div><div class="wrap">'+
    (score!==null?badge(score+'/'+maxScore(paper),score>=passScore(paper)?'ok':'bad'):badge(pct(item.correct,item.graded)+'%','muted'))+(item.examCode?controls('Xem lại','result:'+item.examCode+':'+item.at):'')+'</div></div>';
  });
  const wip=open.map(x=>'<div class="kv"><div class="grow"><strong>'+esc(x.paper.title)+'</strong><small class="muted">Đã mở, chưa nộp · '+Object.keys(x.pending.answers).length+'/'+questionCount(x.paper)+' câu</small></div><div class="wrap">'+badge('Đang làm','warn')+controls('Làm tiếp','resume:'+x.paper.id)+'</div></div>');
  return [...wip,...rows].join('')||'<p>Kết quả sẽ được lưu theo email sau khi bạn nộp đề.</p>';
 }
 function filtered(list){
  return list.filter(paper=>listFilter==='all'||statusOf(paper).key===listFilter);
 }
 const filterTabs=list=>seg([['all','Tất cả'],['new','Chưa làm'],['wip','Đang làm'],['done','Đã nộp']].map(([k,t])=>['filter-list:'+k,t+' · '+list.filter(p=>k==='all'||statusOf(p).key===k).length,listFilter===k]),'Lọc trạng thái');
 function seriesLibrary(key){
  const selected=practiceSeries.find(series=>series.key===key)??practiceSeries[0];
  const tabs='<div class="segmented" role="tablist" aria-label="Bộ đề">'+practiceSeries.map(series=>'<a class="btn" role="tab" aria-selected="'+(series===selected)+'" href="#exams/'+esc(series.key)+'">'+esc(series.label)+'</a>').join('')+'</div>';
  const items=papers.filter(paper=>paper.group===selected.key);
  const recent=history().filter(item=>items.some(paper=>paper.id===(item.examCode??item.practicePaper)));
  return head('Đề ôn thi · HSK 4',selected.description,chip('HSK 4 · cấu trúc HSK 2.0'))+
   '<div class="toolbar"><span class="lbl">Bộ đề:</span>'+tabs+'</div>'+
   '<div class="tab-head form-actions" style="margin-top:22px"><h2>'+esc(selected.label)+' '+chip(items.length+' bài')+'</h2>'+filterTabs(items)+'</div>'+
   '<div class="exam-paper-grid">'+cards(filtered(items))+'</div>'+
   '<section class="panel form-actions"><h2>Lịch sử làm bài · '+esc(selected.label)+'</h2><p>Lưu theo email và khóa · gồm cả đề đã mở nhưng chưa nộp.</p><div class="form-actions">'+historyList(recent,items)+'</div></section>';
 }
 function library(){
  if(!papers.length)return head('Đề ôn thi','Chưa có đề cho cấp này.');
  const format=catalog.edition?papers[0].sections.map(([name,a,b])=>[name,b-a+1]):formats[course];
  const icons=['听','读','写'];
  const overview='<div class="grid4 stats">'+format.map(([name,count],i)=>'<div class="stat"><div class="iconbox hz">'+(icons[i]??'考')+'</div><div><strong>'+count+'</strong><small>'+esc(name)+'</small></div></div>').join('')+'<div class="stat"><div class="iconbox hz">分</div><div><strong>'+maxScore(papers[0])+'</strong><small>Thang điểm · đạt từ '+passScore(papers[0])+'</small></div></div></div>';
  const v3=catalog.edition?'<section class="panel summary form-actions"><span class="iconbox hz">考</span><div class="grow"><h2 style="font-size:19px;margin:0">Chưa có đề ôn thi cho phiên bản này</h2><p>Chưa có đề thi HSK 3.0 chính thức đã kiểm tra. Bên dưới là đề luyện FangSchool biên soạn từ bài học 3.0, không gắn nhãn đề thi 3.0.</p></div></section>':'';
  return head('Đề ôn thi · HSK '+course+(catalog.edition?' bản '+catalog.edition:''),catalog.edition?'Đề luyện ngắn FangSchool biên soạn từ bài học 3.0.':'Luyện đề theo cấu trúc HSK 2.0 với bản nghe và ảnh đề gốc.',chip(catalog.edition?'Đề luyện FangSchool':'HSK '+course+' · cấu trúc HSK 2.0'))+overview+v3+
   '<div class="tab-head form-actions" style="margin-top:26px"><h2>Làm đề trực tuyến '+chip(papers.length+' đề')+'</h2>'+filterTabs(papers)+'</div><div class="exam-paper-grid">'+cards(filtered(papers))+'</div>'+
   '<section class="panel form-actions"><h2>Lịch sử làm đề</h2><p>Lưu theo email và khóa · gồm cả đề đã mở nhưng chưa nộp.</p><div class="form-actions">'+historyList(saved())+'</div></section>';
 }
 const backLink=()=>controls('‹ Đề ôn thi · HSK '+course,'back','back');

 // ----- Chi tiết đề & chọn chế độ -----
 function detail(){
  const s=statusOf(exam),answered=draft?Object.keys(draft.answers).length:0;
  const rowsTable=exam.sections.map(([name,a,b])=>{
   const listen=/nghe|听/i.test(name);
   const media=listen?(exam.audio?chip('Bản nghe gốc'):Object.keys(exam.recordings??{}).length?chip('Audio từng câu'):''):(exam.prompts?chip('Đề trên web'):chip('Ảnh đề gốc'));
   return '<tr><td>'+esc(name)+'</td><td>'+(b-a+1)+'</td><td>Câu '+a+'–'+b+'</td><td>'+media+'</td></tr>';
  }).join('');
  const modes=[['practice','Luyện không tính giờ','Làm theo tốc độ của bạn, có thể chỉnh tốc độ nghe 0,75× – 1,25×.'],['timed','Có giờ · '+exam.seconds/60+' phút','Giống phòng thi: đồng hồ đếm ngược, tự nộp khi hết giờ.']];
  const left=draft?.deadline?Math.max(0,Math.ceil((draft.deadline-Date.now())/1000)):null;
  const attempts=s.done.slice().reverse().map(item=>'<div class="kv"><div class="grow"><strong>Lượt nộp '+esc(prettyDate(item.at))+'</strong><small class="muted">'+item.correct+'/'+item.graded+' câu đúng</small></div><div class="wrap">'+badge(scaled(item)+'/'+maxScore(exam),scaled(item)>=passScore(exam)?'ok':'bad')+controls('Xem','result:'+exam.id+':'+item.at)+'</div></div>').join('');
  return backLink()+head(exam.title,questionCount(exam)+' câu · '+exam.sections.length+' phần · thang điểm '+maxScore(exam)+' · đạt từ '+passScore(exam)+' điểm',chip('HSK '+course+(catalog.edition?' bản '+catalog.edition:' · cấu trúc HSK 2.0'))+badge(s.label,s.k),exam.pdf?'<a class="btn" href="'+esc(exam.pdf)+'" target="_blank" rel="noopener">Mở PDF đề gốc ↗</a>':'')+
   '<div class="main-split" style="margin-top:0"><section class="main"><div class="panel table-wrap" style="padding:0"><table class="table"><caption class="sr">Cấu trúc đề</caption><thead><tr><th scope="col">Phần</th><th scope="col">Số câu</th><th scope="col">Phạm vi</th><th scope="col">Học liệu</th></tr></thead><tbody>'+rowsTable+'</tbody></table></div>'+
   '<section class="panel cards"><h2>Chọn chế độ làm</h2><div class="cards" role="radiogroup" aria-label="Chế độ">'+modes.map(([k,label,desc])=>'<button type="button" class="option '+(detailMode===k?'selected':'')+'" role="radio" aria-checked="'+(detailMode===k)+'" data-action="exam:mode:'+k+'"><span>'+(k==='timed'?'⏱':'✎')+'</span><span><strong>'+label+'</strong><br><small>'+desc+'</small></span></button>').join('')+'</div>'+
   (draft?note('Bạn có một lượt đang làm ở chế độ <strong>'+(draft.deadline?'Có giờ':'Không tính giờ')+'</strong> ('+answered+'/'+questionCount(exam)+' câu'+(left!==null?', còn '+clock(left):'')+'). “Làm tiếp” giữ nguyên chế độ của lượt đó.')+'<div class="wrap">'+controls('Làm tiếp lượt đang dở','resume:'+exam.id,'primary')+controls('Bắt đầu lượt mới · '+(detailMode==='timed'?'Có giờ':'Không tính giờ'),'ask-new')+'</div>'+
    (confirmNew?note('<span>Lượt đang dở sẽ bị bỏ. Bắt đầu lượt mới?</span><div class="wrap">'+controls('Hủy','cancel-new')+controls('Bắt đầu','start:'+exam.id+':'+detailMode+':confirmed','primary')+'</div>','warn'):''):
    '<div class="wrap">'+controls('Bắt đầu · '+(detailMode==='timed'?'Có giờ':'Không tính giờ'),'start:'+exam.id+':'+detailMode,'primary')+'</div>')+'</section></section>'+
   '<aside class="side-col"><section class="panel"><h2 style="font-size:19px">Lịch sử lượt làm</h2><div class="form-actions">'+(draft?'<div class="kv"><div class="grow"><strong>Lượt đang làm</strong><small class="muted">Đã mở, chưa nộp · '+answered+'/'+questionCount(exam)+' câu</small></div>'+badge('Đang làm','warn')+'</div>':'')+(attempts||(!draft?'<p>Chưa có lượt nào.</p>':''))+'</div></section></aside></div>';
 }

 // ----- Làm đề -----
 function rows(a,b){
  return ranges(a,b).map(n=>{
   const schema=schemaFor(n);
   const value=draft.answers[n]??'',flagged=draft.flags?.includes(n);
   const controlsHtml=freeText(schema)
    ?'<input type="text" class="exam-writing" data-exam-answer="'+n+'" aria-label="Đáp án tiếng Trung câu '+n+'" lang="zh-CN" autocomplete="off" maxlength="'+(schema==='hanzi'?8:150)+'" value="'+esc(value)+'" placeholder="'+(schema==='hanzi'?'Nhập chữ Hán':schema==='sentence-open'?'Đặt câu theo hình':'Nhập câu đã sắp xếp')+'">'
    :'<div class="wrap">'+choices(schema).map(key=>button(choiceLabel(schema,key),'exam:pick:'+n+':'+key,'',value===key?'active':'','aria-pressed="'+(value===key)+'"')).join('')+'</div>';
   const clip=exam.recordings?.[n];
   const audio=clip?'<audio class="exam-question-audio" data-exam-audio controls preload="none" aria-label="Nghe câu '+n+'" src="'+esc(clip)+'"></audio>':'';
   return '<fieldset class="exam-answer" id="exam-q-'+n+'"><legend>Câu '+n+'</legend><button type="button" class="toggle exam-flag" data-action="exam:flag:'+n+'" aria-pressed="'+Boolean(flagged)+'">'+(flagged?'Đã đánh dấu':'Đánh dấu xem lại')+'</button>'+(exam.prompts?.[n]?'<p class="lines" lang="vi">'+esc(exam.prompts[n])+'</p>':'')+audio+controlsHtml+'</fieldset>';
  }).join('');
 }
 const pageLabel=page=>'Câu '+page[1]+'–'+page[2];
 function sheet(){
  const [pdfPage,a,b]=exam.pages[pageIndex];
  const label=titleOf(a)+' · '+pageLabel(exam.pages[pageIndex]);
  if(exam.prompts)return '<section class="panel"><h2>'+label+'</h2><div id="exam-rows">'+rows(a,b)+'</div></section>';
  return '<section class="panel exam-reader"><div class="section-head"><h2>'+label+'</h2><a class="btn" href="'+esc(exam.pdf)+'" target="_blank" rel="noopener">'+(exam.originalCode||!exam.group?'Mở PDF gốc ↗':'Mở PDF đề ↗')+'</a></div>'+
   '<a class="exam-image-link" href="'+esc(mediaPage(exam.id,pdfPage))+'" target="_blank" rel="noopener" aria-label="Mở ảnh đề bài cỡ lớn"><img class="exam-image" src="'+esc(mediaPage(exam.id,pdfPage))+'" width="1061" height="1500" alt="Trang đề. '+label+'. Chạm để xem ảnh lớn."></a></section>'+
   '<section class="panel exam-sheet"><h2>Phiếu trả lời</h2><p>'+(freeText(schemaFor(a))?'Dùng bàn phím tiếng Trung để nhập đáp án.':'Chọn đáp án cho các câu trên trang.')+'</p><div id="exam-rows">'+rows(a,b)+'</div></section>';
 }
 function grid(){
  const [,a,b]=exam.pages[pageIndex];
  return '<div class="qgrid">'+ranges(1,total()).map(n=>{
   const done=draft.answers[n]!==undefined,flag=draft.flags?.includes(n),here=n>=a&&n<=b;
   return '<button type="button" class="'+(flag?'flag':done?'done':'')+'" data-action="exam:goto:'+n+'" aria-label="Câu '+n+(done?', đã làm':', chưa làm')+(flag?', đã đánh dấu':'')+'"'+(here?' aria-current="true"':'')+'>'+n+'</button>';
  }).join('')+'</div><div class="qlegend"><span><i class="done"></i>Đã làm</span><span><i class="flag"></i>Đánh dấu</span><span><i></i>Chưa làm</span></div>';
 }
 function partTabs(){
  const [,a]=exam.pages[pageIndex],current=titleOf(a);
  return seg(exam.sections.map(([name,from])=>['goto:'+from,esc(name),name===current]),'Phần thi');
 }
 function runner(){
  const answered=Object.keys(draft.answers).length,blank=total()-answered;
  const timer=draft.deadline?'<span class="badge" data-k="warn">⏱ <strong id="exam-timer" role="timer"></strong></span>':badge('Không tính giờ','muted');
  return backLink()+head(exam.title,'HSK '+course+' · '+counts(exam),chip(draft.deadline?'Có giờ':'Luyện tập'))+
   (confirmSubmit?'<section class="panel summary" role="alertdialog" aria-labelledby="cf-h"><div class="grow"><strong id="cf-h">Nộp bài ngay?</strong><p>'+(blank?'Bạn còn '+blank+' câu chưa trả lời. ':'')+'Sau khi nộp sẽ không sửa được.</p></div><div class="wrap">'+controls('Làm tiếp','cancel-submit')+controls('Xác nhận nộp','confirm-submit','primary')+'</div></section>':'')+
   '<section class="panel exam-controls"><div class="row split"><span id="exam-progress" class="badge">'+answered+'/'+total()+' câu đã trả lời</span>'+timer+controls('Nộp bài','submit','primary')+'</div>'+
   (exam.audio?'<div class="form-actions"><label for="exam-audio">Bản thu gốc của đề</label><audio id="exam-audio" data-exam-audio controls preload="none" src="'+esc(exam.audio)+'"></audio></div><p>Phát bản nghe và chuyển trang theo số câu. Khi đến phần Đọc, bạn có thể dừng âm thanh.</p>':
    Object.keys(exam.recordings??{}).length?'<p>Các câu nghe có nút phát ở phiếu trả lời.</p>':'')+
   (!draft.deadline&&(exam.audio||Object.keys(exam.recordings??{}).length)?'<div class="wrap audio-controls"><label for="exam-rate">Tốc độ <select id="exam-rate">'+[.75,1,1.25].map(value=>'<option '+(rate===value?'selected ':'')+'value="'+value+'">'+value+'×</option>').join('')+'</select></label></div>':'')+'</section>'+
   '<div class="form-actions" id="exam-parts">'+partTabs()+'</div>'+
   '<div class="exam-layout form-actions"><div><div id="exam-sheet" class="exam-grid'+(exam.prompts?' exam-inline':'')+'">'+sheet()+'</div><div class="wrap form-actions" id="exam-footer">'+footer()+'</div></div>'+
   '<aside class="panel exam-map" aria-label="Danh sách câu"><div class="row split"><strong>Danh sách câu</strong><small id="exam-count">Đã làm '+answered+'/'+total()+'</small></div><div id="exam-grid">'+grid()+'</div></aside></div>';
 }
 function footer(){
  return (pageIndex?controls('‹ Trang trước','page:'+(pageIndex-1)):'')+
   (pageIndex<exam.pages.length-1?controls('Trang tiếp ›','page:'+(pageIndex+1),'primary'):controls('Nộp bài','submit','primary'));
 }

 // ----- Kết quả -----
 function result(){
  const {responses,sections,at,correct,graded,duration,mode}=submitted;
  const score=scaled(submitted),passed=score>=passScore(exam);
  const parts=['all',...exam.sections.map(([name])=>name)];
  const ordered=ranges(1,total()).filter(n=>(resultPart==='all'||titleOf(n)===resultPart)&&(!showWrong||!isCorrect(n,responses[n])));
  const wrongCount=ranges(1,total()).filter(n=>keys[n-1]!==null&&!isCorrect(n,responses[n])).length;
  const pending=ordered.filter(n=>schemaFor(n)==='sentence'&&needsReview(n,responses[n])).length;
  const meta=[exam.code??exam.title,'HSK '+course,mode==='timed'?'Có giờ':mode==='practice'?'Không tính giờ':'','Nộp lúc '+prettyDate(at)].filter(Boolean).join(' · ');
  const cardsHtml=ordered.map(n=>{
   const schema=schemaFor(n),value=responses[n],key=keys[n-1],examples=exam.writingExamples?.[n];
   const expected=Array.isArray(key)?key.join(' / '):key===null?(examples?.join(' / ')??'Tự đối chiếu với đề bài'):choiceLabel(schema,key);
   const matched=isCorrect(n,value),review=needsReview(n,value),self=review||schema==='sentence-open'||key===null;
   const clip=exam.recordings?.[n];
   return '<article class="panel review-card"><div class="top"><strong>Câu '+n+' · '+esc(titleOf(n))+'</strong>'+badge(matched?'Đúng':self?'Tự đối chiếu':value?'Sai':'Bỏ trống',matched?'ok':self?'warn':'bad')+'</div>'+
    (exam.prompts?.[n]?'<p class="lines">'+esc(exam.prompts[n])+'</p>':'')+
    '<div class="wrap"><span class="note" data-k="'+(matched?'ok':'bad')+'">Bạn chọn: <strong class="han">'+esc(value?choiceLabel(schema,value):'Bỏ trống')+'</strong></span>'+(matched?'':'<span class="note" data-k="ok">Đáp án: <strong class="han">'+esc(expected)+'</strong></span>')+'</div>'+
    (schema==='sentence-open'?'<small>Câu viết tự đối chiếu</small>':review?'<small>Tự đối chiếu cách sắp xếp</small>':'')+(exam.explanations?.[n-1]?'<p>'+esc(exam.explanations[n-1])+'</p>':'')+
    (clip?'<audio class="exam-question-audio" data-exam-audio controls preload="none" aria-label="Nghe lại câu '+n+'" src="'+esc(clip)+'"></audio>':'')+'</article>';
  }).join('');
  return backLink()+
   '<section class="panel score-card"><div class="score-ring" style="--p:'+pct(score,maxScore(exam))+'"><span>'+score+'</span></div><div class="grow"><small class="muted">'+esc(meta.toUpperCase())+'</small><h2>'+esc(exam.title)+' · '+score+'/'+maxScore(exam)+'</h2><div class="wrap">'+badge(passed?'Đạt (≥ '+passScore(exam)+')':'Chưa đạt (cần '+passScore(exam)+')',passed?'ok':'bad')+(duration?'<span class="muted">Thời gian làm '+clock(Math.round(duration/1000))+(mode==='timed'?' / '+clock(exam.seconds):'')+'</span>':'')+'</div>'+
   '<div class="predict-parts">'+sections.map(sec=>'<div><div class="row split"><strong>'+esc(sec.name)+'</strong><span>'+pct(sec.correct,sec.graded??sec.total)+' điểm · <span class="muted">'+sec.correct+'/'+(sec.graded??sec.total)+' câu đúng</span></span></div>'+bar(pct(sec.correct,sec.graded??sec.total))+'</div>').join('')+'</div>'+
   '<p>'+correct+'/'+graded+' câu khớp đáp án.'+(graded<total()?' '+(total()-graded)+' câu viết tự đối chiếu.':'')+(pending?' Có '+pending+' câu sắp xếp cần tự đối chiếu.':'')+'</p>'+
   '<div class="wrap">'+controls('Làm lại đề','start:'+exam.id+':'+(mode==='timed'?'timed':'practice'),'primary')+(wrongCount?controls(showWrong?'Xem tất cả câu':'Chỉ xem câu sai','filter'):'')+(exam.pdf?'<a class="btn" href="'+esc(exam.pdf)+'" target="_blank" rel="noopener">'+(exam.originalCode||!exam.group?'Xem đề gốc ↗':'Mở PDF đề ↗')+'</a>':'')+'</div></div></section>'+
   '<section class="panel table-wrap form-actions" style="padding:0"><table class="table"><caption class="sr">Điểm theo từng phần</caption><thead><tr><th scope="col">Phần</th><th scope="col">Số câu</th><th scope="col">Đúng</th><th scope="col">Tỷ lệ</th></tr></thead><tbody>'+sections.map(sec=>{const p=pct(sec.correct,sec.graded??sec.total);return '<tr><td>'+esc(sec.name)+'</td><td class="muted">'+sec.total+'</td><td>'+sec.correct+'/'+(sec.graded??sec.total)+'</td><td>'+badge(p+'%',p>=80?'ok':p>=60?'warn':'bad')+'</td></tr>'}).join('')+'</tbody></table></section>'+
   '<div class="tab-head" style="margin-top:28px"><h2>'+(showWrong?'Xem lại câu sai':'Đối chiếu đáp án')+' <small class="muted">· '+wrongCount+' câu sai</small></h2>'+seg(parts.map(p=>['part:'+p,p==='all'?'Tất cả':esc(p),resultPart===p]),'Lọc theo phần')+'</div>'+
   '<div class="cards">'+(cardsHtml||'<p>Bạn đã trả lời đúng tất cả các câu trong mục này.</p>')+'</div>';
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
  document.getElementById('exam-parts').innerHTML=partTabs();
  updateProgress();
  setRate(rate);
  onExamPage?.(exam.id,exam.pages[pageIndex][0]);
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
  submitted={examCode:exam.id,title:exam.title,at:Date.now(),correct:sections.reduce((n,s)=>n+s.correct,0),graded:sections.reduce((n,s)=>n+s.graded,0),sections,responses:draft.answers,
   mode:draft.deadline?'timed':'practice',...(draft.startedAt?{duration:Math.min(Date.now()-draft.startedAt,(draft.deadline??Infinity)-draft.startedAt)}:{})};
  history().push(submitted);
  save();
  draft=null;keep();showWrong=submitted.correct<submitted.graded;confirmSubmit=false;resultPart='all';go(route('result'));
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
   if(subpage==='detail')return detail();
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
  const answered=Object.keys(draft.answers).length;
  const progress=document.getElementById('exam-progress');
  if(progress)progress.textContent=answered+'/'+total()+' câu đã trả lời';
  const count=document.getElementById('exam-count');
  if(count)count.textContent='Đã làm '+answered+'/'+total();
  const map=document.getElementById('exam-grid');
  if(map)map.innerHTML=grid();
 }
 async function handle([action,first,second,third]){
  if(action==='resume-practice'){
   if(activePractice?.()===first&&await requireAccess())go('quiz');
   return;
  }
  if(action==='filter-list'){listFilter=first;render();return}
  if(['start','resume','result','detail'].includes(action)){
   const paper=papers.find(item=>item.id===first);
   if(!paper)return;
   select(paper);
  }
  if(!exam)return;
  if(action==='detail'){confirmNew=false;go(route('detail'))}
  else if(action==='mode'){detailMode=first==='timed'?'timed':'practice';confirmNew=false;render()}
  else if(action==='ask-new'){confirmNew=true;render()}
  else if(action==='cancel-new'){confirmNew=false;render()}
  else if(action==='start'){
   if(third!=='confirmed'&&draft&&Object.keys(draft.answers).length&&!confirm('Bắt đầu lại và bỏ phiếu đang làm?'))return;
   if(!await requireAccess())return;
   draft={answers:{},flags:[],startedAt:Date.now(),deadline:second==='timed'?Date.now()+exam.seconds*1000:null};
   pageIndex=0;confirmNew=false;confirmSubmit=false;keep();go(route('take'));
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
  else if(action==='goto'&&draft){
   const n=Number(first),index=exam.pages.findIndex(([,a,b])=>n>=a&&n<=b);
   if(index<0)return;
   if(index!==pageIndex){pageIndex=index;keep();updateSheet()}
   const target=document.getElementById('exam-q-'+n);
   target?.scrollIntoView({block:'center'});
   target?.querySelector('button,input')?.focus({preventScroll:true});
  }
  else if(action==='flag'&&draft){
   const n=Number(first);
   draft.flags=draft.flags?.includes(n)?draft.flags.filter(x=>x!==n):[...(draft.flags??[]),n];
   keep();
   const btn=document.querySelector('[data-action="exam:flag:'+n+'"]');
   if(btn){const on=draft.flags.includes(n);btn.setAttribute('aria-pressed',String(on));btn.textContent=on?'Đã đánh dấu':'Đánh dấu xem lại'}
   updateProgress();
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
   if(!blank)await finishIfAllowed();
   else{confirmSubmit=true;render();window.scrollTo(0,0);document.getElementById('cf-h')?.closest('section')?.querySelector('.btn')?.focus()}
  }
  else if(action==='cancel-submit'){confirmSubmit=false;render()}
  else if(action==='confirm-submit'&&draft){confirmSubmit=false;await finishIfAllowed()}
  else if(action==='result'){
   submitted=saved().find(item=>item.examCode===exam.id&&item.at===Number(second));
   if(submitted){showWrong=submitted.correct<submitted.graded;resultPart='all';go(route('result'))}
  }
  else if(action==='filter'&&submitted){showWrong=!showWrong;render()}
  else if(action==='part'&&submitted){resultPart=first==='all'||exam.sections.some(([name])=>name===first)?first:'all';render()}
 }
 setInterval(tick,1000);
 return {page,handle,input,setRate};
}
