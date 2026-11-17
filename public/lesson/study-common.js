export const lessonSkills={vocab:'Từ vựng',grammar:'Ngữ pháp và vận dụng',listen:'Nghe',reading:'Đọc hiểu'};
const gradeable=q=>q.answers?.length&&!(q.origin==='curriculum'&&(q.order||q.mode==='correct'))&&!q.resource&&q.kind!==4&&q.kind!==5;
export function lessonSkill(q){
 return q.skill??({0:'vocab',1:'grammar',2:'listen',3:'reading'}[q.kind]??'grammar');
}

const targetCounts={vocab:3,grammar:4,listen:2,reading:1};

export function assessmentPlan(lesson,canPlay,shuffle=items=>items){
 const eligible=lesson.questions.filter(q=>gradeable(q)&&(!q.audio||canPlay(q.audio,q.pinyin)));
 const portion=(skill,index)=>eligible.filter(q=>lessonSkill(q)===skill&&index(q));
 const pivot=portion('reading',q=>q.origin==='guided');
 const selections=[];
 const groups=new Set();
 const newAudioGroup=eligible.find(q=>q.origin==='curriculum'&&q.kind===2)?.group;
 for(const [skill,target] of Object.entries(targetCounts)){
  const capacity=skill==='listen'&&!eligible.some(q=>q.kind===2&&q.audio)?0:target;
  const preferred=shuffle(portion(skill,q=>q.origin==='guided'||skill==='grammar'&&q.origin==='curriculum'));
  const others=portion(skill,q=>!preferred.includes(q));
  const candidates=skill==='listen'?[...others.filter(q=>q.group===newAudioGroup),...shuffle(others.filter(q=>q.group!==newAudioGroup)),...preferred]:[...preferred,...shuffle(others)];
  let count=0;
  for(const q of candidates){
   if(count>=capacity)break;
   if(skill==='grammar'&&q.group&&q.group===newAudioGroup)continue;
   // A passage should appear only once in an assessment. Use the reading variant if present.
   if(skill==='listen'&&q.group==='meaning'&&pivot.length)continue;
   const group=q.word?'word-'+q.word:q.group?'passage-'+q.group:q.zh?'text-'+q.zh:'id-'+q.id;
   if(groups.has(group))continue;
   groups.add(group);
   selections.push(q);
   count++;
  }
 }
 return selections;
}

export const pronunciationKey=(zh,pinyin)=>zh==='长'&&pinyin==='cháng'?'长（cháng）':zh;
export const kinds=['Từ vựng','Ngữ pháp','Luyện nghe','Đọc và bài tập','Dịch','Bài tập về nhà'];

export const bankGroups = {vocab:'Từ vựng & pinyin', grammar:'Ngữ pháp & xếp câu', reading:'Đọc hiểu', writing:'Dịch & viết câu'};
export const bankNames = Object.keys(bankGroups);


export const grammarModes={apply:'Chọn cấu trúc',order:'Sắp xếp câu',correct:'Sửa câu',translate:'Dịch sang tiếng Trung',listen:'Nghe và nhận diện'};
