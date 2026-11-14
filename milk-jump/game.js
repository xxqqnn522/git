"use strict";
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score'), bestEl = document.querySelector('#best');
const message = document.querySelector('#message'), power = document.querySelector('#power');
const difficulties={
  easy:{name:'简单',width:[190,240],gap:[260,340],step:0,minY:390,maxY:390,description:'大饼干 · 没有上下起伏'},
  hard:{name:'困难',width:[130,180],gap:[220,370],step:35,minY:345,maxY:425,description:'中等饼干 · 轻微上下起伏'},
  hell:{name:'地狱',width:[80,190],gap:[200,400],step:110,minY:280,maxY:450,description:'高低、宽度和间距大幅随机'}
};
let difficulty='easy';
try{const saved=localStorage.getItem('milk-hop-difficulty');if(Object.hasOwn(difficulties,saved))difficulty=saved;}catch{}
const bestKey=()=>difficulty==='hell'?'milk-hop-best':'milk-hop-best-'+difficulty;
let best = 0;
try { best = Number(localStorage.getItem(bestKey())) || 0; } catch {}
bestEl.textContent = best;
let platforms, player, score, state, chargeStart, flight, camera, lastTime;
const characters = [
  {name:'奶蛋',crop:[45,275,370,380]},
  {name:'奶鼠',crop:[475,240,370,415]},
  {name:'奶娃',crop:[880,60,365,610]},
  {name:'奶狗',crop:[1325,235,385,420]},
  {name:'奶鸡',crop:[1760,220,380,435]}
];
const voices = ['egg','mouse','baby','dog','chicken'].map(id => {
  const audio = new Audio('assets/audio/' + id + '.wav');
  audio.preload = 'auto';
  return audio;
});
let bounceStart = null;
let laughStart = null;
function stopCharacterInteraction() {
  bounceStart = null;
  laughStart = null;
  voices.forEach(audio => { audio.pause(); audio.currentTime = 0; });
}
const laughFrameCount=422,laughFps=30;
const laughSheets=Array.from({length:7},(_,index)=>{
  const image=new Image();
  image.src='assets/baby/laugh-sheet-'+String(index+1).padStart(2,'0')+'.webp';
  return image;
});
function laughPose(now) {
  if(laughStart===null)return {active:false,frame:0};
  // 点击事件可能晚于本帧的时间戳，不能让帧编号变成负数。
  const elapsed=Math.max(0,now-laughStart);
  if(elapsed>=laughFrameCount/laughFps*1000){laughStart=null;return {active:false,frame:0};}
  return {active:true,frame:Math.min(laughFrameCount-1,Math.floor(elapsed/1000*laughFps))};
}
function interactWithCharacter() {
  if (state !== 'ready') return;
  // 动画播放期间的重复点击不重置画面或声音。
  if(selectedCharacter===2 && laughPose(performance.now()).active) return;
  stopCharacterInteraction();
  if(selectedCharacter===2) laughStart=performance.now();
  else bounceStart = performance.now();
  voices[selectedCharacter].play().catch(() => {
    characterStatus.textContent = '声音播放失败，请检查浏览器声音设置或刷新后再试。';
  });
}
let selectedCharacter=0;
try { const saved=Number(localStorage.getItem('milk-hop-character')); if(Number.isInteger(saved)&&saved>=0&&saved<characters.length)selectedCharacter=saved; } catch {}
const sprites=new Image();
const characterStatus=document.querySelector('#character-status');
const characterButtons=characters.map((character,index)=>{
  const button=document.createElement('button');button.type='button';button.className='character-option';
  button.setAttribute('aria-label',`选择${character.name}`);button.setAttribute('aria-pressed',String(index===selectedCharacter));
  const preview=document.createElement('canvas');preview.width=96;preview.height=96;preview.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent=character.name;button.append(preview,label);
  button.addEventListener('click',()=>{
    selectedCharacter=index;
    characterButtons.forEach((item,i)=>item.setAttribute('aria-pressed',String(i===index)));
    characterStatus.textContent=`当前搭档：${character.name} · 五位角色能力相同`;
    try {localStorage.setItem('milk-hop-character',String(index));} catch {}
    stopCharacterInteraction();
  });
  document.querySelector('#characters').append(button);return button;
});
sprites.onload=()=>{
  characters.forEach((character,index)=>{
    const c=character.crop,h=84,w=c[2]/c[3]*h;
    characterButtons[index].querySelector('canvas').getContext('2d').drawImage(sprites,...c,(96-w)/2,96-h,w,h);
  });
  characterStatus.textContent=`当前搭档：${characters[selectedCharacter].name} · 五位角色能力相同`;
};
sprites.onerror=()=>{characterStatus.textContent='角色图片加载失败，请检查 assets/characters.png 后刷新。';};
sprites.src='assets/characters.png';
const ground = 390, maxCharge = 1500;
// 画布中 y 越小，位置越高。限制相邻高度差，避免平台变化太突然。
function nextPlatform(previous) {
  const config=difficulties[difficulty];
  const y = Math.max(config.minY,Math.min(config.maxY,previous.y+(Math.random()*2-1)*config.step));
  return {x:previous.x+config.gap[0]+Math.random()*(config.gap[1]-config.gap[0]),y,
    w:config.width[0]+Math.random()*(config.width[1]-config.width[0])};
}
function reset() {
  window.MilkLeaderboard?.finish(score,'restart');
  stopChargeSound();
  platforms = [{x:180,y:ground,w:difficulties[difficulty].width[1]}];
  platforms.push(nextPlatform(platforms[0]));
  player = {x:180,y:ground}; score = 0; state = 'ready'; camera = 0; flight = null;
  stopCharacterInteraction();
  scoreEl.textContent = score; setPower(0);
  message.textContent = '准备好了吗？按住绿色按钮蓄力，松开起跳！';
}
function setPower(value) { power.style.width = `${value * 100}%`; document.querySelector('.meter').setAttribute('aria-valuenow', Math.round(value * 100)); }
let chargeAudioContext=null,chargeTone=null;
function startChargeSound(){
  stopChargeSound();
  try{
    const AudioEngine=window.AudioContext||window.webkitAudioContext;
    if(!AudioEngine)return;
    chargeAudioContext ||= new AudioEngine();
    chargeAudioContext.resume().catch(()=>{});
    const oscillator=chargeAudioContext.createOscillator(),gain=chargeAudioContext.createGain();
    const time=chargeAudioContext.currentTime;
    oscillator.type='sine';
    oscillator.frequency.setValueAtTime(220,time);
    oscillator.frequency.exponentialRampToValueAtTime(880,time+maxCharge/1000);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(0.07,time+0.025);
    oscillator.connect(gain);gain.connect(chargeAudioContext.destination);oscillator.start();
    chargeTone={oscillator,gain};
  }catch{stopChargeSound();}
}
function stopChargeSound(){
  if(!chargeTone)return;
  const tone=chargeTone;chargeTone=null;
  try{
    const time=chargeAudioContext.currentTime;
    tone.gain.gain.cancelScheduledValues(time);tone.gain.gain.setTargetAtTime(0,time,0.008);
    tone.oscillator.stop(time+0.04);
    tone.oscillator.onended=()=>{tone.oscillator.disconnect();tone.gain.disconnect();};
  }catch{}
}
function begin() { if (state !== 'ready') return; stopCharacterInteraction(); window.MilkLeaderboard?.start(difficulty); state = 'charging'; chargeStart = performance.now(); startChargeSound(); }
function release() {
  if (state !== 'charging') return;
  stopChargeSound();
  const strength = Math.min((performance.now()-chargeStart)/maxCharge,1);
  const distance=60+strength*480;
  const landing=findLandingPlatform(player.x+distance);
  flight = {start:performance.now(),x:player.x,y:player.y, targetY:landing ? landing.y : player.y, distance,duration:700};
  state = 'jumping'; setPower(0); message.textContent = '呼——飞起来啦！';
}
function hasLandingSupport(x, platform, characterIndex=selectedCharacter) {
  // 与画布中角色的绘制宽度一致；按水平方向的重叠比例判定支撑。
  const crop=characters[characterIndex].crop;
  const width=crop[2]/crop[3]*90;
  const overlap=Math.max(0,Math.min(x+width/2,platform.x+platform.w/2)
    -Math.max(x-width/2,platform.x-platform.w/2));
  return overlap+1e-7>=width*0.8;
}
function findLandingPlatform(x) {
  return platforms.filter(platform=>hasLandingSupport(x,platform))
    .sort((a,b)=>Math.abs(x-a.x)-Math.abs(x-b.x))[0] || null;
}
function finish() {
  const target = platforms[platforms.length-1];
  const landed=findLandingPlatform(player.x);
  if (landed) {
    player.y=landed.y;
    state='ready';
    // 已经踩过的饼干仍然提供支撑，但不能在原地刷分或生成新平台。
    if(landed!==target){
      message.textContent='稳稳落在饼干上！继续蓄力，向下一块出发。';
      return;
    }
    const perfect = Math.abs(player.x-target.x)<16;
    score += perfect ? 2 : 1; scoreEl.textContent = score;
    if (score>best) { best=score; bestEl.textContent=best; try { localStorage.setItem(bestKey(),String(best)); } catch {} }
    message.textContent = perfect ? '正中饼干！漂亮一跳 +2' : '稳稳落地！再来一跳 +1';
    player.y = target.y;
    platforms.push(nextPlatform(target));
    if(platforms.length>5) platforms.shift();
    state='ready';
  } else { window.MilkLeaderboard?.finish(score); state='falling'; flight={start:performance.now()}; message.textContent='哎呀，踩空啦！点击「重新开始」再试一次。'; }
}
function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function cloud(x,y,s){ctx.fillStyle='#ffffff99';ctx.beginPath();ctx.ellipse(x,y,48*s,14*s,0,0,Math.PI*2);ctx.ellipse(x-16*s,y-9*s,21*s,17*s,0,0,Math.PI*2);ctx.ellipse(x+10*s,y-15*s,25*s,21*s,0,0,Math.PI*2);ctx.fill();}
function baby(x,y,squash,pose={active:false,frame:0}){
 ctx.save();ctx.translate(x,y);ctx.scale(1,1-squash*.18);
 ctx.fillStyle='#ced7bf';ctx.beginPath();ctx.ellipse(0,7,25,7,0,0,Math.PI*2);ctx.fill();
 if(pose.active && selectedCharacter===2){
   const sheet=laughSheets[Math.floor(pose.frame/64)],cell=pose.frame%64;
   // 原素材每帧 288×368，保留脚底位置及完整的倒地动作。
   if(sheet && sheet.complete && sheet.naturalWidth>0){
     ctx.drawImage(sheet,(cell%8)*288,Math.floor(cell/8)*368,288,368,-44,-103,88,112);
   }else if(sprites.complete && sprites.naturalWidth){
     const c=characters[selectedCharacter].crop;
     ctx.drawImage(sprites,...c,-c[2]/c[3]*45,-90,c[2]/c[3]*90,90);
   }else{roundRect(-20,-55,40,55,20,'#f3cd50');}
 }else if(sprites.complete && sprites.naturalWidth){
   const c=characters[selectedCharacter].crop,height=90,width=c[2]/c[3]*height;
   ctx.drawImage(sprites,...c,-width/2,-height,width,height);
 }else{roundRect(-20,-55,40,55,20,'#f3cd50');}
 ctx.restore();
}
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min((now-(lastTime||now))/1000,.05); lastTime=now;
 let strength=state==='charging'?Math.min((now-chargeStart)/maxCharge,1):0;
 if(state==='charging')setPower(strength);
 if(state==='jumping') { const t=Math.min((now-flight.start)/flight.duration,1);player.x=flight.x+flight.distance*t;player.y=flight.y+(flight.targetY-flight.y)*t-Math.sin(t*Math.PI)*155;if(t===1)finish(); }
 if(state==='falling'){player.y+=430*dt;if(player.y>650)state='over';}
 const desired=Math.max(0,(state==='jumping'?flight.x:player.x)-230);camera+=(desired-camera)*Math.min(1,dt*6);
 ctx.clearRect(0,0,960,540);ctx.fillStyle='#e8efdf';ctx.fillRect(0,0,960,540);
 ctx.fillStyle='#dce7d0';ctx.beginPath();ctx.arc(820,540,250,Math.PI,0);ctx.fill();
 cloud(140-camera*.12,120,1.1);cloud(540-camera*.08,190,.75);cloud(855-camera*.1,100,1.3);
 ctx.fillStyle='#b5c6a6';ctx.font='16px Georgia';ctx.fillText('✦',720,240);ctx.fillText('✦',290,200);
 for(const p of platforms){const x=p.x-camera,y=p.y;ctx.fillStyle='#ced9bd';ctx.beginPath();ctx.ellipse(x,y+55,p.w*.6,13,0,0,7);ctx.fill();roundRect(x-p.w/2,y,p.w,34,12,'#bb8c59');roundRect(x-p.w/2,y-9,p.w,29,12,'#e7c28d');ctx.strokeStyle='#d2aa72';ctx.lineWidth=2;ctx.setLineDash([3,6]);ctx.strokeRect(x-p.w/2+10,y-1,p.w-20,12);ctx.setLineDash([]);for(let i=-1;i<=1;i++){ctx.fillStyle='#bc915f';ctx.beginPath();ctx.arc(x+i*25,y+5,2.5,0,7);ctx.fill();}}
 const bounceProgress = bounceStart === null ? 1 : Math.min((now-bounceStart)/450,1);
 const bounceOffset = state === 'ready' ? Math.sin(bounceProgress*Math.PI)*32 : 0;
 if(bounceProgress === 1) bounceStart = null;
 const pose=laughPose(now);
 baby(player.x-camera,player.y-bounceOffset,strength,pose);
 ctx.fillStyle='#8c9f80';ctx.font='12px "Microsoft YaHei"';ctx.fillText('饼干之间的距离不同，记得调整蓄力时间哦',28,510);
}
const jumpButton = document.querySelector('#jump');
let jumpPointer = null;
jumpButton.addEventListener('pointerdown',e=>{
  if(e.button!==0 || state!=='ready' || jumpPointer!==null)return;
  e.preventDefault();jumpPointer=e.pointerId;jumpButton.setPointerCapture(e.pointerId);begin();
});
jumpButton.addEventListener('pointerup',e=>{
  if(e.pointerId!==jumpPointer)return;
  jumpPointer=null;release();
});
function cancelCharge(){
  stopChargeSound();
  jumpPointer=null;
  if(state==='charging'){state='ready';setPower(0);}
}
jumpButton.addEventListener('pointercancel',cancelCharge);
jumpButton.addEventListener('lostpointercapture',cancelCharge);
// 支持键盘操作绿色按钮；页面其他位置的空格键不再触发跳跃。
jumpButton.addEventListener('keydown',e=>{
  if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)begin();}
});
jumpButton.addEventListener('keyup',e=>{
  if(e.code==='Space'||e.code==='Enter'){e.preventDefault();release();}
});
jumpButton.addEventListener('blur',cancelCharge);
canvas.addEventListener('click',e=>{
  if(state!=='ready')return;
  const bounds=canvas.getBoundingClientRect();
  const x=(e.clientX-bounds.left)*canvas.width/bounds.width;
  const y=(e.clientY-bounds.top)*canvas.height/bounds.height;
  const crop=characters[selectedCharacter].crop,width=crop[2]/crop[3]*90;
  const progress=bounceStart===null?1:Math.min((performance.now()-bounceStart)/450,1);
  const pose=laughPose(performance.now());
  const feet=player.y-Math.sin(progress*Math.PI)*32;
  if(Math.abs(x-(player.x-camera))<=width/2+16 && y>=feet-105 && y<=feet+12)interactWithCharacter();
});
window.addEventListener('blur',cancelCharge);
document.querySelector('#restart').addEventListener('click',reset);
const difficultySelect=document.querySelector('#difficulty');
difficultySelect.value=difficulty;
function updateDifficultyDescription(){document.querySelector('#difficulty-description').textContent=difficulties[difficulty].description+' · 切换难度会重新开始，最佳分按难度记录';}
updateDifficultyDescription();
difficultySelect.addEventListener('change',()=>{
  if(!Object.hasOwn(difficulties,difficultySelect.value))return;
  window.MilkLeaderboard?.finish(score,'difficulty');
  cancelCharge();difficulty=difficultySelect.value;
  try{localStorage.setItem('milk-hop-difficulty',difficulty);best=Number(localStorage.getItem(bestKey()))||0;}catch{best=0;}
  bestEl.textContent=best;updateDifficultyDescription();reset();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelCharge();});
reset();requestAnimationFrame(frame);
