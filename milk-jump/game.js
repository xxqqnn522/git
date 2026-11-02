"use strict";
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score'), bestEl = document.querySelector('#best');
const message = document.querySelector('#message'), power = document.querySelector('#power');
let best = 0;
try { best = Number(localStorage.getItem('milk-hop-best')) || 0; } catch {}
bestEl.textContent = best;
let platforms, player, score, state, chargeStart, flight, camera, lastTime;
const characters = [
  {name:'蛋仔',crop:[45,275,370,380]},
  {name:'大耳鼠',crop:[475,240,370,415]},
  {name:'胖胖鸟',crop:[880,60,365,610]},
  {name:'开心狗',crop:[1325,235,385,420]},
  {name:'小黄鸡',crop:[1760,220,380,435]}
];
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
const ground = 390, maxCharge = 1100;
function reset() {
  platforms = [{x:180,w:140},{x:430,w:135}];
  player = {x:180,y:ground}; score = 0; state = 'ready'; camera = 0; flight = null;
  scoreEl.textContent = score; setPower(0);
  message.textContent = '准备好了吗？按住蓄力，松开起跳！';
}
function setPower(value) { power.style.width = `${value * 100}%`; document.querySelector('.meter').setAttribute('aria-valuenow', Math.round(value * 100)); }
function begin() { if (state !== 'ready') return; state = 'charging'; chargeStart = performance.now(); }
function release() {
  if (state !== 'charging') return;
  const strength = Math.min((performance.now()-chargeStart)/maxCharge,1);
  flight = {start:performance.now(),x:player.x, distance:60+strength*360,duration:700};
  state = 'jumping'; setPower(0); message.textContent = '呼——飞起来啦！';
}
function finish() {
  const target = platforms[platforms.length-1];
  if (Math.abs(player.x-target.x) <= target.w/2-12) {
    const perfect = Math.abs(player.x-target.x)<16;
    score += perfect ? 2 : 1; scoreEl.textContent = score;
    if (score>best) { best=score; bestEl.textContent=best; try { localStorage.setItem('milk-hop-best',String(best)); } catch {} }
    message.textContent = perfect ? '正中饼干！漂亮一跳 +2' : '稳稳落地！再来一跳 +1';
    platforms.push({x:target.x+190+Math.random()*140,w:105+Math.random()*35});
    if(platforms.length>5) platforms.shift();
    state='ready';
  } else { state='falling'; flight={start:performance.now()}; message.textContent='哎呀，踩空啦！点击「重新开始」再试一次。'; }
}
function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function cloud(x,y,s){ctx.fillStyle='#ffffff99';ctx.beginPath();ctx.ellipse(x,y,48*s,14*s,0,0,Math.PI*2);ctx.ellipse(x-16*s,y-9*s,21*s,17*s,0,0,Math.PI*2);ctx.ellipse(x+10*s,y-15*s,25*s,21*s,0,0,Math.PI*2);ctx.fill();}
function baby(x,y,squash){
 ctx.save();ctx.translate(x,y);ctx.scale(1,1-squash*.18);
 ctx.fillStyle='#ced7bf';ctx.beginPath();ctx.ellipse(0,7,25,7,0,0,Math.PI*2);ctx.fill();
 if(sprites.complete && sprites.naturalWidth){
   const c=characters[selectedCharacter].crop,height=90,width=c[2]/c[3]*height;
   ctx.drawImage(sprites,...c,-width/2,-height,width,height);
 }else{roundRect(-20,-55,40,55,20,'#f3cd50');}
 ctx.restore();
}
function frame(now){
 const dt=Math.min((now-(lastTime||now))/1000,.05); lastTime=now;
 let strength=state==='charging'?Math.min((now-chargeStart)/maxCharge,1):0;
 if(state==='charging')setPower(strength);
 if(state==='jumping') { const t=Math.min((now-flight.start)/flight.duration,1);player.x=flight.x+flight.distance*t;player.y=ground-Math.sin(t*Math.PI)*155;if(t===1)finish(); }
 if(state==='falling'){player.y+=430*dt;if(player.y>650)state='over';}
 const desired=Math.max(0,(state==='jumping'?flight.x:player.x)-230);camera+=(desired-camera)*Math.min(1,dt*6);
 ctx.clearRect(0,0,960,540);ctx.fillStyle='#e8efdf';ctx.fillRect(0,0,960,540);
 ctx.fillStyle='#dce7d0';ctx.beginPath();ctx.arc(820,540,250,Math.PI,0);ctx.fill();
 cloud(140-camera*.12,120,1.1);cloud(540-camera*.08,190,.75);cloud(855-camera*.1,100,1.3);
 ctx.fillStyle='#b5c6a6';ctx.font='16px Georgia';ctx.fillText('✦',720,240);ctx.fillText('✦',290,200);
 for(const p of platforms){const x=p.x-camera;ctx.fillStyle='#ced9bd';ctx.beginPath();ctx.ellipse(x,ground+55,p.w*.6,13,0,0,7);ctx.fill();roundRect(x-p.w/2,ground,p.w,34,12,'#bb8c59');roundRect(x-p.w/2,ground-9,p.w,29,12,'#e7c28d');ctx.strokeStyle='#d2aa72';ctx.lineWidth=2;ctx.setLineDash([3,6]);ctx.strokeRect(x-p.w/2+10,ground-1,p.w-20,12);ctx.setLineDash([]);for(let i=-1;i<=1;i++){ctx.fillStyle='#bc915f';ctx.beginPath();ctx.arc(x+i*25,ground+5,2.5,0,7);ctx.fill();}}
 baby(player.x-camera,player.y,strength);
 ctx.fillStyle='#8c9f80';ctx.font='12px "Microsoft YaHei"';ctx.fillText('饼干之间的距离不同，记得调整蓄力时间哦',28,510);
 requestAnimationFrame(frame);
}
for(const element of [canvas,document.querySelector('#jump')]){
 element.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();element.setPointerCapture(e.pointerId);begin();});
 element.addEventListener('pointerup',release);
 element.addEventListener('pointercancel',()=>{if(state==='charging'){state='ready';setPower(0);}});
 element.addEventListener('lostpointercapture',()=>{if(state==='charging'){state='ready';setPower(0);}});
}
window.addEventListener('keydown',e=>{if(e.code==='Space' && !['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(!e.repeat)begin();}});
window.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();release();}});
window.addEventListener('blur',()=>{if(state==='charging'){state='ready';setPower(0);}});
document.querySelector('#restart').addEventListener('click',reset);
reset();requestAnimationFrame(frame);
