// Original synthesized effects and a short cinematic score. No remote audio.
let enabled=localStorage.getItem('iflab-sound')!=='off',context;
const voices=new Set();
export const soundEnabled=()=>enabled;
function audio(){if(!enabled)return null;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;context||=new Audio();context.resume().catch(()=>{});return context;}catch{return null;}}
function tone(ctx,freq,start,duration,volume=.045,type='sine',output=ctx.destination){
 const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.value=freq;
 gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 osc.connect(gain);gain.connect(output);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+.01);return osc;
}
export function toggleSound(){enabled=!enabled;if(!enabled)window.speechSynthesis?.cancel();localStorage.setItem('iflab-sound',enabled?'on':'off');if(enabled)sound('explore');else for(const voice of voices){try{voice.stop();}catch{}}return enabled;}
export function sound(type){
 const ctx=audio();if(!ctx)return;
 try{const notes={explore:[330,495],correct:[523,659,784],fragment:[392,523,659,1047],unlock:[262,392,523,784,1047],wrong:[180,130],hint:[440,554],visitor:[440,415,330,220]}[type]||[440];
 notes.forEach((f,i)=>tone(ctx,f,ctx.currentTime+i*.085,.24,.05,type==='wrong'?'triangle':'sine'));}catch{}
}
export function impact(type,title,detail=''){
 sound(type);document.querySelector('.discovery-impact')?.remove();
 const node=document.createElement('div');node.className=`discovery-impact ${type}`;node.setAttribute('role','status');
 const symbol=document.createElement('span');symbol.className='discovery-symbol';symbol.textContent=type==='fragment'?'◇':type==='unlock'?'◎':type==='wrong'?'!':'✦';
 const text=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('span');strong.textContent=title;small.textContent=detail;text.append(strong,small);node.append(symbol,text);document.body.append(node);
 const scene=document.querySelector('.room-scene');scene?.classList.add('event-'+type);
 setTimeout(()=>{node.remove();scene?.classList.remove('event-'+type);},3000);
}
function dramaticScore(){
 const ctx=audio();if(!ctx)return ()=>{};
 const scheduled=[],start=ctx.currentTime;
 try{
  // D minor → B-flat → A: bass pulses, suspended harmony and rising melody.
  [[146.83,174.61,220],[116.54,146.83,174.61],[110,138.59,164.81]].forEach((chord,c)=>{
   chord.forEach(f=>scheduled.push(tone(ctx,f,start+c*1.15,1.3,.025,'triangle')));
   scheduled.push(tone(ctx,chord[0]/2,start+c*1.15,.85,.06,'sine'));
  });
  [293.66,349.23,440,523.25,466.16,440,349.23,440,554.37,659.25,880,1174.66].forEach((f,i)=>scheduled.push(tone(ctx,f,start+i*.27,.48,.04,'sine')));
  scheduled.push(tone(ctx,587.33,start+3.3,.65,.05,'triangle'));
 }catch{}
 return ()=>{for(const voice of scheduled){try{voice.stop();}catch{}}};
}
let activeJump;
export function portalJourney(from,to,title,source='assets/laboratory.webp',destination=source){
 activeJump?.();document.querySelector('.future-visitor')?.remove();document.querySelector('.discovery-impact')?.remove();
 const stopMusic=dramaticScore(),dialog=document.createElement('dialog');dialog.className='portal-journey';
 dialog.style.setProperty('--zoom-from',from);dialog.style.setProperty('--zoom-to',to);
 const visual=document.createElement('div');visual.className='journey-view';
 const img=document.createElement('img');img.src=source;img.alt='Moving closer to the time portal';visual.append(img);const next=document.createElement('img');next.src=destination;next.alt='The next viewpoint in the laboratory';next.className='journey-next';visual.append(next);
 const copy=document.createElement('div');copy.className='journey-copy';
 const tag=document.createElement('p');tag.className='eyebrow';tag.textContent='TIMELINE STABILISED / MOVING FORWARD';
 const heading=document.createElement('h2');heading.textContent=title;
 const caption=document.createElement('p');caption.textContent=title.includes('present')?'The present is waiting for you.':'One step closer to the portal. Hold on to your timeline.';
 const actions=document.createElement('div');actions.className='row';
 const skip=document.createElement('button');skip.className='btn';skip.textContent='Continue →';
 const mute=document.createElement('button');mute.className='btn secondary';mute.textContent=enabled?'♫ Sound on':'♪ Sound off';mute.setAttribute('aria-pressed',enabled);mute.onclick=()=>{toggleSound();mute.textContent=enabled?'♫ Sound on':'♪ Sound off';mute.setAttribute('aria-pressed',enabled);const main=document.querySelector('#sound-toggle');if(main){main.textContent=mute.textContent;main.setAttribute('aria-pressed',enabled);}};
 actions.append(skip,mute);copy.append(tag,heading,caption,actions);dialog.append(visual,copy);document.body.append(dialog);
 return new Promise(resolve=>{
  let finished=false,timer;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);stopMusic();dialog.close();dialog.remove();activeJump=null;resolve();};
  activeJump=finish;skip.onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});dialog.showModal();timer=setTimeout(finish,4000);
 });
}
export function futureVisitor(visit=1){
 document.querySelector('.future-visitor')?.remove();document.querySelector('.discovery-impact')?.remove();sound('visitor');
 const lines=[
  'Again? Oh, brilliant. If this keeps happening, I’ll be stuck in the future!',
  'Two mistakes? If I had brought a book, I wouldn’t be so bored here now.',
  'I’d rather you checked the time clues. My dinner is getting cold… in 2086.',
  'Had I known about this delay, I would have packed more sandwiches.'
 ];
 const node=document.createElement('aside');node.className='future-visitor';node.setAttribute('popover','manual');node.setAttribute('aria-label','A message from the future');
 const image=document.createElement('img');image.src='assets/future-traveller.png';image.alt='A mildly exasperated time traveller checking his wrist device';
 const bubble=document.createElement('div');bubble.className='visitor-bubble';
 const label=document.createElement('strong');label.textContent='FELIX / STILL IN 2086';
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent=lines[(visit-1)%lines.length];
 const close=document.createElement('button');close.className='visitor-close';close.textContent='Got it, Felix. ×';
 let timer;const leave=()=>{clearTimeout(timer);window.speechSynthesis?.cancel();node.classList.add('leaving');setTimeout(()=>node.remove(),450);};close.onclick=leave;
 bubble.append(label,message,close);node.append(image,bubble);document.body.append(node);try{node.showPopover?.();}catch{}
 if(enabled&&'speechSynthesis' in window){try{const utterance=new SpeechSynthesisUtterance(message.textContent);utterance.lang='en-GB';utterance.rate=.98;utterance.volume=.7;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)utterance.voice=voice;speechSynthesis.cancel();speechSynthesis.speak(utterance);}catch{}}
 timer=setTimeout(leave,9000);return true;
}
