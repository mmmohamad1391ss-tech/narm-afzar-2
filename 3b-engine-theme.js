/* =====================================================================
   Audio engine (prototype: generative synth → real EQ chain → real analyser)
   Desktop build: same node graph, fed by decoded files (Web Audio in WebView2)
   ===================================================================== */
const EQ_FREQS=[60,170,310,600,1000,3000,6000,12000,14000];
const EQ_LABELS=['60','170','310','600','1k','3k','6k','12k','14k'];
const PRESETS={Flat:[0,0,0,0,0,0,0,0,0],'Bass Boost':[7,6,4,1.5,0,0,0,0,0],Vocal:[-2,-2,-1,2,4,4,2,0,-1],Rock:[5,3,-1,-3,-1,2,4,5,5],Pop:[-1,2,4,4,2,-1,-1,-1,-1],Classical:[0,0,0,0,0,-2,-3,-3,-4],Electronic:[5,4,1,-2,-2,2,1,4,5],Movie:[4,3,0,-1,2,3,2,3,3]};

const Engine=(()=>{
  const audio=new Audio();audio.crossOrigin='anonymous';audio.preload='auto';
  let ctx,src,pre,eq=[],bass,treble,ll,lh,pan,an,pg,vol,comp,fdata,bandMap=[],pendingPos=0,pt=0;
  const BANDS=72;
  const api={onended:null,onerror:null,onmeta:null,BANDS};
  audio.addEventListener('loadedmetadata',()=>{if(pendingPos>0){try{audio.currentTime=pendingPos}catch(_){}}pendingPos=0;api.onmeta&&api.onmeta(audio.duration)});
  audio.addEventListener('ended',()=>api.onended&&api.onended());
  audio.addEventListener('error',()=>api.onerror&&api.onerror(audio.error));
  function init(){
    if(ctx)return;
    ctx=new(window.AudioContext||window.webkitAudioContext)();
    src=ctx.createMediaElementSource(audio);pre=ctx.createGain();
    eq=EQ_FREQS.map((f,i)=>{const b=ctx.createBiquadFilter();b.type=i===0?'lowshelf':i===8?'highshelf':'peaking';b.frequency.value=f;b.Q.value=1.05;return b});
    bass=ctx.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=110;
    treble=ctx.createBiquadFilter();treble.type='highshelf';treble.frequency.value=7000;
    ll=ctx.createBiquadFilter();ll.type='lowshelf';ll.frequency.value=90;
    lh=ctx.createBiquadFilter();lh.type='highshelf';lh.frequency.value=9500;
    pan=ctx.createStereoPanner();an=ctx.createAnalyser();an.fftSize=2048;an.smoothingTimeConstant=.78;
    pg=ctx.createGain();vol=ctx.createGain();comp=ctx.createDynamicsCompressor();comp.threshold.value=-8;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.005;comp.release.value=.2;
    const chain=[src,pre,...eq,bass,treble,ll,lh,pan,an,pg,vol,comp,ctx.destination];
    for(let i=0;i<chain.length-1;i++)chain[i].connect(chain[i+1]);
    fdata=new Uint8Array(an.frequencyBinCount);
    const nyq=ctx.sampleRate/2,bins=an.frequencyBinCount;
    for(let i=0;i<BANDS;i++){const f0=40*Math.pow(15000/40,i/BANDS),f1=40*Math.pow(15000/40,(i+1)/BANDS);bandMap.push([Math.max(1,Math.floor(f0/nyq*bins)),Math.max(2,Math.ceil(f1/nyq*bins))])}
    applyEQ();setVol();
  }
  const now=()=>ctx.currentTime;
  const set=(p,v,t=.04)=>p.setTargetAtTime(v,now(),t);
  function applyEQ(){
    if(!ctx)return;const e=st.eq;
    eq.forEach((f,i)=>set(f.gain,e.bands[i]));
    set(bass.gain,e.bass*.12);set(treble.gain,e.treble*.1);set(pre.gain,Math.pow(10,e.preamp/20));
    set(pan.pan,e.balance);set(ll.gain,e.loudness?5:0);set(lh.gain,e.loudness?3:0);
  }
  function setVol(){if(!ctx)return;set(vol.gain,st.muted?0:Math.pow(st.vol,2.2),.03)}
  Object.assign(api,{
    init,applyEQ,setVol,
    start(track,pos){init();clearTimeout(pt);pendingPos=pos||0;audio.src=`${BASE}/track/${track.id}?t=${TOK}`;audio.load()},
    async resume(){init();clearTimeout(pt);await ctx.resume();pg.gain.cancelScheduledValues(now());pg.gain.setTargetAtTime(1,now(),.02);await audio.play()},
    pause(){if(!ctx){audio.pause();return}pg.gain.cancelScheduledValues(now());pg.gain.setTargetAtTime(0,now(),.015);clearTimeout(pt);pt=setTimeout(()=>audio.pause(),70)},
    seek(s){try{audio.currentTime=s}catch(_){}},
    stop(){clearTimeout(pt);audio.pause();audio.removeAttribute('src');audio.load()},
    pos:()=>audio.currentTime||0,
    running:()=>!!ctx&&ctx.state==='running'&&!audio.paused,
    bands(out){
      if(!ctx){out.fill(0);return false}
      an.getByteFrequencyData(fdata);
      for(let i=0;i<BANDS;i++){const[a,b]=bandMap[i];let s=0,c=0;for(let k=a;k<b&&k<fdata.length;k++){s+=fdata[k];c++}const tilt=1+i/BANDS*.9;out[i]=Math.min(1,(c?s/c/255:0)*tilt)}
      return true;
    }
  });
  return api;
})();

/* =====================================================================
   Visual Theme Engine
   artwork → dominant hues → safe palette → CSS lighting variables
   ===================================================================== */
const hexToRgb=h=>{h=h.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255]};
const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b),l=(M+m)/2;let h=0,s=0;if(M!==m){const d=M-m;s=l>.5?d/(2-M-m):d/(M+m);h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s,l]}
function hslToHex(h,s,l){h=((h%360)+360)%360;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return rgbToHex(f(0)*255,f(8)*255,f(4)*255)}
const hexToHsl=h=>rgbToHsl(...hexToRgb(h));
const lum=h=>{const c=hexToRgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
function ensureContrast(fg,bg,min=4.5){let[h,s,l]=hexToHsl(fg),c=fg,i=0;while(contrast(c,bg)<min&&l<.97&&i++<40){l+=.02;c=hslToHex(h,s,l)}return c}
const hueDist=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
const MOODS=[[18,'Ember'],[46,'Amber'],[72,'Gilded'],[165,'Verdant'],[205,'Lagoon'],[258,'Midnight'],[296,'Violet'],[336,'Rose'],[361,'Crimson']];
const moodOf=h=>{for(const[m,n]of MOODS)if(h<m)return n;return'Ember'};

function extractPalette(cv){
  const S=56,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(cv,0,0,S,S);
  const d=x.getImageData(0,0,S,S).data,B=Array.from({length:24},()=>({w:0,s:0,l:0,hx:0,hy:0}));let tot=0;
  for(let i=0;i<d.length;i+=4){
    const[h,s,l]=rgbToHsl(d[i],d[i+1],d[i+2]);if(l<.08||l>.95||s<.08)continue;
    const w=(Math.pow(s,1.3)+.04)*(1-Math.abs(l-.5)*1.15),b=B[Math.floor(h/15)%24],r=h*Math.PI/180;
    b.w+=w;b.s+=s*w;b.l+=l*w;b.hx+=Math.cos(r)*w;b.hy+=Math.sin(r)*w;tot+=w;
  }
  if(tot<8)return{primary:'#5b7cfa',secondary:'#8a5cf6',accent:'#b5a0ff',glow:'#5b7cfa',bg:'#070a17',viz:'#9db4ff',mood:'Midnight'};
  const bins=B.filter(b=>b.w>0).map(b=>({w:b.w,s:b.s/b.w,l:b.l/b.w,h:(Math.atan2(b.hy,b.hx)*180/Math.PI+360)%360})).sort((a,b)=>b.w-a.w);
  const P=bins[0],top=P.w;
  const S2=bins.find(b=>hueDist(b.h,P.h)>=28&&b.w>top*.06)||{h:P.h+28,s:P.s,l:P.l,w:0};
  const T3=bins.find(b=>hueDist(b.h,P.h)>=35&&hueDist(b.h,S2.h)>=35&&b.w>top*.05);
  // color safety: keep saturation and lightness inside a range that reads as light, not as neon
  const red=h=>h<24||h>336, yel=h=>h>44&&h<78;
  const sat=(h,s,lo,hi)=>{hi=red(h)?Math.min(hi,.64):yel(h)?Math.min(hi,.7):hi;return clamp(s,lo,hi)};
  const primary=hslToHex(P.h,sat(P.h,P.s,.38,.78),clamp(P.l,.4,.54));
  const secondary=hslToHex(S2.h,sat(S2.h,S2.s,.32,.72),clamp(S2.l,.38,.53));
  const accent=T3?hslToHex(T3.h,sat(T3.h,T3.s,.5,.85),.62):hslToHex(S2.h,sat(S2.h,S2.s+.08,.45,.8),.66);
  const glow=hslToHex(P.h,sat(P.h,P.s,.4,.72),red(P.h)?.46:.52);
  const bg=hslToHex(P.h,clamp(P.s*.6,.28,.5),.055);
  const viz=hslToHex(T3?T3.h:S2.h,.72,.64);
  return{primary,secondary,accent,glow,bg,viz,mood:moodOf(P.h)};
}

const PKEYS=['primary','secondary','accent','glow','bg','viz'];
const Theme={
  current:null,bgi:0,
  resolve(tr){
    const ex=palOf(tr.ak),th=st.theme,ps=th.perSong[tr.id];
    if(ps)return{...ex,...ps,mood:'Saved for this song',src:'song'};
    if(th.mode==='manual')return{...ex,...th.manual,mood:'Manual palette',src:'manual'};
    if(th.mode==='hybrid')return{...ex,...th.overrides,src:'hybrid'};
    return{...ex,src:'auto'};
  },
  paint(pal,dur){
    const r=document.documentElement.style;
    r.setProperty('--tt',(dur??st.theme.dur)+'ms');
    r.setProperty('--c-primary',pal.primary);r.setProperty('--c-secondary',pal.secondary);r.setProperty('--c-accent',pal.accent);
    r.setProperty('--c-glow',pal.glow);r.setProperty('--c-bg',pal.bg);r.setProperty('--c-viz',pal.viz);
    r.setProperty('--c-highlight',hslToHex(hexToHsl(pal.primary)[0],.7,.86));
    r.setProperty('--c-accent-t',ensureContrast(pal.accent,pal.bg,4.5));
  },
  apply(tr,force){
    if(st.theme.locked&&this.current&&!force)return;
    const pal=this.resolve(tr);this.current=pal;this.paint(pal);
    if(!st.theme.locked||force)this.setBg(tr);
    document.documentElement.style.setProperty('--cur-art',`url(${artXL(tr.ak)})`);
    document.dispatchEvent(new CustomEvent('themechange'));
  },
  setBg(tr){
    const els=[$('#bgA'),$('#bgB')];this.bgi^=1;const inc=els[this.bgi],out=els[this.bgi^1];
    inc.style.backgroundImage=`url(${artXL(tr.ak)})`;inc.classList.remove('on');void inc.offsetWidth;inc.classList.add('on');out.classList.remove('on');
  },
  live(){const tr=P.cur;if(!tr)return;const pal=this.resolve(tr);this.current=pal;this.paint(pal,180);document.dispatchEvent(new CustomEvent('themechange'))}
};
function applyUI(){
  const r=document.documentElement,u=st.ui;
  r.style.setProperty('--glass-o',u.reduceTrans?.94:u.glass);
  r.style.setProperty('--blur',(u.reduceTrans?8:u.blur)+'px');
  r.style.setProperty('--glow-k',u.reduceGlow?.3:1);
  r.dataset.contrast=u.contrast?'1':'0';r.dataset.anim=String(u.anim);
  document.body.dataset.viz=u.viz?'1':'0';document.body.dataset.dynbg=u.dynbg?'1':'0';
}
