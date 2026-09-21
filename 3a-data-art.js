'use strict';
/* =====================================================================
   NOVA Music — renderer
   Library, art and settings come from the Electron main process (window.nova).
   ===================================================================== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fmtT=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(n,c='')=>`<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const uid=()=>Math.random().toString(36).slice(2,9);

/* ---------- persistence (main process writes state.json in the user data folder) ---------- */
const NATIVE=!!window.nova;
const BOOT=NATIVE?window.nova.boot():{state:{},library:{folders:[],tracks:[]},port:0,token:''};
const BASE=`http://127.0.0.1:${BOOT.port}`,TOK=BOOT.token;
const store={load:()=>BOOT.state||{},save(o){if(NATIVE)window.nova.saveState(o)}};
const merge=(d,s)=>{if(Array.isArray(d)||typeof d!=='object'||d===null)return s===undefined?d:s;const o={};for(const k in d)o[k]=merge(d[k],s&&s[k]);if(s)for(const k in s)if(!(k in o))o[k]=s[k];return o};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEF={
  vol:.72,muted:false,favs:[],recent:[],playlists:[],
  eq:{preset:'Flat',bands:[0,0,0,0,0,0,0,0,0],bass:0,treble:0,balance:0,preamp:0,loudness:false},
  theme:{mode:'auto',locked:false,dur:1000,fmt:'hex',
    manual:{primary:'#3ddc84',secondary:'#1f8f6a',accent:'#f2c14e',glow:'#3ddc84',bg:'#06130e',viz:'#7ff0b0'},
    overrides:{},customs:[
      {id:'t1',name:'Midnight purple',pal:{primary:'#6a4de0',secondary:'#a04cd8',accent:'#c7a6ff',glow:'#7b5cff',bg:'#0a0718',viz:'#b79cff'}},
      {id:'t2',name:'Gold cinema',pal:{primary:'#c98a2b',secondary:'#8a4b1c',accent:'#f2c14e',glow:'#e0a64a',bg:'#120a04',viz:'#ffd98a'}}],
    perSong:{}},
  ui:{glass:.55,blur:28,anim:reduceMotion?0:2,viz:true,dynbg:true,reduceGlow:false,reduceTrans:false,contrast:false},
  play:{autoplay:true,shuffle:false,repeat:'off',scanStart:true},
  last:{id:0,pos:0},edits:{}
};
const st=merge(DEF,store.load());
let saveT;const persist=()=>{clearTimeout(saveT);saveT=setTimeout(()=>store.save(st),250)};
window.addEventListener('beforeunload',()=>{try{if(P&&P.cur)st.last={id:P.cur.id,pos:P.pos}}catch(_){}store.save(st)});

/* ---------- library (built from the scanner's output) ---------- */
let TRACKS=[],TMAP=new Map(),ALBUMS={},FOLDERS=[],RAW=new Map(),LIBRAW={folders:[],tracks:[]};
const isTK=k=>typeof k==='string'&&k.startsWith('t:');
function withEdit(t){
  const e=st.edits[t.id];if(!e)return t.ak=t.al,t;
  const o={...t};if(e.t)o.t=e.t;if(e.artist){o.artist=e.artist;o.aartist=e.artist}if(e.album)o.album=e.album;
  if(e.artist||e.album)o.al='e'+hashStr((o.aartist+'|'+o.album).toLowerCase()).toString(36);
  o.ak=e.art?'t:'+t.id:o.al;o.edited=true;return o;
}
const EQ_PLACEHOLDER=0;
function setLibrary(lib){
  LIBRAW=lib;RAW=new Map(lib.tracks.map(t=>[t.id,t]));
  TRACKS=lib.tracks.map(withEdit);TMAP=new Map(TRACKS.map(t=>[t.id,t]));ALBUMS={};
  TRACKS.forEach(t=>{const a=ALBUMS[t.al]||(ALBUMS[t.al]={name:t.album,artist:t.aartist,art:null});if(t.art&&!a.art)a.art=t.art});
  FOLDERS=lib.folders.map(f=>f.name);
  for(const k of Object.keys(ART)){const src=isTK(k)?(st.edits[+k.slice(2)]||{}).art:(ALBUMS[k]&&ALBUMS[k].art),live=isTK(k)?!!src:!!ALBUMS[k];if(!live||(ART[k].h||null)!==(src||null))delete ART[k]}
}
const T=id=>TMAP.get(id);
const artistOf=t=>t.artist, albumOf=t=>t.album;
const visibleTracks=()=>TRACKS, visibleFolders=()=>FOLDERS;

/* ---------- artwork: real cover art when present, painted default otherwise ---------- */
const rng=seed=>{let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
const lg=(x,x0,y0,x1,y1,stops)=>{const g=x.createLinearGradient(x0,y0,x1,y1);stops.forEach(([o,c])=>g.addColorStop(o,c));return g};
const rg=(x,cx,cy,r0,r1,stops)=>{const g=x.createRadialGradient(cx,cy,r0,cx,cy,r1);stops.forEach(([o,c])=>g.addColorStop(o,c));return g};

const DRAW={
ember(x,n,r){
  x.fillStyle=lg(x,0,0,0,n,[[0,'#0a0820'],[.22,'#2a1046'],[.42,'#8c1f52'],[.56,'#e2552f'],[.64,'#ffb45e']]);x.fillRect(0,0,n,n);
  const hy=n*.64;
  x.fillStyle=rg(x,n*.5,hy,0,n*.6,[[0,'rgba(255,224,160,.95)'],[.18,'rgba(255,150,80,.6)'],[.6,'rgba(220,70,70,.12)'],[1,'rgba(0,0,0,0)']]);x.fillRect(0,0,n,n);
  x.save();x.beginPath();x.rect(0,0,n,hy);x.clip();x.fillStyle=lg(x,0,hy-n*.2,0,hy,[[0,'#fff1c9'],[1,'#ffb066']]);x.beginPath();x.arc(n*.5,hy,n*.17,0,7);x.fill();x.restore();
  for(let i=0;i<8;i++){const y=n*(.16+i*.056)+r()*10,w=n*(.3+r()*.5),xx=r()*n*.6;x.fillStyle=`rgba(255,${110+i*14},150,${.05+i*.014})`;x.beginPath();x.ellipse(xx+w/2,y,w/2,2+r()*4,0,0,7);x.fill()}
  x.fillStyle=lg(x,0,hy,0,n,[[0,'#3a1240'],[1,'#07030f']]);x.fillRect(0,hy,n,n-hy);
  for(let i=0;i<110;i++){const t=i/110,y=hy+4+t*(n-hy-4),w=(1-t)*n*.17*(.5+r())+6,xx=n*.5+(r()-.5)*(n*.05+t*n*.12);x.fillStyle=`rgba(255,${170-t*90|0},${90-t*40|0},${.55*(1-t)+.05})`;x.fillRect(xx-w/2,y,w,1.4+t*2.6)}
  x.fillStyle='rgba(255,224,180,.55)';x.fillRect(0,hy-1,n,2);
},
meridian(x,n,r){
  x.fillStyle=rg(x,n*.5,n*.4,0,n*.85,[[0,'#131a52'],[.6,'#080b25'],[1,'#03040e']]);x.fillRect(0,0,n,n);
  for(let i=0;i<60;i++){x.fillStyle=`rgba(190,200,255,${.1+r()*.5})`;x.beginPath();x.arc(r()*n,r()*n*.6,.6+r()*1.4,0,7);x.fill()}
  const cy=n*.7;
  for(let i=0;i<24;i++){const rad=n*(.08+i*.026);x.lineWidth=1+i*.05;x.strokeStyle=lg(x,n*.2,0,n*.8,0,[[0,`rgba(72,124,255,${.75-i*.02})`],[1,`rgba(170,90,255,${.75-i*.02})`]]);x.beginPath();x.arc(n*.5,cy,rad,Math.PI,0);x.stroke();
    x.strokeStyle=`rgba(110,110,255,${.16-i*.005})`;x.beginPath();x.arc(n*.5,cy,rad,0,Math.PI);x.stroke()}
  x.fillStyle=rg(x,n*.5,n*.42,0,n*.4,[[0,'rgba(120,130,255,.55)'],[1,'rgba(60,40,200,0)']]);x.fillRect(0,0,n,n);
  x.fillStyle=rg(x,n*.45,n*.36,n*.01,n*.17,[[0,'#eef0ff'],[.3,'#8f9bff'],[.7,'#3a35b8'],[1,'#120c47']]);x.beginPath();x.arc(n*.5,n*.42,n*.14,0,7);x.fill();
  x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.ellipse(n*.46,n*.36,n*.035,n*.02,-.6,0,7);x.fill();
  x.fillStyle=lg(x,0,cy,0,n,[[0,'rgba(80,80,255,.22)'],[1,'rgba(0,0,0,0)']]);x.fillRect(0,cy,n,n-cy);
},
verdant(x,n,r){
  x.fillStyle=lg(x,0,0,0,n*.62,[[0,'#0a1a14'],[.4,'#1c4a33'],[.78,'#d8b246'],[1,'#f6d970']]);x.fillRect(0,0,n,n);
  x.fillStyle=rg(x,n*.62,n*.5,0,n*.34,[[0,'rgba(255,240,170,.95)'],[.25,'rgba(255,220,120,.4)'],[1,'rgba(255,220,120,0)']]);x.fillRect(0,0,n,n);
  x.fillStyle='#fff3c2';x.beginPath();x.arc(n*.62,n*.5,n*.045,0,7);x.fill();
  const cols=['#6a9a4c','#4a8446','#2f7046','#1d5842','#123f33','#0a2820'];
  cols.forEach((c,L)=>{const y0=n*(.46+L*.085),a=n*(.05-L*.004),f1=.006+r()*.004,f2=.017+r()*.01,p1=r()*9,p2=r()*9;
    x.beginPath();x.moveTo(0,n);for(let i=0;i<=n;i+=4)x.lineTo(i,y0+a*Math.sin(i*f1+p1)+a*.45*Math.sin(i*f2+p2)-(L<3?a*.4*Math.exp(-Math.pow((i-n*(.2+L*.25))/(n*.15),2)):0));x.lineTo(n,n);x.closePath();x.fillStyle=c;x.fill();
    x.fillStyle=lg(x,0,y0-a*1.5,0,y0+n*.12,[[0,`rgba(246,217,112,${.32-L*.04})`],[1,'rgba(246,217,112,0)']]);x.fill()});
},
salt(x,n,r){
  const hy=n*.5;
  x.fillStyle=lg(x,0,0,0,hy,[[0,'#05202a'],[.6,'#12707d'],[1,'#a8efe4']]);x.fillRect(0,0,n,hy);
  x.fillStyle=lg(x,0,hy,0,n,[[0,'#a8efe4'],[.25,'#2a9aa1'],[1,'#04222b']]);x.fillRect(0,hy,n,n-hy);
  x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=2;x.beginPath();x.arc(n*.72,n*.2,n*.05,0,7);x.stroke();
  x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.arc(n*.72,n*.2,n*.05,0,7);x.fill();
  for(let i=-14;i<=14;i++){x.strokeStyle=`rgba(255,255,255,${.1-Math.abs(i)*.004})`;x.lineWidth=1.2;x.beginPath();x.moveTo(n*.5,hy);x.lineTo(n*.5+i*n*.18,n);x.stroke()}
  for(let i=1;i<16;i++){const t=Math.pow(i/16,2.2);x.strokeStyle=`rgba(255,255,255,${.05+t*.08})`;x.beginPath();x.moveTo(0,hy+t*(n-hy));x.lineTo(n,hy+t*(n-hy));x.stroke()}
  x.fillStyle='#03161d';x.fillRect(n*.5-3,hy-40,6,40);x.beginPath();x.arc(n*.5,hy-46,5,0,7);x.fill();
  x.fillStyle='rgba(3,22,29,.45)';x.fillRect(n*.5-3,hy,6,40);x.beginPath();x.arc(n*.5,hy+46,5,0,7);x.fill();
  x.fillStyle='rgba(255,255,255,.55)';x.fillRect(0,hy-1,n,2);
},
crimson(x,n,r){
  x.fillStyle=rg(x,n*.5,n*.46,0,n*.8,[[0,'#3a0a14'],[.6,'#16040a'],[1,'#070203']]);x.fillRect(0,0,n,n);
  for(let i=0;i<180;i++){x.fillStyle=`rgba(255,${90+r()*60|0},${80+r()*40|0},${r()*.5})`;x.beginPath();x.arc(r()*n,r()*n,.5+r()*1.6,0,7);x.fill()}
  const cx=n*.5,cy=n*.46,R=n*.2;
  x.fillStyle=rg(x,cx,cy,R*.9,R*2.3,[[0,'rgba(255,70,60,.95)'],[.12,'rgba(230,40,60,.55)'],[.4,'rgba(160,20,50,.18)'],[1,'rgba(90,10,30,0)']]);x.fillRect(0,0,n,n);
  for(let i=1;i<7;i++){x.strokeStyle=`rgba(255,110,100,${.22-i*.03})`;x.lineWidth=1.2;x.beginPath();x.arc(cx,cy,R*(1.15+i*.22),0,7);x.stroke()}
  x.fillStyle='#050102';x.beginPath();x.arc(cx,cy,R,0,7);x.fill();
  x.strokeStyle='rgba(255,140,120,.8)';x.lineWidth=2.5;x.beginPath();x.arc(cx,cy,R+1,-2.4,-.5);x.stroke();
  x.fillStyle=lg(x,0,n*.8,0,n,[[0,'rgba(120,10,30,0)'],[1,'rgba(120,10,30,.5)']]);x.fillRect(0,n*.8,n,n*.2);
},
caravan(x,n,r){
  x.fillStyle=lg(x,0,0,0,n*.8,[[0,'#040616'],[.5,'#141a58'],[1,'#3b2f88']]);x.fillRect(0,0,n,n);
  for(let i=0;i<220;i++){const s=r(),y=r()*n*.6;x.fillStyle=`rgba(220,225,255,${.2+r()*.7})`;x.beginPath();x.arc(r()*n,y,.4+s*s*1.6,0,7);x.fill()}
  x.fillStyle=rg(x,n*.72,n*.2,0,n*.22,[[0,'rgba(255,240,200,.4)'],[1,'rgba(255,240,200,0)']]);x.fillRect(0,0,n,n);
  x.save();x.fillStyle='#f6eccd';x.beginPath();x.arc(n*.72,n*.2,n*.055,0,7);x.fill();x.globalCompositeOperation='destination-out';x.beginPath();x.arc(n*.72+n*.03,n*.2-n*.012,n*.05,0,7);x.fill();x.restore();
  const dunes=[['#2a2478',.52,.06],['#1b1859',.62,.07],['#0e0d34',.74,.06]];
  dunes.forEach(([c,y0,a],L)=>{const p=r()*9;x.beginPath();x.moveTo(0,n);for(let i=0;i<=n;i+=4)x.lineTo(i,n*y0+n*a*Math.sin(i*.006+p+L)+n*a*.4*Math.sin(i*.017+p*2));x.lineTo(n,n);x.closePath();x.fillStyle=c;x.fill()});
  const ry=i=>n*.62+n*.07*Math.sin(i*.006+r()*0+1)+n*.07*.4*Math.sin(i*.017+0);
  x.fillStyle='#07061c';
  for(let k=0;k<7;k++){const px=n*(.18+k*.095),py=n*.735+n*.06*Math.sin(px*.006+2)+n*.06*.4*Math.sin(px*.017+4)-2;
    x.fillRect(px-2.5,py-34,5,34);x.beginPath();x.arc(px,py-38,5,0,7);x.fill();
    if(k%2===0){x.strokeStyle='#07061c';x.lineWidth=1.4;x.beginPath();x.moveTo(px+3,py-30);x.lineTo(px+14,py-24);x.stroke();
      x.fillStyle=rg(x,px+14,py-22,0,18,[[0,'rgba(255,190,90,1)'],[.25,'rgba(255,150,60,.5)'],[1,'rgba(255,150,60,0)']]);x.fillRect(px-10,py-50,50,50);x.fillStyle='#07061c'}}
},
chapel(x,n,r){
  x.fillStyle='#080503';x.fillRect(0,0,n,n);
  x.fillStyle=rg(x,n*.5,n*.6,0,n*.62,[[0,'rgba(255,196,96,.7)'],[.4,'rgba(200,120,40,.22)'],[1,'rgba(120,60,10,0)']]);x.fillRect(0,0,n,n);
  for(let i=0;i<10;i++){const s=1-i*.088,w=n*.66*s,h=n*.84*s,cx=n*.5,by=n*.88-i*n*.026;
    x.beginPath();x.moveTo(cx-w/2,by);x.lineTo(cx-w/2,by-h+w/2);x.arc(cx,by-h+w/2,w/2,Math.PI,0);x.lineTo(cx+w/2,by);
    x.fillStyle=`rgba(255,190,90,${.03+i*.02})`;x.fill();
    x.strokeStyle=lg(x,0,by-h,0,by,[[0,`rgba(255,214,130,${.95-i*.07})`],[1,`rgba(160,96,28,${.9-i*.07})`]]);x.lineWidth=3.4-i*.25;x.stroke()}
  x.fillStyle=lg(x,0,n*.88,0,n,[[0,'rgba(255,190,90,.35)'],[1,'rgba(8,5,3,.95)']]);x.fillRect(0,n*.88,n,n*.12);
  for(let i=0;i<14;i++){x.fillStyle=`rgba(255,200,110,${.25-i*.016})`;x.fillRect(n*.5-n*.2*(1-i*.05),n*.9+i*n*.007,n*.4*(1-i*.05),1.5)}
},
tide(x,n,r){
  x.fillStyle=lg(x,0,0,0,n,[[0,'#04161a'],[1,'#03100f']]);x.fillRect(0,0,n,n);
  x.fillStyle=rg(x,n*.3,n*.24,0,n*.2,[[0,'rgba(230,255,245,.95)'],[.3,'rgba(160,240,220,.35)'],[1,'rgba(160,240,220,0)']]);x.fillRect(0,0,n,n);
  x.fillStyle='#effff8';x.beginPath();x.arc(n*.3,n*.24,n*.05,0,7);x.fill();
  for(let i=0;i<28;i++){const t=i/28,y0=n*(.36+t*.62),a=n*(.012+t*.03),f=.008+t*.004,p=i*.7;
    x.beginPath();x.moveTo(0,n);for(let k=0;k<=n;k+=4)x.lineTo(k,y0+a*Math.sin(k*f+p)+a*.5*Math.sin(k*f*2.3+p*1.7));x.lineTo(n,n);x.closePath();
    x.fillStyle=lg(x,0,y0-a,0,y0+n*.12,[[0,`rgba(${20+t*20|0},${150+t*60|0},${130+t*30|0},${.5})`],[1,`rgba(4,30,28,.92)`]]);x.fill();
    x.strokeStyle=`rgba(190,255,235,${.1+t*.3})`;x.lineWidth=1;x.stroke()}
}
};

const DRAWERS=Object.keys(DRAW);
const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const DEFAULT_PAL={primary:'#5b7cfa',secondary:'#8a5cf6',accent:'#b5a0ff',glow:'#5b7cfa',bg:'#070a17',viz:'#9db4ff',mood:'Midnight'};
const ART={};
function ellipsize(x,text,maxW){if(x.measureText(text).width<=maxW)return text;while(text.length>1&&x.measureText(text+'…').width>maxW)text=text.slice(0,-1);return text+'…'}
function paintProc(k,e,n,xl){
  const seed=hashStr(k),style=DRAWERS[seed%DRAWERS.length],a=ALBUMS[k]||{name:'',artist:''};
  const cv=document.createElement('canvas');cv.width=cv.height=n;const x=cv.getContext('2d',{willReadFrequently:true}),r=rng(seed);
  DRAW[style](x,n,r);
  x.fillStyle=rg(x,n/2,n/2,n*.34,n*.8,[[0,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.5)']]);x.fillRect(0,0,n,n);
  const id=x.getImageData(0,0,n,n),d=id.data;for(let i=0;i<d.length;i+=4){const v=(r()-.5)*24;d[i]+=v;d[i+1]+=v;d[i+2]+=v}x.putImageData(id,0,0);
  const fs=Math.max(9,Math.round(21*n/720));x.save();x.textBaseline='alphabetic';try{x.letterSpacing=Math.round(4*n/720)+'px'}catch(_){}
  x.fillStyle='rgba(255,255,255,.86)';x.font=`500 ${fs}px Georgia,serif`;x.fillText(ellipsize(x,(a.name||'').toUpperCase(),n*.88),n*.06,n*.945);
  x.font=`400 ${Math.round(fs*.72)}px Georgia,serif`;x.fillStyle='rgba(255,255,255,.6)';x.fillText(ellipsize(x,(a.artist||'').toUpperCase(),n*.88),n*.06,n*.075);x.restore();
  const url=cv.toDataURL('image/jpeg',.9);
  if(xl)e.xl=url;else{e.url=url;e.pal=extractPalette(cv)}
}
function artEntry(k){
  let e=ART[k];if(e)return e;
  const a=isTK(k)?{art:(st.edits[+k.slice(2)]||{}).art}:ALBUMS[k];
  if(a&&a.art){e=ART[k]={h:a.art,proc:false,ready:false,pal:DEFAULT_PAL,url:`${BASE}/art/${a.art}?t=${TOK}`};queuePal(k)}
  else{e=ART[k]={h:null,proc:true,ready:true};paintProc(k,e,320,false)}
  return e;
}
const art=k=>artEntry(k).url;
const artXL=k=>{const e=artEntry(k);if(e.proc&&!e.xl)paintProc(k,e,720,true);return e.xl||e.url};
const palOf=k=>artEntry(k).pal||DEFAULT_PAL;
const glowOf=k=>palOf(k).glow;
const palQ=[];let palBusy=0;
function queuePal(k,front){const e=ART[k];if(!e||e.queued||e.ready)return;e.queued=true;front?palQ.unshift(k):palQ.push(k);pumpPal()}
function pumpPal(){
  while(palBusy<3&&palQ.length){
    const k=palQ.shift(),e=ART[k];if(!e)continue;palBusy++;
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{try{e.pal=extractPalette(img)}catch(_){e.pal=DEFAULT_PAL}palDone(k,e)};
    img.onerror=()=>{e.pal=DEFAULT_PAL;palDone(k,e)};img.src=e.url;
  }
}
function palDone(k,e){palBusy--;e.ready=true;(e.waiters||[]).forEach(f=>f());e.waiters=[];document.dispatchEvent(new CustomEvent('palready',{detail:k}));pumpPal()}
function ensurePal(k){const e=artEntry(k);if(e.ready)return Promise.resolve();return new Promise(r=>{(e.waiters||(e.waiters=[])).push(r);if(e.queued){const i=palQ.indexOf(k);if(i>0){palQ.splice(i,1);palQ.unshift(k)}}else queuePal(k,true)})}
