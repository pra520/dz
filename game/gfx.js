// ═══════════════════════════════════════════════════════
//  DEAD ZONE — 3D world renderer (three.js)
//  World mapping: game (x, y, height) -> three (x, height, y)
//  Real camera pitch, so looking up/down never warps the
//  screen; textured ground so movement is always visible.
//  Lights are created once and only change intensity, so
//  materials never recompile mid-game (no stutters).
// ═══════════════════════════════════════════════════════
(function(global){
'use strict';
let T;
const G={ready:false,renderer:null,scene:null,camera:null,level:null,quality:'medium',fovV:70,zoom:1};
const texCache={},matCache={};

// ── small helpers ──
const rnd=(a,b)=>a+Math.random()*(b-a);
function hexRgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255];}
function shade(h,f){const[r,g,b]=hexRgb(h);return`rgb(${Math.min(255,r*f)|0},${Math.min(255,g*f)|0},${Math.min(255,b*f)|0})`;}

// ── procedural textures ──
function canvasTex(size,paint,opts){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');paint(x,size);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;
  if(!(opts&&opts.linear))t.colorSpace=T.SRGBColorSpace;
  t.anisotropy=G.quality==='low'?1:4;return t;
}
function noise(x,s,base,amt,n,sz=2){
  x.fillStyle=base;x.fillRect(0,0,s,s);
  for(let i=0;i<n;i++){const f=1+rnd(-amt,amt);x.fillStyle=shade(base,f);const r=rnd(1,sz);x.fillRect(rnd(0,s),rnd(0,s),r,r);}
}
function stains(x,s,col,n,rMax){for(let i=0;i<n;i++){const g=x.createRadialGradient(0,0,0,0,0,1);const cx=rnd(0,s),cy=rnd(0,s),r=rnd(rMax*.3,rMax);x.save();x.translate(cx,cy);x.scale(r,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.beginPath();x.arc(0,0,1,0,7);x.fill();x.restore();}}
function bricks(x,s,rows,cols,brick,mortar,vary){
  x.fillStyle=mortar;x.fillRect(0,0,s,s);const bh=s/rows,bw=s/cols;
  for(let r=0;r<rows;r++)for(let c=-1;c<cols;c++){const off=(r%2)*bw/2;x.fillStyle=shade(brick,1+rnd(-vary,vary));x.fillRect(c*bw+off+1.5,r*bh+1.5,bw-3,bh-3);}
}
function tiles(x,s,n,a,b,grout){
  const t=s/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){x.fillStyle=shade((i+j)%2?a:b,1+rnd(-.05,.05));x.fillRect(i*t,j*t,t,t);}
  x.strokeStyle=grout;x.lineWidth=2;for(let i=0;i<=n;i++){x.beginPath();x.moveTo(i*t,0);x.lineTo(i*t,s);x.stroke();x.beginPath();x.moveTo(0,i*t);x.lineTo(s,i*t);x.stroke();}
}
function planks(x,s,n,col,vert){
  const p=s/n;for(let i=0;i<n;i++){x.fillStyle=shade(col,1+rnd(-.12,.12));vert?x.fillRect(i*p,0,p-2,s):x.fillRect(0,i*p,s,p-2);
    x.strokeStyle=shade(col,.75);x.lineWidth=1;for(let k=0;k<6;k++){x.beginPath();const o=i*p+rnd(2,p-4);if(vert){x.moveTo(o,0);x.bezierCurveTo(o+rnd(-3,3),s*.3,o+rnd(-3,3),s*.6,o,s);}else{x.moveTo(0,o);x.bezierCurveTo(s*.3,o+rnd(-3,3),s*.6,o+rnd(-3,3),s,o);}x.stroke();}}
}
function corrugated(x,s,col){for(let i=0;i<s;i+=8){x.fillStyle=shade(col,1.12);x.fillRect(i,0,4,s);x.fillStyle=shade(col,.82);x.fillRect(i+4,0,4,s);}stains(x,s,'rgba(110,60,20,.35)',6,30);}
function windows(x,s,wall,lit){
  noise(x,s,wall,.06,1500);
  const n=4,cw=s/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const on=Math.random()<lit;x.fillStyle=on?`rgb(${rnd(200,255)|0},${rnd(170,220)|0},${rnd(90,140)|0})`:`rgb(${rnd(15,35)|0},${rnd(20,40)|0},${rnd(35,55)|0})`;
    x.fillRect(i*cw+cw*.2,j*cw+cw*.18,cw*.6,cw*.55);x.fillStyle='rgba(255,255,255,.15)';x.fillRect(i*cw+cw*.2,j*cw+cw*.18,cw*.6,3);
  }
}
const SIGN=['#d63031','#0984e3','#00b894','#fdcb6e','#e84393','#6c5ce7'];
const PAINT={
  asphalt:(x,s)=>{noise(x,s,'#3b3b3e',.18,9000);x.strokeStyle='rgba(15,15,15,.6)';x.lineWidth=1.5;for(let i=0;i<4;i++){x.beginPath();let px=rnd(0,s),py=rnd(0,s);x.moveTo(px,py);for(let k=0;k<6;k++){px+=rnd(-25,25);py+=rnd(-25,25);x.lineTo(px,py);}x.stroke();}x.fillStyle='rgba(220,200,90,.55)';x.fillRect(s/2-3,0,6,s*.4);},
  dirt:(x,s)=>{noise(x,s,'#5b4a33',.25,12000,3);stains(x,s,'rgba(30,22,10,.35)',10,40);for(let i=0;i<60;i++){x.fillStyle=shade('#8a7a60',rnd(.7,1.2));x.beginPath();x.arc(rnd(0,s),rnd(0,s),rnd(1,3),0,7);x.fill();}},
  labtile:(x,s)=>{tiles(x,s,4,'#8a94a3','#7d8796','#2a2e36');stains(x,s,'rgba(20,30,10,.3)',8,40);},
  grass:(x,s)=>{noise(x,s,'#25351c',.3,9000,3);x.lineWidth=1;for(let i=0;i<900;i++){x.strokeStyle=shade('#3a5a2a',rnd(.6,1.3));const px=rnd(0,s),py=rnd(0,s);x.beginPath();x.moveTo(px,py);x.lineTo(px+rnd(-2,2),py-rnd(3,7));x.stroke();}stains(x,s,'rgba(40,30,15,.4)',6,40);},
  tile:(x,s)=>{tiles(x,s,4,'#d9d0c0','#c4b9a6','#8a8070');stains(x,s,'rgba(60,40,20,.18)',6,50);},
  sand:(x,s)=>{noise(x,s,'#d4b373',.1,9000);x.strokeStyle='rgba(150,110,60,.25)';x.lineWidth=2;for(let i=0;i<10;i++){x.beginPath();const o=rnd(0,s);for(let k=0;k<=s;k+=8)x.lineTo(k,o+Math.sin(k*.05+i)*6);x.stroke();}},
  snow:(x,s)=>{noise(x,s,'#e6edf5',.05,6000);stains(x,s,'rgba(170,190,220,.25)',10,50);},
  rail:(x,s)=>{noise(x,s,'#45443f',.15,8000);stains(x,s,'rgba(10,10,10,.5)',8,40);x.fillStyle='#2a2622';x.fillRect(0,s*.3,s,s*.08);x.fillRect(0,s*.62,s,s*.08);},
  hospital:(x,s)=>{tiles(x,s,8,'#cfd8d4','#c2ccc8','#8a9490');stains(x,s,'rgba(90,20,20,.18)',3,30);},
  forest:(x,s)=>{noise(x,s,'#29231a',.3,9000,3);for(let i=0;i<300;i++){x.fillStyle=Math.random()<.5?shade('#4a3a1a',rnd(.7,1.3)):shade('#2a3a1a',rnd(.7,1.3));x.save();x.translate(rnd(0,s),rnd(0,s));x.rotate(rnd(0,7));x.fillRect(-3,-1.5,6,3);x.restore();}},
  dock:(x,s)=>{noise(x,s,'#6a6a68',.12,8000);x.strokeStyle='#4a4a48';x.lineWidth=3;x.strokeRect(0,0,s,s);x.strokeRect(0,0,s/2,s/2);stains(x,s,'rgba(30,25,15,.35)',6,40);},
  prison:(x,s)=>{noise(x,s,'#6d6d6f',.12,8000);x.strokeStyle='#505052';x.lineWidth=2;x.strokeRect(1,1,s-2,s-2);stains(x,s,'rgba(30,30,30,.3)',6,40);},
  basalt:(x,s)=>{noise(x,s,'#2a2422',.3,9000,3);x.strokeStyle='rgba(255,90,10,.75)';x.lineWidth=2;for(let i=0;i<5;i++){x.beginPath();let px=rnd(0,s),py=rnd(0,s);x.moveTo(px,py);for(let k=0;k<5;k++){px+=rnd(-30,30);py+=rnd(-30,30);x.lineTo(px,py);}x.stroke();}},
  flesh:(x,s)=>{noise(x,s,'#3d1029',.3,8000,3);x.lineWidth=3;for(let i=0;i<14;i++){x.strokeStyle=`rgba(${rnd(140,220)|0},20,${rnd(40,90)|0},.6)`;x.beginPath();let px=rnd(0,s),py=rnd(0,s);x.moveTo(px,py);for(let k=0;k<4;k++){x.quadraticCurveTo(px+rnd(-40,40),py+rnd(-40,40),px+=rnd(-40,40),py+=rnd(-40,40));}x.stroke();}},
  brick:(x,s)=>{bricks(x,s,8,4,'#7a3b2b','#8a8274',.16);stains(x,s,'rgba(20,15,10,.3)',6,50);},
  concrete:(x,s)=>{noise(x,s,'#85857f',.1,9000);x.strokeStyle='rgba(50,50,50,.5)';x.lineWidth=2;x.strokeRect(0,0,s,s/2);x.strokeRect(0,s/2,s,s/2);stains(x,s,'rgba(40,35,30,.3)',8,40);},
  labpanel:(x,s)=>{noise(x,s,'#59616e',.08,6000);x.strokeStyle='#2c3038';x.lineWidth=3;x.strokeRect(2,2,s-4,s-4);x.strokeRect(2,2,s/2-2,s-4);x.fillStyle='#9aa4b4';for(const[a,b]of[[10,10],[s-12,10],[10,s-12],[s-12,s-12]])x.fillRect(a,b,3,3);stains(x,s,'rgba(10,30,10,.3)',4,40);},
  stone:(x,s)=>{x.fillStyle='#4a4a50';x.fillRect(0,0,s,s);const r=6;for(let i=0;i<r;i++){let cx=0;const h=s/r;while(cx<s){const w=rnd(30,70);x.fillStyle=shade('#6c6c74',rnd(.8,1.15));x.fillRect(cx+1.5,i*h+1.5,w-3,h-3);cx+=w;}}stains(x,s,'rgba(30,60,20,.25)',6,40);},
  adobe:(x,s)=>{noise(x,s,'#c49a68',.1,8000,3);x.strokeStyle='rgba(110,70,40,.4)';for(let i=0;i<4;i++){x.beginPath();let px=rnd(0,s),py=rnd(0,s);x.moveTo(px,py);for(let k=0;k<4;k++)x.lineTo(px+=rnd(-20,20),py+=rnd(-20,20));x.stroke();}},
  metal:(x,s)=>{corrugated(x,s,'#7d858d');},
  corrugated:(x,s)=>{corrugated(x,s,'#b8b8b8');x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=4;x.strokeRect(2,2,s-4,s-4);},
  tunnel:(x,s)=>{tiles(x,s,8,'#4a4a42','#42423b','#1e1e1a');stains(x,s,'rgba(0,0,0,.5)',8,40);},
  hospitalwall:(x,s)=>{noise(x,s,'#c3cfc6',.05,5000);x.fillStyle='#7a9a8a';x.fillRect(0,s*.86,s,s*.14);stains(x,s,'rgba(80,60,30,.18)',5,40);},
  wood:(x,s)=>planks(x,s,6,'#5a3b22'),
  logwall:(x,s)=>{for(let i=0;i<6;i++){const g=x.createLinearGradient(0,i*s/6,0,(i+1)*s/6);g.addColorStop(0,'#3a2412');g.addColorStop(.5,'#7a5230');g.addColorStop(1,'#3a2412');x.fillStyle=g;x.fillRect(0,i*s/6,s,s/6);}},
  prisonbrick:(x,s)=>{bricks(x,s,8,4,'#6c6c6c','#4a4a4a',.12);stains(x,s,'rgba(20,20,20,.3)',6,40);},
  roof:(x,s)=>{noise(x,s,'#3a3a3a',.15,6000);x.strokeStyle='#2a2a2a';x.lineWidth=2;x.strokeRect(0,0,s,s);},
  crate:(x,s)=>{planks(x,s,4,'#8a6238',true);x.strokeStyle='#4a3218';x.lineWidth=s*.08;x.strokeRect(s*.04,s*.04,s*.92,s*.92);x.beginPath();x.moveTo(s*.08,s*.08);x.lineTo(s*.92,s*.92);x.stroke();},
  sandbag:(x,s)=>{x.fillStyle='#6a5c40';x.fillRect(0,0,s,s);for(let r=0;r<4;r++)for(let c=-1;c<3;c++){const o=(r%2)*s/6;x.fillStyle=shade('#a89466',rnd(.85,1.1));x.beginPath();x.ellipse(c*s/3+o+s/6,r*s/4+s/8,s/6-3,s/8-3,0,0,7);x.fill();}},
  tomb:(x,s)=>{noise(x,s,'#7d7d84',.12,5000);x.fillStyle='rgba(40,40,45,.7)';x.font=`bold ${s*.14}px serif`;x.textAlign='center';x.fillText('R.I.P',s/2,s*.45);x.fillRect(s*.3,s*.55,s*.4,3);stains(x,s,'rgba(40,70,30,.35)',4,30);},
  bark:(x,s)=>{x.fillStyle='#3a2a1a';x.fillRect(0,0,s,s);for(let i=0;i<40;i++){x.strokeStyle=shade('#5a4028',rnd(.6,1.3));x.lineWidth=rnd(2,5);x.beginPath();const o=rnd(0,s);x.moveTo(o,0);x.lineTo(o+rnd(-6,6),s);x.stroke();}},
  leaves:(x,s)=>{noise(x,s,'#1e3a1e',.35,9000,4);},
  ice:(x,s)=>{noise(x,s,'#b8dcf0',.06,3000);x.strokeStyle='rgba(255,255,255,.6)';x.lineWidth=1.5;for(let i=0;i<6;i++){x.beginPath();let px=rnd(0,s),py=rnd(0,s);x.moveTo(px,py);for(let k=0;k<4;k++)x.lineTo(px+=rnd(-30,30),py+=rnd(-30,30));x.stroke();}},
  train:(x,s)=>{noise(x,s,'#9aa0a8',.05,3000);x.fillStyle='#1f5aa8';x.fillRect(0,s*.15,s,s*.1);for(let i=0;i<3;i++){x.fillStyle='#1a2028';x.fillRect(i*s/3+8,s*.38,s/3-16,s*.3);}x.fillStyle='#555';x.fillRect(0,s*.88,s,s*.12);},
  module:(x,s)=>{noise(x,s,'#d8dde2',.04,3000);x.fillStyle='#e8661a';x.fillRect(0,s*.7,s,s*.08);x.strokeStyle='#9aa0a6';x.lineWidth=3;x.strokeRect(2,2,s-4,s-4);x.fillStyle='#2a3a4a';x.fillRect(s*.35,s*.25,s*.3,s*.22);},
  cellblock:(x,s)=>{noise(x,s,'#7a7a76',.08,6000);for(let i=0;i<2;i++){x.fillStyle='#151515';x.fillRect(i*s/2+s*.12,s*.2,s*.26,s*.3);x.fillStyle='#555';for(let k=0;k<5;k++)x.fillRect(i*s/2+s*.12+k*s*.06,s*.2,3,s*.3);}},
  chain:(x,s)=>{x.clearRect(0,0,s,s);x.strokeStyle='#9aa0a4';x.lineWidth=2;for(let i=-s;i<s*2;i+=14){x.beginPath();x.moveTo(i,0);x.lineTo(i+s,s);x.stroke();x.beginPath();x.moveTo(i,s);x.lineTo(i+s,0);x.stroke();}x.fillStyle='#6a6e72';x.fillRect(0,0,s,6);},
  machine:(x,s)=>{noise(x,s,'#4a5260',.08,3000);x.fillStyle='#111';x.fillRect(s*.15,s*.15,s*.7,s*.35);x.fillStyle='#33ff99';for(let i=0;i<5;i++)x.fillRect(s*.2+i*s*.12,s*.6,s*.06,s*.06);x.fillStyle='#2aff7a';x.font=`${s*.1}px monospace`;x.fillText('SYS OK',s*.2,s*.35);},
  lava:(x,s)=>{const g=x.createLinearGradient(0,0,s,s);g.addColorStop(0,'#ff5a00');g.addColorStop(.5,'#ffb000');g.addColorStop(1,'#ff3a00');x.fillStyle=g;x.fillRect(0,0,s,s);for(let i=0;i<30;i++){x.fillStyle=`rgba(${rnd(60,120)|0},${rnd(10,30)|0},0,${rnd(.4,.8)})`;x.beginPath();x.ellipse(rnd(0,s),rnd(0,s),rnd(8,30),rnd(5,16),rnd(0,3),0,7);x.fill();}},
  water:(x,s)=>{noise(x,s,'#1c3a55',.12,4000,3);x.strokeStyle='rgba(160,200,230,.25)';for(let i=0;i<20;i++){x.beginPath();const px=rnd(0,s),py=rnd(0,s);x.arc(px,py,rnd(6,20),0,Math.PI);x.stroke();}},
  labceil:(x,s)=>{noise(x,s,'#3a3e46',.06,3000);x.strokeStyle='#22252a';x.lineWidth=3;x.strokeRect(0,0,s,s);x.fillStyle='#f0f4ff';x.fillRect(s*.3,s*.42,s*.4,s*.16);},
  mallceil:(x,s)=>{noise(x,s,'#5a5650',.05,3000);x.fillStyle='#fff8e8';x.beginPath();x.arc(s/2,s/2,s*.12,0,7);x.fill();},
  tunnelceil:(x,s)=>{noise(x,s,'#2a2a28',.15,5000);x.fillStyle='#ffeecc';x.fillRect(s*.45,s*.1,s*.1,s*.8);},
  obsidian:(x,s)=>{noise(x,s,'#151018',.25,5000);x.strokeStyle='rgba(180,60,255,.5)';x.lineWidth=2;for(let i=0;i<4;i++){x.beginPath();let px=rnd(0,s);x.moveTo(px,0);for(let k=1;k<=4;k++)x.lineTo(px+=rnd(-20,20),k*s/4);x.stroke();}},
  bed:(x,s)=>{x.fillStyle='#e8ecec';x.fillRect(0,0,s,s);x.fillStyle='#8aa4b8';x.fillRect(0,s*.6,s,s*.4);stains(x,s,'rgba(120,10,10,.35)',3,30);},
  pod:(x,s)=>{noise(x,s,'#4a6a1a',.3,4000,3);stains(x,s,'rgba(200,255,80,.5)',8,25);},
  roofshingle:(x,s)=>{for(let r=0;r<8;r++)for(let c=0;c<8;c++){x.fillStyle=shade('#4a2a1a',rnd(.8,1.2));x.fillRect(c*s/8+(r%2)*s/16,r*s/8,s/8-2,s/8-2);}},
};
for(let v=0;v<6;v++){
  PAINT['store'+v]=(x,s)=>{noise(x,s,'#4a4642',.06,3000);x.fillStyle=SIGN[v];x.fillRect(0,s*.08,s,s*.16);x.fillStyle='rgba(255,255,255,.8)';x.fillRect(s*.2,s*.13,s*.6,s*.05);x.fillStyle='#1c2830';x.fillRect(s*.06,s*.34,s*.88,s*.5);x.fillStyle='rgba(140,200,255,.18)';x.fillRect(s*.06,s*.34,s*.88,s*.08);x.fillStyle='#2a2826';x.fillRect(0,s*.88,s,s*.12);};
  PAINT['bld'+v]=(x,s)=>windows(x,s,['#6a5a4a','#5a5f66','#7a6a58','#4a4e58','#6e6e66','#5a4a40'][v],.22);
}

function tex(key){
  if(texCache[key])return texCache[key];
  const p=PAINT[key]||PAINT.concrete;
  return texCache[key]=canvasTex(256,p);
}
function glowTex(){
  if(texCache._glow)return texCache._glow;
  const t=canvasTex(64,(x,s)=>{const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,s,s);});
  t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return texCache._glow=t;
}
function emojiTex(e){
  const k='_e'+e;if(texCache[k])return texCache[k];
  const t=canvasTex(128,(x,s)=>{x.font=`${s*.72}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(e,s/2,s*.54);});
  t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return texCache[k]=t;
}

function lambert(key,opts){
  const k=key+JSON.stringify(opts||{});if(matCache[k])return matCache[k];
  const o=Object.assign({},opts||{});
  if(key)o.map=tex(key);
  return matCache[k]=new T.MeshLambertMaterial(o);
}

// ── geometry accumulator: merges every static block of the same material into one mesh ──
class Acc{
  constructor(mat){this.mat=mat;this.p=[];this.n=[];this.u=[];this.i=[];}
  quad(a,b,c,d,n,uw,uh){
    const o=this.p.length/3;this.p.push(...a,...b,...c,...d);
    for(let k=0;k<4;k++)this.n.push(...n);
    this.u.push(0,0,uw,0,uw,uh,0,uh);this.i.push(o,o+1,o+2,o,o+2,o+3);
  }
  geom(g,m,uvS){
    const pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv;
    const o=this.p.length/3,v=new T.Vector3(),nm=new T.Matrix3().getNormalMatrix(m);
    for(let k=0;k<pos.count;k++){
      v.fromBufferAttribute(pos,k).applyMatrix4(m);this.p.push(v.x,v.y,v.z);
      v.fromBufferAttribute(nor,k).applyMatrix3(nm).normalize();this.n.push(v.x,v.y,v.z);
      this.u.push(uv?uv.getX(k)*(uvS?uvS[0]:1):0,uv?uv.getY(k)*(uvS?uvS[1]:1):0);
    }
    if(g.index)for(let k=0;k<g.index.count;k++)this.i.push(o+g.index.getX(k));
    else for(let k=0;k<pos.count;k++)this.i.push(o+k);
    g.dispose();
  }
  mesh(){
    if(!this.i.length)return null;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(this.u,2));
    g.setIndex(this.i);g.computeBoundingSphere();
    return new T.Mesh(g,this.mat);
  }
}
// box from game footprint (x,y,w,h) and height range [z0,z1]; S = texture world size
function box(side,top,x,y,w,h,z0,z1,S){
  const X0=x,X1=x+w,Z0=y,Z1=y+h,H=z1-z0;
  if(side){
    side.quad([X1,z0,Z1],[X1,z0,Z0],[X1,z1,Z0],[X1,z1,Z1],[1,0,0],h/S,H/S);
    side.quad([X0,z0,Z0],[X0,z0,Z1],[X0,z1,Z1],[X0,z1,Z0],[-1,0,0],h/S,H/S);
    side.quad([X0,z0,Z1],[X1,z0,Z1],[X1,z1,Z1],[X0,z1,Z1],[0,0,1],w/S,H/S);
    side.quad([X1,z0,Z0],[X0,z0,Z0],[X0,z1,Z0],[X1,z1,Z0],[0,0,-1],w/S,H/S);
  }
  if(top)top.quad([X0,z1,Z1],[X1,z1,Z1],[X1,z1,Z0],[X0,z1,Z0],[0,1,0],w/S,h/S);
}

// ── level kinds: how each block type looks ──
const CAR_COL=['#a8322a','#2a5aa8','#d8d8d0','#1a1a1e','#d8b02a','#6a4a30'];
const CONT_COL=['#a83a2a','#2a5a98','#3a7a3a','#d87a1a','#7a7a7a','#c8a82a'];
const WALL_TEX={brick:'brick',concrete:'concrete',labpanel:'labpanel',stone:'stone',store:'store0',adobe:'adobe',metal:'metal',tunnel:'tunnel',hospital:'hospitalwall',wood:'logwall',prisonbrick:'prisonbrick',basalt:'basalt',flesh:'flesh',ice:'ice'};

function buildLevel(map,level){
  clearLevel();
  const th=level.theme,root=new T.Group();G.level={root,map,level,anim:[],lava:[],water:[]};
  const accs={};
  const A=(key,opts)=>{const k=key+'|'+JSON.stringify(opts||{});return accs[k]||(accs[k]=new Acc(lambert(key,opts)));};
  const wallKey=WALL_TEX[th.wall]||'concrete';
  const m4=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),sc=new T.Vector3(),ps=new T.Vector3();
  const place=(acc,g,x,h,y,ry,sx,sy,sz,uvS)=>{e.set(0,ry||0,0);q.setFromEuler(e);ps.set(x,h,y);sc.set(sx||1,sy||1,sz||1);m4.compose(ps,q,sc);acc.geom(g,m4,uvS);};

  // floor
  const B=map.B,flTex=tex(th.floor);flTex.repeat.set(B/220,B/220);
  const floor=new T.Mesh(new T.PlaneGeometry(B,B),new T.MeshLambertMaterial({map:flTex}));
  floor.rotation.x=-Math.PI/2;floor.position.set(B/2,0,B/2);root.add(floor);
  // ceiling (indoor maps)
  if(th.indoor){
    const ct=canvasTex(256,PAINT[th.ceiling]||PAINT.labceil);ct.repeat.set(B/240,B/240);
    const ceil=new T.Mesh(new T.PlaneGeometry(B,B),new T.MeshLambertMaterial({map:ct,emissive:'#ffffff',emissiveMap:ct,emissiveIntensity:.35}));
    ceil.rotation.x=Math.PI/2;ceil.position.set(B/2,th.indoor,B/2);root.add(ceil);
  }

  for(const w of map.walls){
    const cx=w.x+w.w/2,cy=w.y+w.h/2,ht=w.ht;
    switch(w.k){
      case'border':{const k=w.v==='building'?'bld1':(WALL_TEX[w.v]||wallKey);box(A(k),A('roof'),w.x,w.y,w.w,w.h,0,ht,k.startsWith('bld')?180:140);break;}
      case'wall':box(A(wallKey),A(th.indoor?wallKey:'concrete'),w.x,w.y,w.w,w.h,0,ht,140);break;
      case'building':box(A('bld'+(w.v||0)),A('roof'),w.x,w.y,w.w,w.h,0,ht,170);break;
      case'hangar':case'bunker':case'barracks':box(A('concrete'),A('roof'),w.x,w.y,w.w,w.h,0,ht,140);break;
      case'warehouse':box(A('metal'),A('roof'),w.x,w.y,w.w,w.h,0,ht,120);break;
      case'cellblock':box(A('cellblock'),A('roof'),w.x,w.y,w.w,w.h,0,ht,150);break;
      case'crate':box(A('crate'),A('crate'),w.x,w.y,w.w,w.h,0,ht,Math.max(w.w,w.h));break;
      case'sandbag':box(A('sandbag'),A('sandbag'),w.x,w.y,w.w,w.h,0,ht,40);break;
      case'barrier':box(A('concrete',{color:'#b8b8b0'}),A('concrete',{color:'#b8b8b0'}),w.x,w.y,w.w,w.h,0,ht,80);break;
      case'machine':box(A('machine'),A('labpanel'),w.x,w.y,w.w,w.h,0,ht,80);break;
      case'tomb':box(A('tomb'),A('stone'),w.x,w.y,w.w,w.h,0,ht,50);break;
      case'crypt':box(A('stone'),null,w.x,w.y,w.w,w.h,0,ht,120);box(A('stone',{color:'#9a9aa0'}),A('roof'),w.x-12,w.y-12,w.w+24,w.h+24,ht,ht+14,80);break;
      case'statue':box(A('stone'),A('stone'),w.x,w.y,w.w,w.h,0,ht,60);break;
      case'planter':box(A('concrete'),A('grass'),w.x,w.y,w.w,w.h,0,ht,100);
        place(A('leaves'),new T.SphereGeometry(1,8,6),cx,ht+30,cy,0,w.w*.45,40,w.h*.45);break;
      case'kiosk':box(A('store'+(w.v||0)),A('roof'),w.x,w.y,w.w,w.h,0,ht,80);break;
      case'store':box(A('store'+(w.v||0)),A('roof'),w.x,w.y,w.w,w.h,0,ht,130);break;
      case'escalator':box(A('metal',{color:'#c0c4c8'}),A('rail'),w.x,w.y,w.w,w.h,0,ht,100);break;
      case'bench':box(A('wood'),A('wood'),w.x,w.y,w.w,w.h,12,ht,60);box(A('metal'),null,w.x+4,w.y+4,w.w-8,w.h-8,0,12,40);break;
      case'bed':box(A('metal',{color:'#ccc'}),A('bed'),w.x,w.y,w.w,w.h,0,ht,w.h);break;
      case'cabinet':case'desk':box(A(w.k==='desk'?'wood':'metal',{color:'#b0b8b8'}),A('wood'),w.x,w.y,w.w,w.h,0,ht,80);break;
      case'hut':box(A('adobe'),A('adobe'),w.x,w.y,w.w,w.h,0,ht,120);box(A('wood'),A('wood'),w.x-10,w.y-10,w.w+20,w.h+20,ht,ht+8,80);break;
      case'cabin':box(A('logwall'),null,w.x,w.y,w.w,w.h,0,ht,120);box(A('roofshingle'),A('roofshingle'),w.x-16,w.y-16,w.w+32,w.h+32,ht,ht+22,90);break;
      case'module':box(A('module'),A('metal',{color:'#ddd'}),w.x,w.y,w.w,w.h,0,ht,Math.max(w.w,w.h)/2);break;
      case'container':{const col=CONT_COL[w.v||0];box(A('corrugated',{color:col}),A('corrugated',{color:col}),w.x,w.y,w.w,w.h,0,ht,w.w>w.h?w.w/2:w.h/2);break;}
      case'train':box(A('train'),A('metal',{color:'#aab'}),w.x,w.y,w.w,w.h,0,ht,150);break;
      case'pillar':box(A(wallKey),null,w.x,w.y,w.w,w.h,0,ht,80);break;
      case'ruin':box(A('stone',{color:'#8a6a60'}),A('basalt'),w.x,w.y,w.w,w.h,0,ht,100);break;
      case'obsidian':box(A('obsidian',{emissive:'#3a0a5a'}),A('obsidian'),w.x,w.y,w.w,w.h,0,ht,80);break;
      case'membrane':place(A('flesh',{emissive:'#300818'}),new T.CylinderGeometry(1,1.15,1,10),cx,ht/2,cy,0,w.w/2,ht,w.h/2,[3,2]);break;
      case'fleshpillar':place(A('flesh',{emissive:'#300818'}),new T.CylinderGeometry(.75,1,1,9),cx,ht/2,cy,0,w.w/2,ht,w.h/2,[2,3]);break;
      case'pod':place(A('pod',{emissive:'#3a6a00'}),new T.SphereGeometry(1,10,8),cx,ht*.45,cy,0,w.w*.55,ht*.55,w.h*.55);break;
      case'tank':place(A('metal',{color:'#d8d8d8'}),new T.CylinderGeometry(1,1,1,14),cx,ht/2,cy,0,w.w/2,ht,w.h/2,[3,1]);break;
      case'bollard':place(A('metal',{color:'#333'}),new T.CylinderGeometry(1,1,1,8),cx,ht/2,cy,0,w.w/2,ht,w.h/2);break;
      case'ice':box(A('ice',{transparent:true,opacity:.82,color:'#cfeeff'}),A('snow'),w.x,w.y,w.w,w.h,0,ht,100);break;
      case'drift':place(A('snow'),new T.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),cx,0,cy,0,w.w*.6,ht,w.h*.6,[2,1]);break;
      case'rock':{const g=new T.DodecahedronGeometry(1,0);const p=g.attributes.position;for(let k=0;k<p.count;k++)p.setXYZ(k,p.getX(k)*rnd(.85,1.15),p.getY(k)*rnd(.85,1.15),p.getZ(k)*rnd(.85,1.15));g.computeVertexNormals();
        const key=th.wall==='basalt'?'basalt':th.wall==='ice'?'ice':th.floor==='sand'?'adobe':'stone';
        place(A(key),g,cx,ht*.42,cy,rnd(0,6),w.w*.62,ht*.6,w.h*.62,[2,2]);break;}
      case'tree':{const s=[1,1.15,.9][w.v||0];
        place(A('bark'),new T.CylinderGeometry(7*s,11*s,130*s,7),cx,65*s,cy,0,1,1,1,[1,2]);
        for(let k=0;k<3;k++)place(A('leaves',{color:'#5a8a5a'}),new T.ConeGeometry((80-k*18)*s,(110-k*12)*s,8),cx,(110+k*58)*s,cy,rnd(0,6),1,1,1,[3,3]);break;}
      case'deadtree':{place(A('bark',{color:'#888'}),new T.CylinderGeometry(5,10,ht,6),cx,ht/2,cy,0,1,1,1,[1,2]);
        for(let k=0;k<4;k++){const a=rnd(0,6.28),hh=rnd(ht*.45,ht*.85);const g=new T.CylinderGeometry(2,4,70,5);g.rotateZ(rnd(.6,1.1));g.rotateY(a);g.translate(Math.cos(a)*24,0,-Math.sin(a)*24);place(A('bark',{color:'#888'}),g,cx,hh,cy);}break;}
      case'palm':{place(A('bark',{color:'#b8a070'}),new T.CylinderGeometry(6,9,ht,7),cx,ht/2,cy,0,1,1,1,[1,3]);
        for(let k=0;k<7;k++){const a=k/7*Math.PI*2,g=new T.BoxGeometry(110,3,26);g.translate(55,0,0);g.rotateZ(-.45);g.rotateY(a);place(A('leaves',{color:'#7aaa4a'}),g,cx,ht,cy);}break;}
      case'log':{const g=new T.CylinderGeometry(ht/2,ht/2,Math.max(w.w,w.h),8);if(w.w>w.h)g.rotateZ(Math.PI/2);else g.rotateX(Math.PI/2);place(A('bark'),g,cx,ht/2,cy,0,1,1,1,[2,1]);break;}
      case'car':{const col=CAR_COL[w.v||0];box(A('metal',{color:col}),A('metal',{color:col}),w.x,w.y,w.w,w.h,6,26,40);
        const ins=.18;box(A(null,{color:'#15181c'}),A('metal',{color:col}),w.x+w.w*ins,w.y+w.h*ins,w.w*(1-2*ins),w.h*(1-2*ins),26,ht,30);
        box(A(null,{color:'#111'}),null,w.x+3,w.y+3,w.w-6,w.h-6,0,6,20);break;}
      case'tower':{const leg=8;for(const[dx,dy]of[[0,0],[w.w-leg,0],[0,w.h-leg],[w.w-leg,w.h-leg]])box(A('metal',{color:'#666'}),null,w.x+dx,w.y+dy,leg,leg,0,ht-70,40);
        box(A('wood'),A('roof'),w.x-w.w*.3,w.y-w.h*.3,w.w*1.6,w.h*1.6,ht-70,ht,80);break;}
      case'crane':box(A('metal',{color:'#d8a020'}),null,w.x,w.y,w.w,w.h,0,ht,60);break;
      case'water':{const wt=tex('water');const mt=new T.MeshLambertMaterial({map:wt,transparent:true,opacity:.9,emissive:'#0a1a2a'});wt.repeat.set(w.w/260,w.h/260);
        const pl=new T.Mesh(new T.PlaneGeometry(w.w,w.h),mt);pl.rotation.x=-Math.PI/2;pl.position.set(cx,3,cy);root.add(pl);G.level.water.push(wt);break;}
      case'fence':{const m=lambert('chain',{transparent:false,alphaTest:.4,side:T.DoubleSide});const pl=new T.Mesh(new T.PlaneGeometry(Math.max(w.w,w.h),ht),m);
        m.map.repeat.set(Math.max(w.w,w.h)/90,ht/90);pl.position.set(cx,ht/2,cy);if(w.h>w.w)pl.rotation.y=Math.PI/2;root.add(pl);
        const n=Math.ceil(Math.max(w.w,w.h)/150);for(let k=0;k<=n;k++){const t=k/n;box(A('metal',{color:'#555'}),null,w.w>w.h?w.x+t*w.w-3:cx-3,w.w>w.h?cy-3:w.y+t*w.h-3,6,6,0,ht+6,30);}break;}
      case'campfire':{for(let k=0;k<3;k++){const g=new T.CylinderGeometry(4,4,60,6);g.rotateZ(Math.PI/2);g.rotateY(k*1.05);place(A('bark'),g,cx,5,cy);}
        place(A(null,{color:'#555'}),new T.TorusGeometry(26,6,5,10),cx,3,cy,0,1,1,1);break;}
      default:box(A(wallKey),A('roof'),w.x,w.y,w.w,w.h,0,ht,120);
    }
  }
  for(const d of map.decor){
    if(d.k==='cranebeam'){box(A('metal',{color:'#d8a020'}),A('metal',{color:'#d8a020'}),d.x,d.y,d.w,30,d.ht,d.ht+30,60);box(A('metal',{color:'#d8a020'}),A('metal',{color:'#d8a020'}),d.x,d.y+d.h-30,d.w,30,d.ht,d.ht+30,60);
      box(A('metal',{color:'#e8b030'}),A('metal',{color:'#e8b030'}),d.x+d.w*.4,d.y,60,d.h,d.ht+30,d.ht+80,60);}
  }
  for(const h of map.hazards){
    const lt=canvasTex(256,PAINT.lava);lt.repeat.set(h.w/200,h.h/200);
    const pl=new T.Mesh(new T.PlaneGeometry(h.w,h.h),new T.MeshLambertMaterial({map:lt,emissive:'#ffffff',emissiveMap:lt,emissiveIntensity:.9}));
    pl.rotation.x=-Math.PI/2;pl.position.set(h.x+h.w/2,1.5,h.y+h.h/2);root.add(pl);G.level.lava.push(lt);
  }
  for(const k in accs){const m=accs[k].mesh();if(m)root.add(m);}
  G.scene.add(root);

  // atmosphere
  const fogC=new T.Color(th.fog);G.scene.fog=new T.Fog(fogC,th.indoor?120:260,th.fogFar);
  G.renderer.setClearColor(fogC);
  G.sky.material.uniforms.top.value.set(th.sky[0]);G.sky.material.uniforms.bot.value.set(th.sky[1]);
  G.sky.visible=!th.indoor;
  G.hemi.color.set(th.hemi[0]);G.hemi.groundColor.set(th.hemi[1]);G.hemi.intensity=th.hemi[2]*2.6;
  G.sun.color.set(th.sun[0]);G.sun.intensity=th.sun[1]*2.2;
  G.dark=!!th.dark;G.flashOn=G.dark;
  G.fire.intensity=0;G.fireAt=map.campfire||null;
  G.ambKind=th.ambient||'none';G.ambT=0;
}
function clearLevel(){
  if(!G.level)return;
  G.scene.remove(G.level.root);
  G.level.root.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  G.level=null;
}

// ── particles: two pooled point clouds (normal + additive) ──
const PCAP=2600;
function makePool(additive){
  const geo=new T.BufferGeometry();
  const pos=new Float32Array(PCAP*3),col=new Float32Array(PCAP*4),size=new Float32Array(PCAP);
  geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('rgba',new T.BufferAttribute(col,4).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('size',new T.BufferAttribute(size,1).setUsage(T.DynamicDrawUsage));
  geo.setDrawRange(0,0);
  const mat=new T.ShaderMaterial({
    uniforms:{scale:{value:400}},transparent:true,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending,
    vertexShader:'attribute float size;attribute vec4 rgba;varying vec4 vC;uniform float scale;void main(){vC=rgba;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(256.,size*scale/max(1.,-mv.z));gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying vec4 vC;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);if(d>.5)discard;gl_FragColor=vec4(vC.rgb,vC.a*smoothstep(.5,.15,d));}'
  });
  const pts=new T.Points(geo,mat);pts.frustumCulled=false;
  return{pts,geo,pos,col,size,mat,list:[]};
}
const PRESET={
  blood:  {add:0,col:['#8a0000','#b00000','#600000'],life:[.5,.9],size:[3,6],spd:[60,180],up:[40,140],grav:500,drag:1.5,grow:0},
  gib:    {add:0,col:['#5a0000','#3a0a0a'],life:[.8,1.3],size:[5,9],spd:[80,200],up:[100,260],grav:700,drag:1,grow:0},
  spark:  {add:1,col:['#ffdd88','#ffaa33','#ffffff'],life:[.12,.3],size:[2,4],spd:[120,360],up:[20,160],grav:600,drag:2,grow:0},
  dust:   {add:0,col:['#8a8070','#6a6458'],life:[.4,.8],size:[6,12],spd:[20,70],up:[10,40],grav:-10,drag:3,grow:20,a:.5},
  smoke:  {add:0,col:['#3a3a3a','#555555','#2a2a2a'],life:[.9,1.8],size:[25,45],spd:[20,80],up:[30,90],grav:-40,drag:1.5,grow:45,a:.55},
  fire:   {add:1,col:['#ff6a00','#ffaa00','#ff3300'],life:[.25,.6],size:[14,30],spd:[20,90],up:[60,160],grav:-120,drag:2,grow:-15},
  flame:  {add:1,col:['#ff7a10','#ffbb33','#ff4400'],life:[.18,.32],size:[12,22],spd:[0,0],up:[0,0],grav:-60,drag:.5,grow:60},
  boom:   {add:1,col:['#ffcc55','#ff7a10','#ff4400','#ffffff'],life:[.35,.8],size:[40,90],spd:[150,520],up:[50,300],grav:-60,drag:3,grow:40},
  acid:   {add:1,col:['#aaff22','#66dd00','#ccff66'],life:[.3,.7],size:[4,9],spd:[60,180],up:[60,160],grav:500,drag:1.5,grow:0},
  poison: {add:0,col:['#7a3aaa','#5aaa3a','#8a4acc'],life:[1,2],size:[30,60],spd:[10,40],up:[5,25],grav:-8,drag:1,grow:20,a:.3},
  blink:  {add:1,col:['#55ffff','#aaffff','#3388ff'],life:[.3,.6],size:[8,18],spd:[40,160],up:[20,120],grav:0,drag:2,grow:0},
  plasma: {add:1,col:['#ff66ff','#ff99ff','#ffffff'],life:[.15,.35],size:[4,9],spd:[60,220],up:[20,120],grav:0,drag:3,grow:0},
  tesla:  {add:1,col:['#66ddff','#ffffff','#3399ff'],life:[.1,.25],size:[4,8],spd:[80,260],up:[20,150],grav:0,drag:3,grow:0},
  ember:  {add:1,col:['#ff6a10','#ffaa30'],life:[2,4],size:[2,4],spd:[5,25],up:[30,70],grav:-15,drag:.3,grow:0},
  snow:   {add:0,col:['#ffffff','#e8f0ff'],life:[3,5],size:[2,4],spd:[5,25],up:[-90,-50],grav:0,drag:0,grow:0,a:.85},
  rain:   {add:0,col:['#9ab0c8'],life:[.5,.8],size:[1.5,2.5],spd:[0,10],up:[-700,-550],grav:0,drag:0,grow:0,a:.5},
  spores: {add:1,col:['#88ff99','#ffaaff','#aaccff'],life:[3,5],size:[1.5,3],spd:[3,15],up:[-5,12],grav:0,drag:.2,grow:0,a:.6},
  fireflies:{add:1,col:['#ccff66','#ffee66'],life:[2,4],size:[2,4],spd:[10,30],up:[-10,10],grav:0,drag:.1,grow:0},
  sand:   {add:0,col:['#d8b880','#c8a060'],life:[1.5,3],size:[1.5,3],spd:[60,140],up:[-5,10],grav:0,drag:0,grow:0,a:.5},
  mist:   {add:0,col:['#8a9aaa','#aab8c8'],life:[4,7],size:[90,160],spd:[5,15],up:[-2,4],grav:0,drag:0,grow:10,a:.08},
  muzzle: {add:1,col:['#ffeeaa','#ffaa44'],life:[.04,.08],size:[14,24],spd:[0,40],up:[0,30],grav:0,drag:0,grow:30},
  heal:   {add:1,col:['#44ff88','#aaffcc'],life:[.4,.8],size:[5,10],spd:[20,60],up:[60,140],grav:-20,drag:1,grow:0},
};
function emit(kind,x,y,z,n,o){
  const P=PRESET[kind];if(!P||!G.ready)return;
  const pool=P.add?G.padd:G.pnorm;o=o||{};
  for(let i=0;i<n;i++){
    if(pool.list.length>=PCAP)pool.list.shift();
    const a=rnd(0,Math.PI*2),sp=rnd(P.spd[0],P.spd[1])*(o.spd||1);
    const [r,g,b]=hexRgb(o.col||P.col[Math.floor(Math.random()*P.col.length)]);
    let vx=Math.cos(a)*sp,vy=Math.sin(a)*sp,vz=rnd(P.up[0],P.up[1])*(o.up||1);
    if(o.dir){vx=o.dir[0]*o.v+rnd(-1,1)*(o.jit||40);vy=o.dir[1]*o.v+rnd(-1,1)*(o.jit||40);vz=o.dir[2]*o.v+rnd(-1,1)*(o.jit||40);}
    const life=rnd(P.life[0],P.life[1])*(o.life||1);
    pool.list.push({x:x+rnd(-1,1)*(o.spread||0),y:y+rnd(-1,1)*(o.spread||0),z:z+rnd(-.5,.5)*(o.zs||0),vx,vy,vz,life,max:life,
      size:rnd(P.size[0],P.size[1])*(o.size||1),grow:P.grow,grav:P.grav,drag:P.drag,r:r/255,g:g/255,b:b/255,a:P.a==null?1:P.a});
  }
}
function updPool(pool,dt){
  const L=pool.list;let w=0;
  for(let i=0;i<L.length;i++){
    const p=L[i];p.life-=dt;if(p.life<=0)continue;
    p.vz-=p.grav*dt;const d=Math.max(0,1-p.drag*dt);p.vx*=d;p.vy*=d;p.vz*=d;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.z<0.5&&p.grav>0){p.z=.5;p.vz*=-.2;p.vx*=.6;p.vy*=.6;}
    p.size=Math.max(.5,p.size+p.grow*dt);
    const k=w;pool.pos[k*3]=p.x;pool.pos[k*3+1]=p.z;pool.pos[k*3+2]=p.y;
    const t=p.life/p.max,al=p.a*Math.min(1,t*2.5);
    pool.col[k*4]=p.r;pool.col[k*4+1]=p.g;pool.col[k*4+2]=p.b;pool.col[k*4+3]=al;pool.size[k]=p.size;
    L[w++]=p;
  }
  L.length=w;
  pool.geo.setDrawRange(0,w);
  pool.geo.attributes.position.needsUpdate=true;pool.geo.attributes.rgba.needsUpdate=true;pool.geo.attributes.size.needsUpdate=true;
}

// ── tracers & beams ──
const TCAP=200;
function makeTracers(){
  const geo=new T.BufferGeometry(),pos=new Float32Array(TCAP*6),col=new Float32Array(TCAP*8);
  geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('color',new T.BufferAttribute(col,4).setUsage(T.DynamicDrawUsage));
  const ls=new T.LineSegments(geo,new T.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  ls.frustumCulled=false;return{ls,geo,pos,col,list:[]};
}
function tracer(x0,y0,z0,x1,y1,z1,col,life){
  const t=G.tr;if(t.list.length>=TCAP)t.list.shift();
  const[r,g,b]=hexRgb(col||'#ffe9a8');t.list.push({a:[x0,z0,y0],b:[x1,z1,y1],r:r/255,g:g/255,b2:b/255,life:life||.07,max:life||.07});
}
function updTracers(dt){
  const t=G.tr;let w=0;
  for(const s of t.list){s.life-=dt;if(s.life<=0)continue;const k=w*6,c=w*8,al=s.life/s.max;
    t.pos.set(s.a,k);t.pos.set(s.b,k+3);t.col[c]=s.r;t.col[c+1]=s.g;t.col[c+2]=s.b2;t.col[c+3]=al*.35;t.col[c+4]=s.r;t.col[c+5]=s.g;t.col[c+6]=s.b2;t.col[c+7]=al;t.list[w++]=s;}
  t.list.length=w;t.geo.setDrawRange(0,w*2);t.geo.attributes.position.needsUpdate=true;t.geo.attributes.color.needsUpdate=true;
}
const BCAP=48;
function makeBeams(){
  const geo=new T.CylinderGeometry(1,1,1,6,1,true);geo.translate(0,.5,0);
  const out=[];for(let i=0;i<BCAP;i++){const m=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#fff',transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false}));m.visible=false;m.frustumCulled=false;G.scene.add(m);out.push({m,life:0,max:1,r:1});}
  return out;
}
function beam(x0,y0,z0,x1,y1,z1,col,radius,life){
  const b=G.beams.find(o=>o.life<=0)||G.beams[0];
  const a=new T.Vector3(x0,z0,y0),c=new T.Vector3(x1,z1,y1),d=c.clone().sub(a),len=d.length();if(len<1)return;
  b.m.position.copy(a);b.m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
  b.m.scale.set(radius,len,radius);b.m.material.color.set(col);b.m.material.opacity=1;b.m.visible=true;b.life=b.max=life||.15;b.r=radius;
}
function updBeams(dt){for(const b of G.beams){if(b.life<=0)continue;b.life-=dt;const t=Math.max(0,b.life/b.max);b.m.material.opacity=t;b.m.scale.x=b.m.scale.z=b.r*(.4+t*.6);if(b.life<=0)b.m.visible=false;}}

// ── zombie models ──
const zMats={};
function zMat(type){
  if(zMats[type.id])return zMats[type.id];
  const ghost=!!type.ghost,op=ghost?{transparent:true,opacity:.55,depthWrite:false}:{};
  const m={
    skin:new T.MeshLambertMaterial(Object.assign({color:type.skin},op)),
    cloth:new T.MeshLambertMaterial(Object.assign({color:type.cloth},op)),
    pants:new T.MeshLambertMaterial(Object.assign({color:type.pants},op)),
    eye:new T.MeshBasicMaterial({color:type.glow||'#ff2200',fog:false}),
    glow:new T.MeshLambertMaterial({color:type.glow||'#ff3300',emissive:type.glow||'#ff3300',emissiveIntensity:.9}),
    armor:new T.MeshLambertMaterial({color:'#3a3f48'}),
    dark:new T.MeshLambertMaterial({color:'#111'}),
  };
  return zMats[type.id]=m;
}
let flashMat=null;
const unitBox=()=>G._ub||(G._ub=new T.BoxGeometry(1,1,1));
function part(parent,mat,w,h,d,x,y,z){const m=new T.Mesh(unitBox(),mat);m.scale.set(w,h,d);m.position.set(x,y,z);parent.add(m);return m;}
function pivot(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}

// Built facing local +X. root.rotation.y = -angle turns it to face (cos a, sin a).
function makeZombie(type){
  const M=zMat(type),H=type.h,bulk=type.bulk||1,thin=type.thin?.75:1;
  const root=new T.Group(),body=pivot(root,0,0,0);
  const P={root,body,meshes:[],type};
  const add=(m)=>{P.meshes.push(m);return m;};
  if(type.crawl){
    const hip=14;
    P.torso=pivot(body,0,hip,0);P.torso.rotation.z=-Math.PI/2+.25;
    add(part(P.torso,M.cloth,16,34,22,0,17,0));
    P.head=pivot(P.torso,0,34,0);add(part(P.head,M.skin,15,15,15,0,7,0));
    add(part(P.head,M.eye,2,3,3,7.6,9,4));add(part(P.head,M.eye,2,3,3,7.6,9,-4));
    P.armL=pivot(body,24,hip+8,10);P.armR=pivot(body,24,hip+8,-10);
    for(const a of[P.armL,P.armR]){a.rotation.z=.75;add(part(a,M.skin,6,30,6,0,-15,0));}
    P.legL=pivot(body,-2,hip,7);P.legR=pivot(body,-2,hip,-7);
    for(const l of[P.legL,P.legR]){l.rotation.z=-1.35;add(part(l,M.pants,8,32,8,0,-16,0));}
    P.headY=22;P.headR=9;P.headX=40;
  }else{
    const legL=H*.46,legW=H*.11*Math.min(bulk,1.3)*thin,torH=H*.32,torW=H*.29*bulk*thin,torD=H*.16*bulk,head=H*.15*(type.boss?.8:1);
    const hip=legL,armL=H*(type.thin?.46:.36),armW=H*.085*bulk*thin;
    P.legL=pivot(body,0,hip,torW*.27);P.legR=pivot(body,0,hip,-torW*.27);
    for(const l of[P.legL,P.legR])add(part(l,M.pants,legW,legL,legW,0,-legL/2,0));
    P.torso=pivot(body,0,hip,0);
    if(type.bloat){const s=new T.Mesh(new T.SphereGeometry(1,12,10),M.cloth);s.scale.set(torD*1.5,torH*.75,torW*.75);s.position.y=torH*.45;P.torso.add(s);add(s);
      for(let i=0;i<6;i++){const p=new T.Mesh(new T.SphereGeometry(1,6,5),M.glow);const a=rnd(0,6.28),b=rnd(-.6,.6);p.scale.setScalar(rnd(3,6));p.position.set(Math.cos(a)*torD*1.3,torH*.45+b*torH*.5,Math.sin(a)*torW*.6);P.torso.add(p);add(p);}}
    else add(part(P.torso,M.cloth,torD,torH,torW,0,torH/2,0));
    if(type.armor||type.armorPlates){add(part(P.torso,M.armor,torD*1.15,torH*.75,torW*1.08,0,torH*.55,0));}
    if(type.glow&&!type.bloat&&!type.ghost&&!type.ranged){for(let i=0;i<4;i++)add(part(P.torso,M.glow,3,3,3,torD/2+1,rnd(.2,.9)*torH,rnd(-.4,.4)*torW));}
    P.head=pivot(P.torso,head*.15,torH,0);
    add(part(P.head,M.skin,head,head,head*.92,0,head/2,0));
    add(part(P.head,M.eye,1.5,head*.13,head*.16,head/2+.4,head*.62,head*.2));
    add(part(P.head,M.eye,1.5,head*.13,head*.16,head/2+.4,head*.62,-head*.2));
    if(type.ranged)add(part(P.head,M.glow,2,head*.22,head*.4,head/2+.6,head*.25,0));
    if(type.id==='screamer')add(part(P.head,M.dark,2,head*.35,head*.32,head/2+.5,head*.25,0));
    if(type.armor)add(part(P.head,M.armor,head*1.18,head*.7,head*1.12,0,head*.75,0));
    if(type.boss){for(let i=0;i<5;i++){const c=new T.Mesh(new T.ConeGeometry(head*.18,head*.7,5),M.glow);c.position.set(-torD*.45,torH*(.35+i*.14),(i%2?1:-1)*torW*.2);c.rotation.z=Math.PI/2+.4;P.torso.add(c);add(c);}
      for(const s of[1,-1]){const c=new T.Mesh(new T.ConeGeometry(head*.14,head*.6,5),M.dark);c.position.set(0,head*1.05,s*head*.3);c.rotation.x=s*.4;P.head.add(c);add(c);}}
    P.armL=pivot(P.torso,0,torH*.9,torW/2+armW/2);P.armR=pivot(P.torso,0,torH*.9,-torW/2-armW/2);
    for(const a of[P.armL,P.armR]){a.rotation.z=type.ranged?.6:1.35;add(part(a,M.skin,armW,armL,armW,0,-armL/2,0));
      if(type.armorPlates)add(part(a,M.armor,armW*1.4,armL*.3,armW*1.4,0,-armL*.1,0));}
    if(type.lean)P.torso.rotation.z=-type.lean;
    P.headY=hip+torH+head*.5;P.headR=head*.62;P.headX=head*.15+(type.lean?Math.sin(type.lean)*torH:0);
  }
  P.meshes.forEach(m=>{m.userData.mat=m.material;});
  return P;
}
function zFlash(P,on){
  if(!flashMat)flashMat=new T.MeshBasicMaterial({color:'#ffd0c0'});
  if(P.flashing===on)return;P.flashing=on;
  for(const m of P.meshes)m.material=on?flashMat:m.userData.mat;
}
// pose a zombie each frame. s = {x,y,a,walk,atk(0-1),dead(0-1),air,dt}
function poseZombie(P,s){
  const r=P.root;r.position.set(s.x,s.air||0,s.y);r.rotation.y=-s.a;
  const sw=Math.sin(s.walk)*.6*(s.moving?1:.15);
  if(P.type.crawl){P.armL.rotation.z=.75+sw*.5;P.armR.rotation.z=.75-sw*.5;P.legL.rotation.z=-1.35+sw*.2;P.legR.rotation.z=-1.35-sw*.2;}
  else{
    P.legL.rotation.z=sw;P.legR.rotation.z=-sw;
    const base=P.type.ranged?.6:1.35,at=s.atk>0?Math.sin(s.atk*Math.PI)*1.2:0;
    P.armL.rotation.z=base+sw*.15-at;P.armR.rotation.z=base-sw*.15-at;
    P.torso.position.y=P.legL.position.y+Math.abs(Math.cos(s.walk))*1.5*(s.moving?1:0);
  }
  if(s.dead>0){const k=Math.min(1,s.dead*2.2);P.body.rotation.z=k*(Math.PI/2*.95);P.body.position.y=k*4-Math.max(0,s.dead-.9)*40;}
  else{P.body.rotation.z=0;P.body.position.y=0;}
  if(P.type.ghost){const o=.35+Math.abs(Math.sin(s.walk*.7))*.3;for(const m of P.meshes)if(m.material.transparent)m.material.opacity=o;}
}

// ── player avatars (remote teammates) ──
function makeAvatar(color){
  const root=new T.Group(),body=pivot(root,0,0,0);
  const vest=new T.MeshLambertMaterial({color}),pants=new T.MeshLambertMaterial({color:'#2a2e26'}),skin=new T.MeshLambertMaterial({color:'#c8a080'}),
    helm=new T.MeshLambertMaterial({color:'#3a4a2a'}),gun=new T.MeshLambertMaterial({color:'#1a1a1a'});
  const P={root,body};
  P.legL=pivot(body,0,34,7);P.legR=pivot(body,0,34,-7);for(const l of[P.legL,P.legR])part(l,pants,10,34,10,0,-17,0);
  P.torso=pivot(body,0,34,0);part(P.torso,vest,14,26,24,0,13,0);
  P.head=pivot(P.torso,0,26,0);part(P.head,skin,11,11,11,0,6,0);part(P.head,helm,13,6,13,0,11,0);
  P.arms=pivot(P.torso,0,22,0);part(P.arms,vest,26,6,6,10,0,9);part(P.arms,vest,26,6,6,10,0,-9);part(P.arms,gun,34,5,4,22,2,0);
  P.flash=new T.Mesh(new T.SphereGeometry(4,6,5),new T.MeshBasicMaterial({color:'#ffcc55',transparent:true,opacity:0,fog:false}));P.flash.position.set(42,2,0);P.arms.add(P.flash);
  return P;
}
function poseAvatar(P,s){
  P.root.position.set(s.x,s.z||0,s.y);P.root.rotation.y=-s.a;
  const sw=Math.sin(s.walk)*.55*(s.moving?1:0);P.legL.rotation.z=sw;P.legR.rotation.z=-sw;
  P.torso.position.y=s.crouch?22:34;P.legL.position.y=P.legR.position.y=s.crouch?22:34;
  P.arms.rotation.z=s.pitch||0;P.head.rotation.z=(s.pitch||0)*.6;
  P.body.rotation.z=s.dead?Math.PI/2*.95:0;
  P.flash.material.opacity=Math.max(0,P.flash.material.opacity-.2);
}

// ── pickups: emoji sprite + glow ──
function makePickup(icon,color,big){
  const g=new T.Group();
  const glow=new T.Sprite(new T.SpriteMaterial({map:glowTex(),color,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.8}));glow.scale.setScalar(big?70:44);g.add(glow);
  const ic=new T.Sprite(new T.SpriteMaterial({map:emojiTex(icon),transparent:true,depthWrite:false}));ic.scale.setScalar(big?34:22);g.add(ic);
  if(big){const b=new T.Mesh(new T.CylinderGeometry(4,10,260,8,1,true),new T.MeshBasicMaterial({color,transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending,fog:false}));b.position.y=110;g.add(b);}
  G.scene.add(g);return g;
}
function projMesh(kind){
  let m;
  if(kind==='gl'){m=new T.Mesh(new T.SphereGeometry(5,8,6),new T.MeshLambertMaterial({color:'#4a5a2a'}));}
  else if(kind==='nade'){m=new T.Mesh(new T.SphereGeometry(4.5,8,6),new T.MeshLambertMaterial({color:'#3a4a2a'}));}
  else if(kind==='rocket'){m=new T.Group();const b=new T.Mesh(new T.CylinderGeometry(3,3,26,8),new T.MeshLambertMaterial({color:'#5a6a3a'}));b.rotation.z=Math.PI/2;m.add(b);const c=new T.Mesh(new T.ConeGeometry(3,8,8),new T.MeshLambertMaterial({color:'#aa3322'}));c.rotation.z=-Math.PI/2;c.position.x=17;m.add(c);}
  else{m=new T.Mesh(new T.SphereGeometry(6,8,6),new T.MeshBasicMaterial({color:'#aaff22'}));}
  G.scene.add(m);return m;
}
function remove(o){if(o){G.scene.remove(o);}}

// ── frame ──
function setView(x,y,eye,yaw,pitch,fovH,roll){
  const c=G.camera;c.position.set(x,eye,y);c.rotation.set(pitch,-yaw-Math.PI/2,roll||0,'YXZ');
  const asp=G.renderer.domElement.width/G.renderer.domElement.height;
  const v=2*Math.atan(Math.tan(fovH*Math.PI/360)/asp)*180/Math.PI;
  if(Math.abs(c.fov-v)>.01||Math.abs(c.aspect-asp)>1e-3){c.fov=v;c.aspect=asp;c.updateProjectionMatrix();}
  G.fovV=v;
  G.sky.position.copy(c.position);
  // flashlight sits just below/right of the eye and points where we look
  const fx=Math.cos(yaw),fy=Math.sin(yaw),cp=Math.cos(pitch);
  G.flash.position.set(x+Math.cos(yaw+1.57)*6,eye-6,y+Math.sin(yaw+1.57)*6);
  G.flash.target.position.set(x+fx*cp*300,eye+Math.sin(pitch)*300,y+fy*cp*300);
  G.flash.intensity=G.flashOn?3.2:0;
  G.sun.position.set(x+600,1200,y+400);G.sun.target.position.set(x,0,y);
  const h=G.renderer.domElement.height,sc=h/(2*Math.tan(v*Math.PI/360));
  G.pnorm.mat.uniforms.scale.value=sc;G.padd.mat.uniforms.scale.value=sc;
}
function frame(dt,t){
  updPool(G.pnorm,dt);updPool(G.padd,dt);updTracers(dt);updBeams(dt);
  G.muzzle.intensity=Math.max(0,G.muzzle.intensity-dt*40);
  G.boom.intensity=Math.max(0,G.boom.intensity-dt*18);
  if(G.level){
    for(const l of G.level.lava){l.offset.x=t*.02;l.offset.y=Math.sin(t*.3)*.05;}
    for(const w of G.level.water){w.offset.x=t*.01;w.offset.y=t*.006;}
    if(G.fireAt){G.fire.position.set(G.fireAt.x,40,G.fireAt.y);G.fire.intensity=2.2+Math.sin(t*13)*.4+Math.sin(t*7.3)*.3;if(Math.random()<.5)emit('fire',G.fireAt.x,G.fireAt.y,8,1,{spread:10});}
  }
}
function ambient(dt,x,y){
  const k=G.ambKind;if(!k||k==='none')return;
  const rate={snow:60,rain:120,ember:10,dust:4,spores:8,fireflies:4,sand:25,mist:1.2}[k]||0;
  G.ambT+=dt*rate;
  while(G.ambT>=1){G.ambT--;const a=rnd(0,6.28),d=rnd(40,700);const z=k==='snow'||k==='rain'?rnd(150,320):k==='mist'?rnd(10,60):rnd(5,160);emit(k,x+Math.cos(a)*d,y+Math.sin(a)*d,z,1);}
}
function muzzleFlash(x,y,z,col){G.muzzle.color.set(col||'#ffaa55');G.muzzle.position.set(x,z,y);G.muzzle.intensity=3.5;}
function explosionLight(x,y,z){G.boom.position.set(x,z+30,y);G.boom.intensity=9;}
function render(){
  const r=G.renderer;r.clear();r.render(G.scene,G.camera);
}
const _v=()=>G._pv||(G._pv=new T.Vector3());
function toScreen(x,y,h){
  const v=_v();v.set(x,h,y);v.project(G.camera);
  const c=G.renderer.domElement,cw=c.clientWidth,ch=c.clientHeight;
  return{x:(v.x*.5+.5)*cw,y:(-v.y*.5+.5)*ch,on:v.z<1&&v.z>-1&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2};
}
function resize(w,h){if(!G.renderer)return;G.renderer.setSize(w,h,false);}
function setQuality(q){G.quality=q;if(!G.renderer)return;G.renderer.setPixelRatio(q==='low'?.7:q==='high'?Math.min(2,window.devicePixelRatio||1):Math.min(1.25,window.devicePixelRatio||1));resize(window.innerWidth,window.innerHeight);}

function init(canvas,quality){
  T=global.THREE;G.quality=quality||'medium';
  const r=new T.WebGLRenderer({canvas,antialias:G.quality!=='low',powerPreference:'high-performance'});
  r.outputColorSpace=T.SRGBColorSpace;r.autoClear=false;
  G.renderer=r;setQuality(G.quality);
  const s=new T.Scene();G.scene=s;
  G.camera=new T.PerspectiveCamera(70,canvas.width/canvas.height,2,7000);G.camera.rotation.order='YXZ';
  // persistent lights (only intensity changes after this point)
  G.hemi=new T.HemisphereLight('#ffffff','#333333',1);s.add(G.hemi);
  G.sun=new T.DirectionalLight('#ffffff',1);s.add(G.sun);s.add(G.sun.target);
  G.flash=new T.SpotLight('#fff3dc',0,1500,.42,.5,0);s.add(G.flash);s.add(G.flash.target);
  G.muzzle=new T.PointLight('#ffaa55',0,520,0);s.add(G.muzzle);
  G.boom=new T.PointLight('#ff8833',0,1000,0);s.add(G.boom);
  G.fire=new T.PointLight('#ff8833',0,900,0);s.add(G.fire);
  // sky dome (moves with the camera, so the horizon tilts correctly when looking up/down)
  G.sky=new T.Mesh(new T.SphereGeometry(5000,24,14),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new T.Color('#1b2a4a')},bot:{value:new T.Color('#c98a5a')}},
    vertexShader:'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top;uniform vec3 bot;varying float h;void main(){float t=clamp(h*1.6+.15,0.,1.);gl_FragColor=vec4(mix(bot,top,t),1.);}'}));
  G.sky.renderOrder=-1;G.sky.frustumCulled=false;s.add(G.sky);
  G.pnorm=makePool(false);G.padd=makePool(true);s.add(G.pnorm.pts);s.add(G.padd.pts);
  G.tr=makeTracers();s.add(G.tr.ls);
  G.beams=makeBeams();
  G.ready=true;
}

Object.assign(G,{init,buildLevel,clearLevel,emit,tracer,beam,makeZombie,poseZombie,zFlash,makeAvatar,poseAvatar,makePickup,projMesh,remove,
  setView,frame,ambient,render,toScreen,resize,setQuality,muzzleFlash,explosionLight,tex,glowTex});
global.GFX=G;
})(window);
