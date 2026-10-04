(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),WORLD=12000,MAX_HP=200,keys=new Set(),pressed=new Set(),padKeys=new Set();let cpuSkill=1,ghost=null,online=true,onlineZone={left:0,right:WORLD},onlinePhase='lobby',onlineSelf=null,training=false,trainingGuard='none',trainingDamage=0,fighters=[],particles=[],projectiles=[],motion=[],motionFace=1,specialNotice=null,pendingWeak=null,elapsed=0,status='ready',countdownLeft=0,resumeStatus='playing',camera=0,shake=0,kills=0,rank=0,last=0,acc=0,viewW=1200,viewH=600,seed=47271;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function bounds(){if(online)return onlineZone;if(training)return {left:0,right:WORLD};const p=clamp((elapsed-10)/50,0,1);return {left:p*5770,right:WORLD-p*5770}}
function init(){cpuSkill=({easy:.45,normal:1,hard:1.6})[$('cpuDifficulty').value]||1;ghost=null;StageExperience.choose();countdownLeft=0;resumeStatus='playing';$('countdown').hidden=true;seed=47271;fighters=Array.from({length:100},(_,i)=>({id:i,x:i===0?60+Math.random()*(WORLD-120):60+((i*127.37)%11880),y:0,vx:0,vy:0,hp:MAX_HP,lastHit:-100,stun:0,throwSafe:0,face:i%2?1:-1,cool:0,attack:0,kind:'',guard:false,crouch:false,back:false,strength:0,special:null,specialReady:0,flash:0,think:rand(),target:0,color:i===0?'#caff52':['#8ac8d9','#d89485','#c6b0d6','#d9c28d'][i%4],dead:false,killer:null}));particles=[];projectiles=[];motion=[];specialNotice=null;pendingWeak=null;elapsed=0;kills=0;rank=0;camera=clamp(fighters[0].x-viewW/2,0,Math.max(0,WORLD-viewW));status='ready';keys.clear();pressed.clear();if(training)resetTraining();if(online){for(const f of fighters)f.dead=f.id!==0;}hud();}
function overlay(title,msg,button,eye='ONE RING. ONE SURVIVOR.'){ $('headline').textContent=title;$('message').innerHTML=msg;$('start').textContent=button;$('eyebrow').textContent=eye;$('overlay').hidden=false;}
function start(){StageExperience.unlock();if(online){OnlineArena.start();return;}if(status==='countdown')return;if(status==='paused'){status=resumeStatus;}else{init();status=training?'playing':'countdown';countdownLeft=training?0:5;}keys.clear();pressed.clear();motion=[];$('overlay').hidden=true;showCountdown();$('pause').textContent='一時停止';}
function showCountdown(){$('countdown').hidden=status!=='countdown';$('countNumber').textContent=String(Math.ceil(countdownLeft));}
function pause(){if(online){keys.clear();padKeys.clear();pressed.clear();OnlineArena.release();return;}if(status==='playing'||status==='countdown'){resumeStatus=status;status='paused';showCountdown();motion=[];pendingWeak=null;keys.clear();pressed.clear();overlay('PAUSED','ひと息ついたら、リングへ戻ろう。','対戦に戻る','BATTLE PAUSED');$('pause').textContent='再開';}else if(status==='paused')start();}
function hit(a,b,damage,power){if(b.dead||b.hp<=0)return;const front=(a.x-b.x)*b.face>=0;let blocked=b.guard&&front&&(a.y===0||!b.crouch)&&(!(a.crouch&&a.kind==='kick')||b.crouch);damage*=blocked?0:1;b.hp-=damage;b.lastHit=elapsed;if(training)trainingDamage=damage;b.vx=a.face*power*(blocked?.25:1);b.flash=.12;b.killer=a.id;shake=a.id===0||b.id===0?5:shake;for(let i=0;i<5;i++)particles.push({x:b.x,y:b.y+32,vx:(rand()-.5)*260,vy:rand()*220,life:.28,color:blocked?'#b6ddff':'#e5ff9e'});}
const MOVES={j:{kind:'punch',strength:0,damage:7,range:54,cool:.23,power:100},k:{kind:'punch',strength:1,damage:12,range:65,cool:.43,power:190},l:{kind:'punch',strength:2,damage:19,range:73,cool:.7,power:310},u:{kind:'kick',strength:0,damage:8,range:67,cool:.29,power:130},i:{kind:'kick',strength:1,damage:14,range:81,cool:.52,power:240},o:{kind:'kick',strength:2,damage:22,range:95,cool:.88,power:410}};
function attack(a,key){if(a.stun>0)return;if(key==='throw'){throwAttack(a);return;}const m=MOVES[key];if(!m||a.cool>0||a.dead)return;if(a.id===0){const name=matchSpecial(m.kind);motion=[];if(name&&beginSpecial(a,name,m.strength))return;}a.guard=false;a.kind=m.kind;a.strength=m.strength;a.attack=.12+m.strength*.07;a.cool=m.cool;for(const b of fighters){if(b===a||b.dead)continue;const dx=b.x-a.x;const high=a.y>0;if(Math.abs(dx)<m.range&&dx*a.face>=-12&&Math.abs(b.y-a.y)<55&&!(b.crouch&&!a.crouch&&!high&&m.kind==='punch'))hit(a,b,m.damage,m.power);}}

// Direction history is shared by keyboard, touch and gamepad input.
function recordMotion(a,horizontal,down,up){
 if(motionFace!==a.face){motion=[];motionFace=a.face;}
 const x=horizontal*a.face,y=down&&!up?-1:up&&!down?1:0;
 const direction=y<0?(x<0?1:x>0?3:2):y>0?(x<0?7:x>0?9:8):(x<0?4:x>0?6:5);
 motion=motion.filter(entry=>elapsed-entry.end<=.65);
 const previous=motion[motion.length-1];
 if(previous?.direction===direction)previous.end=elapsed;
 else motion.push({direction,time:elapsed,end:elapsed});
 if(motion.length>20)motion.shift();
}
function matchSpecial(kind){
 const recent=motion.filter(entry=>entry.direction!==5&&elapsed-entry.end<=.65);
 const tail=recent.slice(-3);if(tail.length!==3||elapsed-tail[2].time>.22)return null;
 const command=tail.map(entry=>entry.direction).join('');
 if(kind==='punch'&&command==='623')return 'rising';
 if(kind==='punch'&&command==='236')return 'wave';
 if(kind==='kick'&&command==='214')return 'spin';
 return null;
}
function beginSpecial(a,name,strength=0){
 if(a.dead||a.stun>0||a.cool>0||a.specialReady>0||a.y>0||!['wave','rising','spin'].includes(name))return false;
 const duration=name==='spin'?.55+strength*.09:name==='rising'?.62+strength*.07:.38;
 a.special={name,remaining:duration,duration,hitIds:new Set()};a.strength=strength;a.guard=false;a.crouch=false;a.kind=name==='spin'?'kick':'punch';a.attack=duration;a.cool=duration+.28;a.specialReady=1.6+strength*.2;
 if(name==='wave')projectiles.push({owner:a.id,x:a.x+a.face*24,y:31,face:a.face,speed:480+strength*100,radius:14+strength*2,damage:18+strength*4,remaining:1.5});
 if(name==='rising'){a.vy=520+strength*55;a.vx=a.face*90;}
 if(name==='spin'){a.y=12;a.vy=240;a.vx=a.face*(230+strength*35);}
 if(a.id===0)specialNotice={label:({wave:'気功弾',rising:'昇天拳',spin:'旋風脚'})[name]+'！',time:elapsed};
 return true;
}
function specialContact(a){
 const special=a.special;if(!special||special.name==='wave')return;
 if(special.name==='rising'&&special.duration-special.remaining>.3)return;
 for(const b of fighters){
  if(b===a||b.dead||special.hitIds.has(b.id))continue;
  const dx=b.x-a.x;
  if(Math.abs(dx)>(special.name==='spin'?92:74)||Math.abs(b.y-a.y)>82||(special.name==='rising'&&dx*a.face< -16))continue;
  special.hitIds.add(b.id);hit(a,b,(special.name==='rising'?25:20)+a.strength*4,special.name==='spin'?380:240);
  if(b.hp<=0)eliminate(b);
 }
}
function updateProjectiles(dt){
 for(const p of projectiles){
  p.remaining-=dt;const from=p.x;p.x+=p.face*p.speed*dt;
  const targets=fighters.filter(b=>!b.dead&&b.hp>0&&b.id!==p.owner&&p.y>=b.y-8&&p.y<=b.y+(b.crouch?43:70)&&b.x>=Math.min(from,p.x)-p.radius-12&&b.x<=Math.max(from,p.x)+p.radius+12).sort((a,b)=>Math.abs(a.x-from)-Math.abs(b.x-from));
  if(targets.length){const b=targets[0];hit({id:p.owner,x:b.x-p.face*25,y:0,face:p.face,crouch:false,kind:'projectile'},b,p.damage,220);p.remaining=0;if(b.hp<=0)eliminate(b);}
 }
 projectiles=projectiles.filter(p=>p.remaining>0&&p.x>=0&&p.x<=WORLD);
}


function playerAttackInput(a){
 if(a.stun>0){pendingWeak=null;return null;}
 const weak=['j','u'].find(key=>pressed.has(key));
 const chord=(pressed.has('j')&&pressed.has('u'))||((held('j')&&held('u'))&&(pressed.has('j')||pressed.has('u')))||(pendingWeak&&weak&&pendingWeak.key!==weak&&elapsed-pendingWeak.time<=.09);
 if(pressed.has('h')||chord){pendingWeak=null;motion=[];return 'throw';}
 const heavy=['o','l','i','k'].find(key=>pressed.has(key));if(heavy){pendingWeak=null;return heavy;}
 if(weak){const name=matchSpecial(MOVES[weak].kind);if(name){pendingWeak=null;return weak;}pendingWeak={key:weak,time:elapsed};}
 if(pendingWeak&&elapsed-pendingWeak.time>=.09){const key=pendingWeak.key;pendingWeak=null;return key;}
 return null;
}
function throwAttack(a){
 if(status!=='playing'||a.dead||a.y>0||a.cool>0||a.stun>0||a.special)return false;
 a.guard=false;a.crouch=false;a.kind='throw';a.attack=.3;a.cool=.55;
 const target=fighters.filter(b=>b!==a&&!b.dead&&b.hp>0&&b.y===0&&b.throwSafe===0&&Math.abs(b.x-a.x)<=52&&(b.x-a.x)*a.face>=0).sort((b,c)=>Math.abs(b.x-a.x)-Math.abs(c.x-a.x))[0];
 if(!target){if(a.id===0)specialNotice={label:'投げ空振り',time:elapsed};return false;}
 a.cool=.9;target.guard=false;target.crouch=false;target.special=null;target.attack=0;target.hp-=32;target.lastHit=elapsed;if(training)trainingDamage=32;target.killer=a.id;target.stun=.65;target.throwSafe=1.1;target.cool=Math.max(target.cool,.65);target.vx=a.face*380;target.vy=330;target.y=1;target.flash=.18;
 if(target.id===0)pendingWeak=null;
 for(let i=0;i<10;i++)particles.push({x:target.x,y:30,vx:(rand()-.5)*250,vy:rand()*240,life:.4,color:'#ffd886'});
 if(a.id===0||target.id===0)shake=8;if(a.id===0)specialNotice={label:'投げ！ ガード崩し',time:elapsed};
 if(target.hp<=0)eliminate(target);return true;
}

function eliminate(f){if(f.dead)return;if(training){f.hp=MAX_HP;f.lastHit=elapsed;f.killer=null;return;}f.dead=true;f.hp=0;if(f.killer===0&&f.id!==0)kills++;if(f.id===0){rank=fighters.filter(x=>!x.dead).length+1;status='eliminated';overlay('ELIMINATED',`あなたの順位 <b>${rank}位 / 100人</b><br>${kills} KO · 生存時間 ${Math.floor(elapsed)}秒`,'もう一度挑戦','NEXT TIME, LAST ONE.');}}
function preparationMovement(dt){
 const me=fighters[0];let move=(held('d')||held('arrowright')?1:0)-(held('a')||held('arrowleft')?1:0);
 const down=held('s')||held('arrowdown'),jump=held('w')||held('arrowup');
 let nearest=null,distance=Infinity;for(const other of fighters){if(other===me||other.dead)continue;const d=Math.abs(other.x-me.x);if(d<distance){distance=d;nearest=other;}}
 if(me.y===0&&nearest)me.face=Math.sign(nearest.x-me.x)||me.face;
 me.crouch=down&&me.y===0;me.back=move===-me.face;me.guard=me.back&&me.y===0;
 if(me.crouch)move=0;
 me.vx+=(move*260*(me.back?.65:1)-me.vx)*Math.min(1,dt*9);
 if(jump&&me.y===0){me.vy=480;me.guard=false;me.crouch=false;}
 me.vy-=1180*dt;me.y=Math.max(0,me.y+me.vy*dt);if(me.y===0)me.vy=0;
 me.x=clamp(me.x+me.vx*dt,15,WORLD-15);
}
function step(dt){if(online){if(ghost){const dx=(held('d')||held('arrowright')?1:0)-(held('a')||held('arrowleft')?1:0),dy=(held('w')||held('arrowup')?1:0)-(held('s')||held('arrowdown')?1:0);ghost.x=clamp(ghost.x+dx*360*dt,15,WORLD-15);ghost.y=clamp(ghost.y+dy*300*dt,0,viewH*.65);if(dx)ghost.face=dx;ghost.vx=dx*360;hud();}pressed.clear();return;}if(status==='countdown'){preparationMovement(Math.min(dt,countdownLeft));hud();countdownLeft=Math.max(0,countdownLeft-dt);pressed.clear();motion=[];if(countdownLeft<1e-8){countdownLeft=0;status='playing';}showCountdown();return;}if(status!=='playing')return;elapsed+=dt;if(training)prepareDummy();const zone=bounds();for(const a of fighters){if(a.dead)continue;a.stun=Math.max(0,a.stun-dt);a.throwSafe=Math.max(0,a.throwSafe-dt);a.cool=Math.max(0,a.cool-dt);a.attack=Math.max(0,a.attack-dt);a.flash=Math.max(0,a.flash-dt);a.specialReady=Math.max(0,a.specialReady-dt);if(a.special){a.special.remaining-=dt;if(a.special.remaining<=0)a.special=null;}let move=0,jump=false,strong=false,fire=false,attackKey=null;if(a.id===0){move=(held('d')||held('arrowright')?1:0)-(held('a')||held('arrowleft')?1:0);const down=held('s')||held('arrowdown');jump=held('w')||held('arrowup');let nearest=null,dist=Infinity;for(const b of fighters){if(b===a||b.dead)continue;const d=Math.abs(b.x-a.x);if(d<dist){dist=d;nearest=b;}}if(a.y===0&&a.attack===0&&!a.special&&nearest)a.face=Math.sign(nearest.x-a.x)||a.face;recordMotion(a,move,down,jump);a.crouch=down&&a.y===0&&!a.special;a.back=move===-a.face;a.guard=a.back&&a.y===0&&a.cool===0&&!a.special;attackKey=playerAttackInput(a);fire=!!attackKey;if(a.crouch)move=0;}else if(training){a.guard=trainingGuard!=='none'&&a.y===0&&a.stun===0;a.crouch=trainingGuard==='crouch'&&a.y===0&&a.stun===0;}else{a.think-=dt;if(a.think<=0){let dist=Infinity;let target=0;for(const b of fighters){if(b.dead||a===b)continue;const d=Math.abs(a.x-b.x);if(d<dist){dist=d;target=b.id}}a.target=target;a.think=(.15+rand()*.25)/cpuSkill;}const b=fighters[a.target];const dx=b.x-a.x;move=Math.abs(dx)>48?Math.sign(dx):0;if(!a.special)a.face=Math.sign(dx)||a.face;a.guard=Math.abs(dx)<90&&b.attack>0&&rand()<Math.min(.95,.7*cpuSkill);fire=rand()<Math.min(1,.65*cpuSkill)&&Math.abs(dx)<(a.id%3?59:83)&&Math.abs(a.y-b.y)<45;strong=a.id%3===0||rand()<.2;jump=rand()<dt*.18;if(a.cool===0&&a.specialReady===0&&a.y===0&&rand()<dt*.12*cpuSkill&&Math.abs(dx)<520){const name=b.y>25&&Math.abs(dx)<105?'rising':Math.abs(dx)>140?'wave':'spin';beginSpecial(a,name,a.id%3);}if(a.x<zone.left+100)move=1;if(a.x>zone.right-100)move=-1;}
if(a.id!==0&&!training){a.crouch=false;const opponent=fighters[a.target];attackKey=opponent?.guard&&Math.abs(opponent.x-a.x)<50&&rand()<.25*cpuSkill?'throw':strong?'o':'j';}if(a.stun>0){move=0;jump=false;fire=false;a.guard=false;a.crouch=false;}if(a.id===0&&a.cool>0&&a.y===0)move=0;const speed=a.id===0?260:145+(a.id%8)*8;if(a.special){a.guard=false;a.crouch=false;move=0;a.vx=a.special.name==='spin'?a.face*(230+a.strength*35):a.special.name==='rising'?a.face*90:0;}else if(a.stun===0)a.vx+=(move*speed*(a.back?.65:1)-a.vx)*Math.min(1,dt*9);if(jump&&a.y===0&&a.cool===0){a.vy=480;a.guard=false;a.crouch=false;}a.vy-=1180*dt;a.y=Math.max(0,a.y+a.vy*dt);if(a.y===0)a.vy=0;a.x=clamp(a.x+a.vx*dt,15,WORLD-15);if(fire)attack(a,attackKey);if(a.special)specialContact(a);if(a.x<zone.left||a.x>zone.right){a.hp-=dt*(elapsed>160?32:14);a.killer=null;}if(!training&&elapsed>185){a.hp-=dt*7;a.killer=null;}if(a.hp<=0)eliminate(a);}
updateProjectiles(dt);if(training)for(const f of fighters){if(!f.dead&&elapsed-f.lastHit>=2)f.hp=MAX_HP;}pressed.clear();const alive=fighters.filter(f=>!f.dead);if(!training&&alive.length<=1&&status==='playing'){status='won';overlay('LAST ONE.',`勝利！ 最後の1人になりました。<br>${kills} KO · ${Math.floor(elapsed)}秒の戦い`,'もう一度戦う','WINNER / YOU');}
for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=600*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);shake=Math.max(0,shake-dt*35);hud();}
function hud(){const z=bounds(),me=fighters[0];const position=clamp((ghost||me).x/WORLD*100,0,100);$('positionPlayer').style.left=position+'%';$('positionSafe').style.left=z.left/WORLD*100+'%';$('positionSafe').style.width=(z.right-z.left)/WORLD*100+'%';$('positionText').textContent='左端から '+Math.round(position)+'%';$('positionTrack').setAttribute('aria-label','全体マップ：左端から'+Math.round(position)+'%、'+(me.x<z.left||me.x>z.right?'危険エリア':'安全エリア'));$('specialStatus').textContent=ghost?'幽霊：方向キーで自由移動／他の人には見えません':specialNotice&&elapsed-specialNotice.time<1.4?specialNotice.label:me.specialReady>0?'必殺技 再使用まで '+me.specialReady.toFixed(1)+'秒':'必殺技 READY';$('hp').style.width=(clamp(me.hp/MAX_HP,0,1)*100)+'%';$('health').textContent=Math.ceil(me.hp)+' / '+MAX_HP;$('alive').textContent=fighters.filter(f=>!f.dead).length;$('ko').textContent=training?trainingDamage:kills;$('dummyHealth').textContent=training?Math.ceil(fighters[1].hp)+' / '+MAX_HP:'—';$('time').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function drawFighter(f,ground){
 const x=f.x-camera,y=ground-f.y,walk=Math.sin(elapsed*12+f.id)*Math.min(Math.abs(f.vx)/220,1),air=f.y>2;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=f.ghost?.45:f.dead?.18:1;
 ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(0,f.y,19,3,0,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.scale(f.face,1);if(f.dead&&!f.ghost){ctx.translate(0,-7);ctx.rotate(1.3);}if(f.stun>0){ctx.translate(-5,0);ctx.rotate(-.18);}if(f.crouch)ctx.scale(1,.69);
 const suit=f.flash>0?'#fff':f.color,skin=f.flash>0?'#fff':'#e5ad86',dark='#142230',edge='#08121d';
 const limb=(ax,ay,bx,by,cx,cy,col,width)=>{line(ax,ay,bx,by,edge,width+2);line(bx,by,cx,cy,edge,width+1);line(ax,ay,bx,by,col,width);line(bx,by,cx,cy,col,width-1);};ctx.lineCap='round';ctx.lineJoin='round';
 const kicking=f.attack&&f.kind==='kick',punching=f.attack&&f.kind==='punch',throwing=f.attack&&f.kind==='throw';
 limb(-5,-32,-9-walk*5,air?-24:-17,-14-walk*7,air?-12:-3,dark,9);
 limb(5,-32,kicking?24:10+walk*5,kicking?-32:air?-27:-17,kicking?47:16+walk*7,kicking?-36:air?-17:-3,suit,10);
 line(-18-walk*7,air?-12:-2,-10-walk*7,air?-12:-2,'#dce6eb',5);line(kicking?43:12+walk*7,kicking?-36:air?-17:-2,kicking?51:21+walk*7,kicking?-36:air?-17:-2,'#dce6eb',5);
 ctx.fillStyle=suit;ctx.strokeStyle=edge;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-13,-58);ctx.lineTo(9,-59);ctx.lineTo(12,-48);ctx.lineTo(7,-32);ctx.lineTo(-7,-32);ctx.lineTo(-12,-46);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#ffffff35';ctx.beginPath();ctx.moveTo(-9,-56);ctx.lineTo(0,-54);ctx.lineTo(-2,-36);ctx.lineTo(-7,-37);ctx.closePath();ctx.fill();line(-8,-33,8,-33,dark,4);line(3,-33,8,-22,dark,3);
 limb(-10,-53,-17,-42,f.guard?-6:-12,f.guard?-59:-35,skin,7);
 const hand=f.special?.name==='rising'?[12,-85]:throwing?[33,-47]:punching?[42,-53]:f.guard?[14,-64]:[17,-46];
 limb(9,-54,punching?25:17,punching?-54:-49,...hand,skin,8);ctx.fillStyle=dark;ctx.beginPath();ctx.arc(hand[0],hand[1],4.5,0,Math.PI*2);ctx.fill();line(hand[0]-2,hand[1]-2,hand[0]+2,hand[1]-2,'#f4f4ed',2);
 line(0,-60,0,-63,skin,6);ctx.fillStyle=skin;ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(1,-68,5.5,6.5,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-5,-67);ctx.lineTo(-6,-74);ctx.lineTo(1,-77);ctx.lineTo(7,-73);ctx.lineTo(7,-70);ctx.lineTo(-2,-72);ctx.closePath();ctx.fill();line(3,-68,6,-68,edge,1);line(-5,-71,6,-71,suit,2);line(-5,-71,-13,-67,suit,2);
 if(f.guard){ctx.strokeStyle='#b9ebff99';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(5,-46,25,-1.2,1.2);ctx.stroke();}if(f.attack||f.special){ctx.strokeStyle=f.special?'#89eaff99':'#ffffff70';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(14,-43,f.kind==='kick'?41:32,17,-.2,-.9,1);ctx.stroke();}ctx.restore();ctx.restore();
 if(!f.dead){ctx.textAlign='center';ctx.font='bold 4.5px system-ui';ctx.fillStyle=f.id===0?'#d7ff8b':'#d2dce6';ctx.fillText(f.ghost?'YOU / GHOST':f.id===0?'YOU':f.label||(training?'DUMMY':String(f.id+1)),x,y-87);if(!f.ghost){ctx.fillStyle='#101e2b';ctx.fillRect(x-12,y-83,24,1.5);ctx.fillStyle=f.color;ctx.fillRect(x-12,y-83,24*clamp(f.hp/MAX_HP,0,1),1.5);}}
}
function draw(){const w=viewW,h=viewH,ground=h*.76;camera+=(clamp((ghost||fighters[0]).x-w/2,0,WORLD-w)-camera)*.09;StageExperience.draw(ctx,w,h,ground,camera,elapsed);ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);const z=bounds();for(const [edge,left] of [[z.left,true],[z.right,false]]){const x=edge-camera;ctx.fillStyle='#ff496028';ctx.fillRect(left?0:x,0,left?Math.max(0,x):Math.max(0,w-x),h);if(x>=0&&x<=w){ctx.shadowColor='#ff4b68';ctx.shadowBlur=20;line(x,0,x,h,'#ff657d',3);ctx.shadowBlur=0;ctx.fillStyle='#ff9cac';ctx.font='bold 12px system-ui';ctx.fillText('DANGER',clamp(x+(left?12:-68),10,w-75),h*.35);}}for(const f of fighters)if(!f.dead&&f.x>camera-100&&f.x<camera+w+100&&f.id!==0)drawFighter(f,ground);drawFighter(ghost||fighters[0],ground);for(const p of projectiles){const x=p.x-camera,y=ground-p.y;ctx.save();ctx.shadowColor='#55ddff';ctx.shadowBlur=20;ctx.fillStyle='#a5f7ff';ctx.beginPath();ctx.ellipse(x,y,p.radius+5,p.radius,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;line(x-p.face*42,y,x-p.face*15,y,'#55ddff88',8);ctx.restore();}for(const p of particles){ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,ground-p.y,4,4);}ctx.restore();if(!ghost&&(fighters[0].x<z.left||fighters[0].x>z.right)){ctx.fillStyle='#ff7088';ctx.textAlign='center';ctx.font='bold 18px system-ui';ctx.fillText('危険エリア！ 中央へ戻ろう',w/2,105);}}

const held=k=>keys.has(k)||padKeys.has(k);
let padIndex=null,padPrevious=new Set(),padStartPrevious=false;
function pollGamepad(){
 const label=$('padStatus');
 if(typeof navigator==='undefined'||!navigator.getGamepads){label.textContent='このブラウザーではコントローラーを利用できません。';return;}
 let pads;try{pads=Array.from(navigator.getGamepads()||[]);}catch{padKeys.clear();label.textContent='コントローラーの利用が制限されています。通常のブラウザーで開いてください。';return;}
 const active=pads.find(p=>p&&p.connected&&p.index===padIndex&&p.mapping==='standard');
 if(padIndex!==null&&!active){padIndex=null;padKeys.clear();padPrevious.clear();padStartPrevious=false;pressed.clear();if(status==='playing'||status==='countdown')pause();label.textContent='接続が切れたため一時停止しました。再接続してSTARTで再開。';return;}
 const pad=active||pads.find(p=>p&&p.connected&&p.mapping==='standard');
 if(!pad){padKeys.clear();label.textContent=pads.some(p=>p&&p.connected)?'このコントローラーの配置は未対応です。標準モード（XInputなど）に切り替えてください。':'未接続 — 接続後にコントローラーのボタンを押してください。';return;}
 padIndex=pad.index;label.textContent='接続中：'+pad.id;
 const button=n=>!!pad.buttons[n]&&(pad.buttons[n].pressed||pad.buttons[n].value>.5);
 const next=new Set();const x=pad.axes[0]||0,y=pad.axes[1]||0;
 if(button(14)||x<-.35)next.add('a');if(button(15)||x>.35)next.add('d');
 if(button(12)||y<-.35)next.add('w');if(button(13)||y>.35)next.add('s');
 for(const [index,key] of [[2,'j'],[3,'k'],[5,'l'],[0,'u'],[1,'i'],[7,'o'],[4,'h']])if(button(index))next.add(key);
 const menu=button(9),focused=!document.hidden&&(!document.hasFocus||document.hasFocus());
 padKeys.clear();
 if(focused){
  if(menu&&!padStartPrevious){if(status==='playing'||status==='countdown'||status==='paused')pause();else start();}
  else if(status==='playing'||status==='countdown'){for(const key of next){if(status==='playing'||['a','d','w','s'].includes(key))padKeys.add(key);if(status==='playing'&&!padPrevious.has(key)&&(MOVES[key]||key==='h'))pressed.add(key);}}
 }
 padPrevious=next;padStartPrevious=menu;
}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);viewW=440;viewH=440*r.height/r.width;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);const zoom=r.width/viewW;ctx.setTransform(d*zoom,0,0,d*zoom,0,0)}
window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(['a','d','w','s','j','k','l','u','i','o','h','arrowleft','arrowright','arrowup','arrowdown','escape'].includes(k)){if(e.target.tagName==='BUTTON'&&k===' ')return;e.preventDefault();if(k==='escape'&&!e.repeat)pause();else{if(!keys.has(k)&&!e.repeat)pressed.add(k);keys.add(k)}}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(status==='playing'||status==='countdown')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(status==='playing'||status==='countdown'))pause()});for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(!keys.has(b.dataset.key))pressed.add(b.dataset.key);keys.add(b.dataset.key)});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));}
$('start').onclick=start;$('pause').onclick=pause;$('reset').onclick=()=>{if(online){OnlineArena.start();return;}if(training){resetTraining();return;}init();showReady();};

function prepareDummy(){const dummy=fighters[1];dummy.face=Math.sign(fighters[0].x-dummy.x)||dummy.face;dummy.guard=trainingGuard!=='none'&&dummy.y===0&&dummy.stun===0;dummy.crouch=trainingGuard==='crouch'&&dummy.y===0&&dummy.stun===0;}
function resetTraining(){
 for(const f of fighters){f.dead=f.id>1;f.hp=MAX_HP;f.y=0;f.vx=0;f.vy=0;f.cool=0;f.attack=0;f.stun=0;f.throwSafe=0;f.special=null;f.specialReady=0;f.guard=false;f.crouch=false;f.back=false;f.killer=null;f.lastHit=-100;f.flash=0;}
 fighters[0].x=6000;fighters[0].face=1;fighters[1].x=6090;fighters[1].face=-1;particles=[];projectiles=[];motion=[];pendingWeak=null;specialNotice=null;keys.clear();padKeys.clear();pressed.clear();trainingDamage=0;kills=0;camera=clamp(6000-viewW/2,0,WORLD-viewW);prepareDummy();hud();
}
function showReady(){
 $('start').disabled=false;$('playerLabel').textContent='YOU';
 $('trainingPanel').hidden=!training;$('gameBadge').textContent=training?'TRAINING / 1 PLAYER + 1 DUMMY':'CPU BATTLE / 1 PLAYER + 99 CPU';$('aliveLabel').textContent=training?'FIGHTERS':'ALIVE';$('aliveTotal').textContent=training?' /2':' /100';$('koLabel').textContent=training?'DAMAGE':'KO';$('reset').textContent=training?'位置リセット':'リスタート';$('footerMode').textContent=training?'相手は攻撃しません。体力は自動回復します。':'CPUは互いにも戦います。';$('note').textContent=training?'時間制限・エリア縮小なし · 体力は2秒で自動回復':'開始前に5秒の準備時間 · 1試合 約3分';
 overlay(training?'TRAINING':'Last Standing 1',training?'通常攻撃・必殺技・投げを自由に練習。<br>相手のガードを切り替えて試そう。':'あなたと99体のCPUが、ひとつのリングへ。<br>迫る境界をかわし、最後の1人を目指そう。',training?'トレーニング開始 →':'バトル開始 →',training?'PRACTICE MAKES PROGRESS.':'ONE RING. ONE SURVIVOR.');$('pause').textContent='一時停止';
}
$('modeSelect').addEventListener('change',e=>{OnlineArena.leave();online=e.target.value==='online';training=e.target.value==='training';onlinePhase='lobby';init();if(online)showOnlineReady();else{showReady();$('onlinePanel').hidden=true;$('pause').hidden=false;}});
$('dummyGuard').addEventListener('change',e=>{trainingGuard=e.target.value;if(training)prepareDummy();});
$('trainingReset').addEventListener('click',()=>{if(training)resetTraining();});


function showOnlineReady(){
 $('onlinePanel').hidden=false;$('trainingPanel').hidden=true;$('pause').hidden=true;$('gameBadge').textContent='ONLINE / UP TO 100 PLAYERS';$('aliveLabel').textContent='ALIVE';$('koLabel').textContent='KO';$('aliveTotal').textContent=' /100';$('reset').textContent='次の試合';$('footerRule').textContent='体力・当たり判定・勝敗は対戦サーバーが管理します。';$('footerMode').textContent='オンライン中は一時停止できません。';$('note').textContent='2〜100人 · ルームコードで参加';
 overlay('ONLINE','「クイックマッチ」で対戦相手を自動で探そう。<br>相手は上の「ルームコード」から参加できます。','ルームを作成 →','Last Standing 1 / MULTIPLAYER');
}
OnlineArena.mount((data,self)=>{
 if(!online)return;
 const own=data.players.find(p=>p.id===self);if(!own)return;if(!own.dead||onlineSelf!==self)ghost=null;else if(!ghost)ghost={...own,x:own.x,y:own.y,id:0,ghost:true,dead:false,hp:0,attack:0,stun:0,flash:0,special:null,guard:false,crouch:false,vx:0,color:'#a5eeff'};
 const first=onlineSelf!==self||onlinePhase!==data.status&&(data.status==='countdown');onlineSelf=self;onlinePhase=data.status;
 const previous=new Map(fighters.map(f=>[f.networkId,f]));const roster=[own,...data.players.filter(p=>p.id!==self)];fighters=Array.from({length:100},(_,i)=>{const p=roster[i];return p?{...p,x:!first&&previous.has(p.id)?previous.get(p.id).x:p.x,y:!first&&previous.has(p.id)?previous.get(p.id).y:p.y,targetX:p.x,targetY:p.y,id:i,networkId:p.id,label:p.name,color:i===0?'#caff52':['#8ac8d9','#d89485','#c6b0d6','#d9c28d'][i%4]}:{id:i,x:0,y:0,vx:0,vy:0,hp:0,face:1,dead:true,color:'#999'};});
 elapsed=data.elapsed;onlineZone=data.zone;countdownLeft=data.countdown;kills=own.kills;projectiles=data.projectiles;particles=[];
 status=data.status==='countdown'?'countdown':data.status==='playing'?'playing':data.status==='finished'?'won':'ready';
 if(first){camera=clamp(own.x-viewW/2,0,WORLD-viewW);StageExperience.setStage(data.stage);}
 $('start').disabled=false;
 if(data.status==='lobby'){
  $('overlay').hidden=false;$('headline').textContent='ROOM '+data.room;$('eyebrow').textContent='WAITING FOR PLAYERS';$('message').textContent=data.players.length+'人が参加中。'+(data.fillBots?'不足人数はBOTで補充して開始します。':'2人以上で主催者が開始できます。');$('start').textContent=data.hostId===self?'対戦開始 →':'主催者の開始待ち';$('start').disabled=data.hostId!==self||data.players.filter(p=>p.connected&&!p.bot).length<(data.fillBots?1:2);if(data.quick){$('headline').textContent='QUICK MATCH';$('message').textContent=data.matchWait===null?(data.fillBots?'対戦相手を募集中。不足人数はBOTで補充します。':'対戦相手を探しています。2人以上になると自動で開始します。'):data.players.length+'人が参加中。あと'+data.matchWait+'秒で5秒の準備カウントダウンへ進みます。';$('start').textContent='マッチング中…';$('start').disabled=true;}
 }else if(data.status==='finished'){
  $('overlay').hidden=false;$('headline').textContent=data.winner===self?'LAST ONE.':data.winner?'FINISHED':'DRAW';$('eyebrow').textContent='ONLINE RESULT';const winner=data.players.find(p=>p.id===data.winner);$('message').textContent=(winner?'勝者：'+winner.name+'。':'引き分け。')+' あなたの順位 '+(own.rank||'—')+'位 / '+data.players.length+'人 · '+own.kills+' KO';$('start').textContent=data.hostId===self?'次の試合 →':'主催者の開始待ち';$('start').disabled=data.hostId!==self;if(data.quick){$('start').textContent='次のクイックマッチ →';$('start').disabled=false;}
 }else{$('overlay').hidden=true;}
 if(data.requireReady&&['lobby','finished'].includes(data.status)){$('message').textContent='準備OK '+(data.readyIds?.length||0)+' / '+data.players.filter(p=>p.connected&&!p.bot).length+'人。'+(data.fillBots?'全員の承認後にBOTを補充し、':'2人以上の参加と全員の承認後、')+'5秒の準備時間で開始します。';$('start').textContent=data.readyIds?.includes(self)?'準備OKを取り消す':'準備OK';$('start').disabled=false;}
 $('countdown').hidden=data.status!=='countdown';$('countNumber').textContent=String(data.countdown);hud();$('aliveTotal').textContent=' /'+data.players.length;$('playerLabel').textContent=own.dead?'YOU / GHOST（自分だけに表示）':'YOU / ONLINE';
});

resize();init();showOnlineReady();function frame(t){pollGamepad();if(online)OnlineArena.input(k=>!ghost&&(held(k)||pressed.has(k)||(k==='a'&&held('arrowleft'))||(k==='d'&&held('arrowright'))||(k==='w'&&held('arrowup'))||(k==='s'&&held('arrowdown'))));StageExperience.tick(status);GameSFX.tick(fighters,status,countdownLeft,(ghost||fighters[0]).x);const dt=Math.min((t-last)/1000,.08)||0;last=t;acc+=dt;while(acc>=1/60){step(1/60);acc-=1/60}if(online){for(const f of fighters){if(f.targetX!==undefined){const blend=1-Math.exp(-dt*28);f.x+=(f.targetX-f.x)*blend;f.y+=(f.targetY-f.y)*blend;}}}draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
const snapshot=()=>({status,mode:online?'online':training?'training':'battle',countdown:Math.ceil(countdownLeft),alive:fighters.filter(f=>!f.dead).length,hp:Math.ceil(fighters[0].hp),kills,elapsed:Math.floor(elapsed),zone:bounds()});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_match_state',description:'Read current battle status, remaining fighters, health and safe area.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(input&&Object.keys(input).length)throw Error('No parameters expected');return snapshot();}})).catch(()=>{});}catch{}}
window.lastRing={snapshot};
})();
