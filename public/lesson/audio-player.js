const audioBase = new URL('/audio/', import.meta.url);
const player = new Audio();
player.preload = 'none';
player.id = 'mandarin-player';
player.hidden = true;
document.body.append(player);
player.setAttribute('playsinline', '');
let revision = 0;
let activeButton;
let context,sequenceSource,sequenceFetch;
let activeRate=1;

function setPlaying(playing){
 if(!activeButton)return;
 activeButton.classList.toggle('active', playing);
 activeButton.setAttribute('aria-pressed', String(playing));
 if(!playing)activeButton=undefined;
}

player.addEventListener('ended', ()=>setPlaying(false));

export function stopAudio(){
 revision++;
 setPlaying(false);
 player.pause();
 sequenceFetch?.abort();
 sequenceFetch=undefined;
 if(sequenceSource){sequenceSource.stop();sequenceSource=undefined;}
}

export function playRecording(file, rate, notify, button){
 const sameButton = button && button===activeButton;
 stopAudio();
 if(sameButton)return;
 activeButton = button;
 setPlaying(true);
 activeRate=rate;
 if(Array.isArray(file))void playSequence(file,notify,revision);
 else playRecordingFile(file,rate,notify,revision);
}

function playRecordingFile(file, rate, notify, request){
 const src = new URL(file, audioBase).href;
 if(player.src!==src)player.src = src;
 else player.currentTime = 0;
 player.defaultPlaybackRate = rate;
 player.playbackRate = rate;
 // Keep play() in the tap handler when no system voice is available, including on iOS.
 player.play().catch(error=>{
  if(request!==revision)return;
  setPlaying(false);
  notify(error.name==='NotAllowedError'
   ?'Trình duyệt chặn phát âm thanh. Hãy thử mở trang trong Safari và bấm Nghe.'
   :'Không phát được bản âm thanh. Hãy thử lại.');
 });
}

async function playSequence(files,notify,request){
 try{
  const AudioEngine=window.AudioContext??window.webkitAudioContext;
  context??=new AudioEngine();
  const ready=context.resume();
  sequenceFetch=new AbortController();
  const {signal}=sequenceFetch;
  await ready;
  const parts=await Promise.all(files.map(async file=>{
   const response=await fetch(new URL(file,audioBase),{signal});
   if(!response.ok)throw new Error('Audio unavailable');
   return context.decodeAudioData(await response.arrayBuffer());
  }));
  if(request!==revision)return;
  const gap=Math.round(context.sampleRate*.14);
  const frames=parts.reduce((total,part)=>total+part.length+gap,0)-gap;
  const audio=context.createBuffer(1,frames,context.sampleRate);
  let offset=0;
  for(const part of parts){
   audio.copyToChannel(part.getChannelData(0),0,offset);
   offset+=part.length+gap;
  }
  sequenceSource=context.createBufferSource();
  sequenceSource.buffer=audio;
  sequenceSource.playbackRate.value=activeRate;
  sequenceSource.connect(context.destination);
  sequenceSource.onended=()=>{
   if(request!==revision)return;
   sequenceSource=undefined;sequenceFetch=undefined;setPlaying(false);
  };
  sequenceSource.start();
 }catch(error){
  if(request!==revision)return;
  sequenceFetch?.abort();sequenceFetch=undefined;sequenceSource=undefined;
  setPlaying(false);
  notify('Không phát được cả bài. Hãy thử lại hoặc nghe từng câu.');
 }
}

export function setAudioRate(rate){
 activeRate=rate;
 player.playbackRate=rate;
 if(sequenceSource)sequenceSource.playbackRate.value=rate;
}
