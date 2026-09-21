/* =====================================================================
   Visualizer
   ===================================================================== */
const Viz={bars:new Float32Array(Engine.BANDS),raw:new Float32Array(Engine.BANDS),c:{viz:[143,176,255],sec:[138,92,246],glow:[79,124,255]},n:0};
function readCol(name,fb){
  const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if(v.startsWith('#'))return hexToRgb(v);
  const m=v.match(/-?[\d.]+/g);if(!m||m.length<3)return fb;
  return v.startsWith('color(')?m.slice(0,3).map(x=>x*255):m.slice(0,3).map(Number);
}
function readCols(){Viz.c.viz=readCol('--c-viz',Viz.c.viz);Viz.c.sec=readCol('--c-secondary',Viz.c.sec);Viz.c.glow=readCol('--c-glow',Viz.c.glow)}
function fit(cv){
  const dpr=Math.min(devicePixelRatio||1,2),w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return null;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return{c,w,h};
}
const band=(i)=>{const B=Engine.BANDS-1,x=clamp(i,0,B),a=Math.floor(x),b=Math.min(B,a+1);return Viz.bars[a]+(Viz.bars[b]-Viz.bars[a])*(x-a)};
const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
function drawRing(ts){
  const f=fit($('#ring'));if(!f)return;const{c,w,h}=f;c.clearRect(0,0,w,h);
  const cx=w/2,cy=h/2,art=w/1.7,r0=art/2+art*.07,maxL=art*.24,n=144,B=Engine.BANDS,vz=Viz.c.viz,sc=Viz.c.sec;
  let avg=0;for(let i=0;i<B;i++)avg+=Viz.bars[i];avg/=B;
  c.globalCompositeOperation='lighter';
  const g=c.createRadialGradient(cx,cy,art*.4,cx,cy,w/2);g.addColorStop(0,rgba(Viz.c.glow,.0));g.addColorStop(.4,rgba(Viz.c.glow,.1+avg*.5));g.addColorStop(1,rgba(Viz.c.glow,0));c.fillStyle=g;c.fillRect(0,0,w,h);
  c.lineCap='round';
  for(let i=0;i<n;i++){
    const u=i/n,t=Math.abs(u*2-1),v=band((1-t)*.86*(B-1)),len=5+maxL*Math.pow(v,.85),a=Math.PI/2+u*Math.PI*2+ts*.00004,co=Math.cos(a),si=Math.sin(a),mix=1-t;
    const col=[vz[0]+(sc[0]-vz[0])*mix*.6,vz[1]+(sc[1]-vz[1])*mix*.6,vz[2]+(sc[2]-vz[2])*mix*.6];
    c.beginPath();c.moveTo(cx+co*r0,cy+si*r0);c.lineTo(cx+co*(r0+len),cy+si*(r0+len));
    c.strokeStyle=rgba(col,.11);c.lineWidth=7;c.stroke();c.strokeStyle=rgba(col,.9);c.lineWidth=2.6;c.stroke();
  }
  c.globalCompositeOperation='source-over';c.strokeStyle=rgba(vz,.22);c.lineWidth=1;c.beginPath();c.arc(cx,cy,r0-9,0,7);c.stroke();
}
function drawSpec(){
  const f=fit($('#spec'));if(!f)return;const{c,w,h}=f;c.clearRect(0,0,w,h);const n=Math.floor(w/14),B=Engine.BANDS,bw=w/n;
  const g=c.createLinearGradient(0,h,0,0);g.addColorStop(0,rgba(Viz.c.viz,.55));g.addColorStop(1,rgba(Viz.c.sec,0));c.fillStyle=g;
  for(let i=0;i<n;i++){const t=Math.abs(i/(n-1)*2-1),v=band(t*.9*(B-1)),bh=Math.max(3,Math.pow(v,.9)*h*.95);c.beginPath();c.roundRect(i*bw+2,h-bh,bw-4,bh,3);c.fill()}
}
function drawStudioAn(){
  const cv=$('.eq-an');if(!cv)return;const f=fit(cv);if(!f)return;const{c,w,h}=f;c.clearRect(0,0,w,h);const B=Engine.BANDS;
  const g=c.createLinearGradient(0,h,0,0);g.addColorStop(0,rgba(Viz.c.viz,.7));g.addColorStop(1,rgba(Viz.c.viz,.05));c.fillStyle=g;
  c.beginPath();c.moveTo(0,h);for(let i=0;i<=60;i++){const v=band(i/60*(B-1));c.lineTo(i/60*w,h-Math.pow(v,.9)*h*.9)}c.lineTo(w,h);c.closePath();c.fill();
}
function frame(ts){
  requestAnimationFrame(frame);
  if(P.playing&&P.loaded&&!P.scrub)P.pos=Engine.pos();
  updProg();
  const live=P.playing&&Engine.running()&&Engine.bands(Viz.raw);if(!live)Viz.raw.fill(0);
  const idle=.03+.018*Math.sin(ts/900),B=Engine.BANDS;
  for(let i=0;i<B;i++){const tg=live?Viz.raw[i]:idle*(1-i/B*.6),b=Viz.bars[i];Viz.bars[i]=b+(tg-b)*(tg>b?.55:.1)}
  if(++Viz.n%8===0)readCols();
  const open=$('#np').classList.contains('open');
  if(open&&st.ui.viz){drawRing(ts);drawSpec()}
  if(V.route==='studio'&&!open)drawStudioAn();
}

/* =====================================================================
   Events
   ===================================================================== */
function trackMenu(e,id){
  const t=T(id),items=[
    {l:'Play next',i:'play',fn:()=>{P.queue=P.queue.filter(x=>x!==id);P.qi=P.queue.indexOf(P.cur.id);P.queue.splice(P.qi+1,0,id);renderQueue();toast('Playing next: '+t.t)}},
    {l:'Add to queue',i:'queue',fn:()=>{P.queue=P.queue.filter(x=>x!==id);P.qi=P.queue.indexOf(P.cur.id);P.queue.push(id);renderQueue();toast('Added to queue')}},
    {l:isFav(id)?'Remove from favorites':'Add to favorites',i:'heart',fn:()=>toggleFav(id)},
    {l:'Edit details and cover',i:'edit',fn:()=>editTrack(id)},{sep:1},{cap:'Add to playlist'},
    ...st.playlists.map(p=>({l:p.name,i:'playlists',fn:()=>{if(!p.tracks.includes(id))p.tracks.push(id);persist();toast(`Added to ${p.name}`)}})),
    {l:'New playlist',i:'plus',fn:async()=>{const n=await askModal({title:'New playlist',value:'My playlist',ok:'Create'});if(n){st.playlists.push({id:'p'+uid(),name:n,tracks:[id]});persist();toast(`Created ${n}`);if(V.route==='playlists')render()}}},{sep:1},
    {l:'Go to album',i:'albums',fn:()=>go('list',{k:'album',v:t.al})},{l:'Go to folder',i:'folder',fn:()=>go('list',{k:'folder',v:t.f})}];
  if(V.route==='list'&&V.arg.k==='playlist')items.push({sep:1},{l:'Remove from this playlist',i:'trash',fn:()=>{const p=st.playlists.find(x=>x.id===V.arg.v);p.tracks=p.tracks.filter(x=>x!==id);persist();render()}});
  const r=e.target.closest('button')?.getBoundingClientRect();showMenu(r?r.left-150:e.clientX,r?r.bottom+6:e.clientY,items);
}
function folderMenu(e,f){
  const r=e.target.closest('button').getBoundingClientRect();
  showMenu(r.left-120,r.bottom+6,[{l:'Open folder',i:'folder',fn:()=>go('list',{k:'folder',v:f})},{l:'Rescan library',i:'repeat',fn:()=>{toast('Scanning your folders…');rescan()}},{sep:1},{l:'Remove from library',i:'trash',fn:()=>removeFolder(f)}]);
}
const sig=lib=>lib.tracks.map(t=>t.id+':'+t.dur+':'+(t.art||'')).join(',');
function applyLibrary(lib){
  setLibrary(lib);document.body.dataset.empty=TRACKS.length?'0':'1';
  P.queue=P.queue.filter(id=>T(id));if(P.orig)P.orig=P.orig.filter(id=>T(id));
  if(P.cur){const n=T(P.cur.id);if(n)P.cur=n;else{Engine.stop();P.playing=false;P.loaded=false;P.cur=null}}
  if(!TRACKS.length){P.queue=[];P.cur=null;P.playing=false;syncPlay()}
  else if(!P.cur){P.queue=TRACKS.map(t=>t.id);load(P.queue[0])}
  else{if(!P.queue.length)P.queue=TRACKS.map(t=>t.id);P.qi=P.queue.indexOf(P.cur.id);renderQueue()}
  if(V.route==='list'&&V.arg.k==='folder'&&!FOLDERS.includes(V.arg.v))V.route='folders',V.arg=null;
  else if(V.route==='list'&&V.arg.k==='album'&&!ALBUMS[V.arg.v])V.route='albums',V.arg=null;
  else if(V.route==='list'&&V.arg.k==='artist'&&!TRACKS.some(t=>t.aartist===V.arg.v))V.route='artists',V.arg=null;
  render();
}
async function libCall(p,{ok}={}){
  const r=await p;
  if(!r||r.canceled)return;
  if(r.error){toast(r.error);return}
  applyLibrary(r.library);if(ok)toast(ok(r));
}
const addFolder=()=>NATIVE?libCall(window.nova.addFolder(),{ok:r=>`Added ${r.name}: ${plural(r.added,'song')}`}):toast('Folder access needs the desktop app.');
const rescan=()=>NATIVE&&libCall(window.nova.rescan(),{ok:()=>'Library is up to date'});
function removeFolder(f){NATIVE&&libCall(window.nova.removeFolder(f),{ok:()=>`Removed ${f} from the library. Files on your drive are untouched.`})}
async function silentRescan(){
  if(!NATIVE)return;const before=sig({tracks:TRACKS}),r=await window.nova.rescan();
  if(r&&r.library&&sig(r.library)!==before)applyLibrary(r.library);
}
const coverUrl=h=>`${BASE}/art/${h}?t=${TOK}`;
function editTrack(id){
  const t=T(id),raw=RAW.get(id);if(!t||!raw)return;
  const cur=st.edits[id]||{};let art_=cur.art||null,changedArt=false;
  const albumTracks=[...RAW.values()].filter(x=>x.al===raw.al&&x.id!==id).length;
  const w=document.createElement('div');w.className='modal';
  w.innerHTML=`<div class="box glass ed-box" role="dialog" aria-modal="true" aria-label="Edit song"><h3>Edit song</h3>
  <div class="ed"><div><div class="ed-cv" id="ed-drop"><img id="ed-img" alt="" src="${art(t.ak)}"><span>Drop an image</span></div>
    <button class="btn gh sm" id="ed-pick" style="width:100%;margin-top:10px">Choose image</button><button class="btn gh sm" id="ed-clear" style="width:100%;margin-top:6px">Use original cover</button></div>
  <div><label for="ed-t">Title</label><input class="ci" id="ed-t" maxlength="120" value="${esc(t.t)}"><label for="ed-a">Artist</label><input class="ci" id="ed-a" maxlength="120" value="${esc(t.artist)}"><label for="ed-b">Album</label><input class="ci" id="ed-b" maxlength="120" value="${esc(t.album)}">
  ${albumTracks?`<label class="ed-chk"><input type="checkbox" id="ed-all"> Apply the cover to the other ${albumTracks} ${albumTracks===1?'song':'songs'} on this album</label>`:''}
  <p class="hint" style="margin-top:10px">Changes are saved in NOVA only. Your music files are never modified.</p></div></div>
  <div class="acts" style="justify-content:space-between"><button class="btn gh sm danger" id="ed-reset">Reset all</button><div style="display:flex;gap:10px"><button class="btn gh sm" id="ed-cancel">Cancel</button><button class="btn pri sm" id="ed-save">Save</button></div></div></div>`;
  $('#win').appendChild(w);$('#ed-t',w).focus();$('#ed-t',w).select();
  const img=$('#ed-img',w),close=()=>w.remove();
  const setArt=h=>{art_=h;changedArt=true;img.src=h?coverUrl(h):art(t.al)};
  const useFile=async p=>{const r=await window.nova.importImage(p);if(r.error)toast(r.error);else if(r.art)setArt(r.art)};
  $('#ed-pick',w).onclick=async()=>{const r=await window.nova.pickImage();if(r.canceled)return;if(r.error)toast(r.error);else setArt(r.art)};
  $('#ed-clear',w).onclick=()=>{art_=null;changedArt=true;img.src=art(t.al)};
  const dz=$('#ed-drop',w);dz.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();dz.classList.add('over')});dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
  dz.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dz.classList.remove('over');const f=e.dataTransfer.files[0];if(f&&NATIVE)useFile(window.nova.pathForFile(f))});
  const done=()=>{const sy=$('#main').scrollTop;persist();applyLibrary(LIBRAW);$('#main').scrollTop=sy;if(P.cur){syncTrack();Theme.apply(P.cur);ensurePal(P.cur.ak).then(()=>{if(!st.theme.locked)Theme.live()})}close();toast('Saved')};
  $('#ed-reset',w).onclick=()=>{delete st.edits[id];done()};
  $('#ed-cancel',w).onclick=close;
  $('#ed-save',w).onclick=()=>{
    const v=x=>$(x,w).value.trim(),e={};
    if(v('#ed-t')&&v('#ed-t')!==raw.t)e.t=v('#ed-t');if(v('#ed-a')&&v('#ed-a')!==raw.artist)e.artist=v('#ed-a');if(v('#ed-b')&&v('#ed-b')!==raw.album)e.album=v('#ed-b');
    if(art_)e.art=art_;
    Object.keys(e).length?st.edits[id]=e:delete st.edits[id];
    if(changedArt&&$('#ed-all',w)&&$('#ed-all',w).checked){[...RAW.values()].filter(x=>x.al===raw.al).forEach(x=>{const o=st.edits[x.id]||{};if(art_)o.art=art_;else delete o.art;Object.keys(o).length?st.edits[x.id]=o:delete st.edits[x.id]})}
    done();
  };
  w.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type==='text')$('#ed-save',w).click()});
  w.addEventListener('click',e=>{if(e.target===w)close()});
}
async function act(a,el,e){
  switch(a){
    case'toggle':toggle();break;case'next':next(false);break;case'prev':prev();break;
    case'shuffle':setShuffle(!st.play.shuffle);if(V.route==='settings')render();break;
    case'repeat':st.play.repeat={off:'all',all:'one',one:'off'}[st.play.repeat];syncModes();persist();if(V.route==='settings')render();break;
    case'mute':toggleMute();break;
    case'np-open':$('#np').classList.add('open');break;case'np-close':$('#np').classList.remove('open');break;
    case'fav-cur':toggleFav(P.cur.id);break;
    case'more-cur':trackMenu(e,P.cur.id);break;
    case'play-list':if(V.list.length)playFrom(st.play.shuffle&&P.cur&&V.list.includes(P.cur.id)?V.list[0]:V.list[0],V.list);break;
    case'shuffle-list':if(V.list.length){const id=V.list[Math.floor(Math.random()*V.list.length)];st.play.shuffle=true;playFrom(id,V.list);syncModes()}break;
    case'add-folder':addFolder();break;
    case'rescan':toast('Scanning your folders…');rescan();break;
    case'remove-folder':removeFolder(el.dataset.f);break;
    case'new-playlist':{const n=await askModal({title:'New playlist',value:'My playlist',ok:'Create'});if(n){const p={id:'p'+uid(),name:n,tracks:[]};st.playlists.push(p);persist();go('list',{k:'playlist',v:p.id})}break}
    case'rename-pl':{const p=st.playlists.find(x=>x.id===el.dataset.id),n=await askModal({title:'Rename playlist',value:p.name});if(n){p.name=n;persist();render()}break}
    case'del-pl':{const p=st.playlists.find(x=>x.id===el.dataset.id);if(await askModal({title:'Delete playlist?',text:`“${p.name}” will be removed. Your songs stay in the library.`,ok:'Delete',danger:1})){st.playlists=st.playlists.filter(x=>x!==p);persist();go('playlists')}break}
    case'reset-color':{const k=el.dataset.k;delete st.theme.overrides[k];persist();Theme.live();renderPal();break}
    case'save-theme':{const n=await askModal({title:'Name this theme',value:`My theme ${st.theme.customs.length+1}`});if(n){const pal={};PKEYS.forEach(k=>pal[k]=Theme.current[k]);st.theme.customs.push({id:'t'+uid(),name:n,pal});persist();renderCustoms();toast(`Saved ${n}`)}break}
    case'apply-theme':{const c=st.theme.customs.find(x=>x.id===el.dataset.id);st.theme.mode='manual';st.theme.manual={...c.pal};delete st.theme.perSong[P.cur.id];persist();Theme.live();render();toast(`Applied ${c.name}`);break}
    case'rename-theme':{const c=st.theme.customs.find(x=>x.id===el.dataset.id),n=await askModal({title:'Rename theme',value:c.name});if(n){c.name=n;persist();renderCustoms()}break}
    case'del-theme':st.theme.customs=st.theme.customs.filter(x=>x.id!==el.dataset.id);persist();renderCustoms();break;
    case'song-theme':{const pal={};PKEYS.forEach(k=>pal[k]=Theme.current[k]);st.theme.perSong[P.cur.id]=pal;persist();renderPal();toast(`Saved a theme for ${P.cur.t}`);break}
    case'song-theme-clear':delete st.theme.perSong[P.cur.id];persist();Theme.live();renderPal();break;
  }
}
document.addEventListener('click',e=>{
  const t=e.target;if(menuEl&&!t.closest('.menu'))closeMenu();
  let el;
  if(el=t.closest('[data-win]'))return NATIVE&&window.nova.win(el.dataset.win);
  if(el=t.closest('[data-fav]'))return toggleFav(+el.dataset.fav);
  if(el=t.closest('[data-more]'))return trackMenu(e,+el.dataset.more);
  if(el=t.closest('[data-fmenu]'))return folderMenu(e,el.dataset.fmenu);
  if(el=t.closest('[data-act]'))return act(el.dataset.act,el,e);
  if(el=t.closest('[data-nav]'))return go(el.dataset.nav);
  if(el=t.closest('[data-go]')){const[k,...r]=el.dataset.go.split(':');return go('list',{k,v:r.join(':')})}
  if(el=t.closest('[data-tg]')){const p=el.dataset.tg,v=!getPath(p);setPath(p,v);el.setAttribute('aria-checked',String(v));afterSet(p);return}
  if(el=t.closest('[data-seg]')){const p=el.dataset.seg;let v=el.dataset.v;if(p==='ui.anim')v=+v;setPath(p,v);afterSet(p);return}
  if(el=t.closest('[data-folder]')){V.folder=el.dataset.folder;return render()}
  if(el=t.closest('[data-preset]')){const n=el.dataset.preset;if(n==='Custom')return;st.eq.bands=[...PRESETS[n]];st.eq.preset=n;return eqChanged()}
  if(el=t.closest('.qi')){if(t.closest('.g'))return;return load(+el.dataset.id,{play:true})}
  if(el=t.closest('[data-play]')){const id=+el.dataset.play;return playFrom(id,V.list.includes(id)?V.list:[id])}
});
function afterSet(p){
  persist();
  if(p.startsWith('ui.'))applyUI();
  if(p==='theme.mode'){Theme.live();render()}
  if(p==='theme.locked'){if(!st.theme.locked)Theme.apply(P.cur,true)}
  if(p==='theme.fmt')render();
  if(p==='play.shuffle'){setShuffle(st.play.shuffle)}
  if(p==='play.repeat'){syncModes()}
  if(p==='eq.loudness')Engine.applyEQ();
  if(p==='ui.anim'||p==='play.repeat')render();
}
document.addEventListener('contextmenu',e=>{const r=e.target.closest('.row');if(r){e.preventDefault();trackMenu(e,+r.dataset.play)}});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.matches('[data-color]')){const hex=t.value;t.parentElement.style.setProperty('--c',hex);const ci=$(`[data-cin="${t.dataset.color}"]`);if(ci)ci.value=toFmt(hex,st.theme.fmt);setColor(t.dataset.color,hex)}
  else if(t.matches('[data-cin]')){const hex=parseColor(t.value);t.classList.toggle('bad',!hex);if(hex){const sw=$(`[data-sw="${t.dataset.cin}"]`);sw.style.setProperty('--c',hex);$('input',sw).value=hex;setColor(t.dataset.cin,hex)}}
  else if(t.id==='q'){V.q=t.value;if(V.q.trim())go('search',{k:'search'});else go(V.prev||'home')}
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-sort]')){V.sort=e.target.value;render()}
  if(e.target.matches('[data-color]')||e.target.matches('[data-cin]')){renderPal()}
});
// keep the search box from re-rendering while typing
const _go=go;
/* queue drag and drop */
let dragFrom=null;
document.addEventListener('dragstart',e=>{const q=e.target.closest?.('.qi');if(!q)return;dragFrom=+q.dataset.q;q.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragFrom))});
document.addEventListener('dragover',e=>{const q=e.target.closest?.('.qi');if(!q||dragFrom===null)return;e.preventDefault();$$('.qi.over').forEach(x=>x.classList.remove('over'));q.classList.add('over')});
document.addEventListener('dragend',()=>{dragFrom=null;$$('.qi').forEach(x=>x.classList.remove('dragging','over'))});
document.addEventListener('drop',e=>{const q=e.target.closest?.('.qi');if(!q||dragFrom===null)return;e.preventDefault();const to=+q.dataset.q,[x]=P.queue.splice(dragFrom,1);P.queue.splice(to-(dragFrom<to?1:0),0,x);dragFrom=null;renderQueue()});

document.addEventListener('keydown',e=>{
  const a=document.activeElement,typing=a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.type!=='color'&&a.type!=='range';
  if(e.ctrlKey&&e.key.toLowerCase()==='f'){e.preventDefault();$('#np').classList.remove('open');$('#q').focus();$('#q').select();return}
  if(e.key==='Escape'){if(menuEl)closeMenu();else if($('#np').classList.contains('open'))$('#np').classList.remove('open');else if(a===$('#q')){$('#q').value='';V.q='';a.blur();if(V.route==='search')go(V.prev||'home')}return}
  if(e.key==='Enter'&&a&&a.matches('[data-play],[data-go],.mi,.fold')){a.click();return}
  if(typing)return;
  if(e.key===' '&&!(a&&a.matches('button.tg,.seg button,.chip'))){e.preventDefault();toggle()}
  else if(e.key==='ArrowRight'&&!a?.matches('[data-slider]'))next(false);
  else if(e.key==='ArrowLeft'&&!a?.matches('[data-slider]'))prev();
  else if(e.key==='ArrowUp'&&!a?.matches('[data-slider]')){e.preventDefault();setVolume(st.vol+.05)}
  else if(e.key==='ArrowDown'&&!a?.matches('[data-slider]')){e.preventDefault();setVolume(st.vol-.05)}
});
document.addEventListener('keyup',e=>{const a=document.activeElement;if(e.key===' '&&!(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName))&&!(a&&a.matches('button.tg,.seg button,.chip')))e.preventDefault()});

/* =====================================================================
   Boot
   ===================================================================== */
document.addEventListener('palready',e=>{if(P.cur&&P.cur.ak===e.detail&&!st.theme.locked)Theme.live()});
// drop a folder onto the window to add it
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
document.addEventListener('drop',e=>{
  const files=e.dataTransfer&&e.dataTransfer.files;if(!files||!files.length||!NATIVE)return;e.preventDefault();
  (async()=>{for(const f of files){const p=window.nova.pathForFile(f);if(p)await libCall(window.nova.addPath(p),{ok:r=>`Added ${r.name}: ${plural(r.added,'song')}`})}})();
});
function setupMediaSession(){
  if(!('mediaSession' in navigator))return;
  const h=(a,f)=>{try{navigator.mediaSession.setActionHandler(a,f)}catch(_){}};
  h('play',()=>{if(!P.playing)toggle()});h('pause',()=>{if(P.playing)toggle()});h('previoustrack',prev);h('nexttrack',()=>next(false));
}
(function boot(){
  applyUI();
  if(NATIVE){
    document.body.classList.add('native');
    window.nova.onScan(p=>toast(`Scanning ${p.folder}: ${p.done} of ${p.total}`));
    window.nova.onMax(m=>{const u=$('[data-win="max"] use');if(u)u.setAttribute('href',m?'#i-restore':'#i-max')});
  }
  setLibrary(BOOT.library);document.body.dataset.empty=TRACKS.length?'0':'1';
  if(TRACKS.length){
    P.queue=TRACKS.map(t=>t.id);
    const l=T(st.last.id)?st.last:{id:TRACKS[0].id,pos:0};
    if(st.play.shuffle)doShuffle(l.id);
    load(l.id,{pos:l.pos||0});
  }
  bindSliders(document);go('home');requestAnimationFrame(frame);setupMediaSession();
  if(NATIVE&&st.play.scanStart&&TRACKS.length)setTimeout(silentRescan,2500);
  window.__nova={P,st,Engine,Theme,go,TRACKS:()=>TRACKS};
})();
