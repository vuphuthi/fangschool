import {sameOriginFetch as fetch} from '../request.js';
import {stopAudio as stopLessonAudio} from './audio-player.js?v=4';

// Giọng nói cho trợ giảng AI.
// Đọc: giọng AI của Cloudflare (máy chủ cache từng câu); lỗi hoặc hết hạn mức thì dùng giọng tiếng Trung của hệ điều hành.
// Nghe: nhận dạng giọng nói của trình duyệt nếu có (miễn phí, hiện chữ ngay); không có thì ghi âm và gửi lên Whisper.
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
const SILENCE='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const MAX_SECONDS=20;

async function errorText(response,fallback){
 try{const body=await response.json();return body.error??body.message??fallback}catch{return fallback}
}

export function createVoice({onChange}){
 const player=new Audio();
 player.preload='auto';
 player.setAttribute('playsinline','');
 const cache=new Map();
 let unlocked=false,queue=[],current='',revision=0,rate=1;
 let recognizer=null,recorder=null,stream=null,timer=null,browserRecognitionBroken=false;
 const state={speaking:'',listening:'idle'};
 const emit=()=>onChange?.({...state});

 // iOS chỉ cho phát âm thanh trong thao tác chạm; mở khóa sẵn khi người dùng bấm Gửi để câu trả lời tự đọc được.
 function unlock(){
  if(unlocked)return;
  unlocked=true;
  player.src=SILENCE;
  player.play().then(()=>player.pause()).catch(()=>{unlocked=false});
 }

 async function audioFor(text){
  if(cache.has(text))return cache.get(text);
  const pending=(async()=>{
   const response=await fetch('/api/ai/speech',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({text})});
   if(!response.ok)throw Object.assign(new Error(await errorText(response,'Chưa tạo được giọng đọc.')),{status:response.status});
   return URL.createObjectURL(await response.blob());
  })();
  cache.set(text,pending);
  pending.catch(()=>cache.delete(text));
  return pending;
 }

 function systemVoice(){
  const voices=window.speechSynthesis?.getVoices()??[];
  return voices.find(voice=>/^zh[-_]CN/i.test(voice.lang))??voices.find(voice=>/^zh/i.test(voice.lang));
 }
 function speakWithSystem(text,request){
  return new Promise((resolve,reject)=>{
   const voice=systemVoice();
   if(!voice){reject(new Error('Máy chưa có giọng đọc tiếng Trung. Hãy thử lại sau.'));return}
   const utterance=new SpeechSynthesisUtterance(text);
   utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=rate<1?.8:1;
   utterance.onend=()=>resolve();
   utterance.onerror=()=>resolve();
   if(request!==revision){resolve();return}
   window.speechSynthesis.speak(utterance);
  });
 }

 function playUrl(url,request){
  return new Promise((resolve,reject)=>{
   if(request!==revision){resolve();return}
   player.onended=()=>resolve();
   player.onerror=()=>reject(new Error('Không phát được giọng đọc.'));
   player.src=url;
   player.defaultPlaybackRate=rate;player.playbackRate=rate;player.preservesPitch=true;
   player.play().catch(reject);
  });
 }

 async function run(request){
  while(queue.length&&request===revision){
   const text=queue.shift();
   current=text;state.speaking=text;emit();
   try{
    await playUrl(await audioFor(text),request);
   }catch(error){
    if(request!==revision)return;
    if(error.name==='NotAllowedError'){stop();return}// trình duyệt chặn tự phát: người học bấm nút nghe là được
    try{await speakWithSystem(text,request)}
    catch(fallback){stop();throw new Error(error.status===429?error.message:fallback.message)}
   }
  }
  if(request===revision){current='';state.speaking='';emit()}
 }

 function stop(){
  revision++;
  queue=[];current='';
  player.pause();
  window.speechSynthesis?.cancel();
  if(state.speaking){state.speaking='';emit()}
 }

 // Phát lần lượt các câu; bấm lại đúng câu đang đọc thì dừng.
 function play(texts){
  const list=texts.map(text=>String(text??'').trim()).filter(Boolean);
  const toggleOff=list.length===1&&current===list[0];
  stop();
  if(toggleOff||!list.length)return Promise.resolve();
  stopLessonAudio();
  queue=list;
  return run(revision);
 }

 // ===== Nghe =====
 const canListen=()=>Boolean(window.isSecureContext&&navigator.mediaDevices?.getUserMedia&&(SpeechRec||window.MediaRecorder));
 function release(){
  clearTimeout(timer);timer=null;
  stream?.getTracks().forEach(track=>track.stop());stream=null;
 }
 function setListening(value){state.listening=value;emit()}

 function listenInBrowser({onText,onDone,onError}){
  let heard='',failed=false;
  recognizer=new SpeechRec();
  recognizer.lang='zh-CN';recognizer.interimResults=true;recognizer.continuous=false;recognizer.maxAlternatives=1;
  recognizer.onresult=event=>{
   heard=[...event.results].map(result=>result[0].transcript).join('');
   onText(heard);
  };
  recognizer.onerror=event=>{
   failed=true;
   if(event.error==='network'||event.error==='service-not-allowed'||event.error==='language-not-supported'){
    browserRecognitionBroken=true;
    onError('Nhận dạng của trình duyệt đang lỗi. Bấm micro lần nữa để dùng nhận dạng của FangSchool.');
   }else if(event.error==='not-allowed')onError('Trình duyệt chặn micro. Hãy cho phép FangSchool dùng micro.');
   else if(event.error==='no-speech')onError('Chưa nghe thấy giọng nói. Bấm micro và nói lại nhé.');
   else if(event.error!=='aborted')onError('Chưa nhận dạng được. Hãy thử lại.');
  };
  recognizer.onend=()=>{
   recognizer=null;release();setListening('idle');
   if(!failed)heard.trim()?onDone(heard.trim()):onError('Chưa nghe rõ. Bấm micro và nói lại nhé.');
  };
  recognizer.start();
  setListening('listening');
  timer=setTimeout(()=>recognizer?.stop(),MAX_SECONDS*1000);
 }

 async function listenWithServer({onDone,onError}){
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch{onError('Chưa dùng được micro. Hãy cho phép FangSchool truy cập micro trong trình duyệt.');setListening('idle');return}
  const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(item=>MediaRecorder.isTypeSupported?.(item));
  const chunks=[];
  recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
  recorder.onstop=async()=>{
   const mime=recorder.mimeType||type||'audio/webm';
   recorder=null;release();
   const blob=new Blob(chunks,{type:mime});
   if(blob.size<1200){setListening('idle');onError('Bản ghi quá ngắn. Bấm micro, nói xong rồi bấm dừng.');return}
   setListening('processing');
   try{
    const form=new FormData();
    form.append('audio',blob,'speech.'+(mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm'));
    const response=await fetch('/api/ai/transcribe',{method:'POST',headers:{Accept:'application/json'},body:form});
    if(!response.ok)throw new Error(await errorText(response,'Chưa nhận dạng được giọng nói.'));
    const {text}=await response.json();
    text?.trim()?onDone(text.trim()):onError('Chưa nghe rõ. Bấm micro và nói lại nhé.');
   }catch(error){onError(error instanceof TypeError?'Không kết nối được. Vui lòng thử lại.':error.message)}
   finally{setListening('idle')}
  };
  recorder.start();
  setListening('listening');
  timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},MAX_SECONDS*1000);
 }

 // Bấm lần một để bắt đầu nghe, bấm lần hai để dừng.
 function listen(handlers){
  if(state.listening==='processing')return;
  if(state.listening==='listening'){
   if(recognizer)recognizer.stop();
   else if(recorder?.state==='recording')recorder.stop();
   return;
  }
  stop();
  stopLessonAudio();
  if(!canListen()){handlers.onError(window.isSecureContext?'Trình duyệt này chưa hỗ trợ ghi âm.':'Micro chỉ dùng được khi mở FangSchool qua HTTPS.');return}
  if(SpeechRec&&!browserRecognitionBroken){
   try{listenInBrowser(handlers);return}catch{browserRecognitionBroken=true}
  }
  void listenWithServer(handlers);
 }
 function cancelListening(){
  if(recognizer){recognizer.onend=null;recognizer.abort?.();recognizer=null}
  if(recorder){recorder.onstop=null;try{recorder.stop()}catch{}recorder=null}
  release();
  if(state.listening!=='idle')setListening('idle');
 }

 window.speechSynthesis?.getVoices();
 return {
  play,stop,unlock,listen,cancelListening,canListen,
  setRate:value=>{rate=value;player.playbackRate=value},
  get speaking(){return state.speaking},
  get listening(){return state.listening}
 };
}
