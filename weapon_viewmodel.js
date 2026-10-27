// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Weapon Viewmodel (3D)
//  Renders the first-person gun into the main WebGL renderer
//  (second pass over the world). Uses the real .glb models
//  from gun_models_3d/ when the page is served over http(s),
//  and procedural low-poly models for every other gun (and
//  as a fallback when opened straight from disk).
//
//  ── TUNING ──
//  If a .glb gun looks rotated wrong / too big / off-center,
//  tweak its WEAPON_CONFIG entry:
//    extraRotY / extraRotX / extraRotZ  -> radians
//    scaleMul -> multiply the auto scale
//    offset   -> {x,y,z} nudge in viewmodel space
//  DEBUG: press "[" / "]" to yaw the current model 90°,
//  "-" / "=" to pitch it; values are logged to the console.
// ═══════════════════════════════════════════════════════
(function(global){
'use strict';
let T,scene,camera,rig,holder,flash,flashLight,laser;
const MODEL_DIR='gun_models_3d/';
const WEAPON_CONFIG={pistol:{},revolver:{},smg:{},ar:{},burstRifle:{},shotgun:{},combatSG:{},sniper:{},lmg:{},plasma:{}};
const TARGET_LENGTH=.95;
const VM_LEN={Sidearm:.5,SMG:.66,Rifle:.86,Marksman:1,Shotgun:.88,Heavy:.95,Special:.85,Explosive:.95,Energy:.88};
const vmLen=id=>VM_LEN[DZ.WEAPONS[id].cat]||TARGET_LENGTH;
const BASE_POS={x:.42,y:-.38,z:-1.0},BASE_ROT={x:.02,y:-.16,z:0};
const glbTpl={},procTpl={},instCache={};
let cur=null,curKey='',visible=false;
const S={rz:0,rv:0,rx:0,rr:0,swx:0,swy:0,flashT:0,flashCol:'#ffaa44',spin:0};

// ── materials ──
const matC={};
function mat(color,o){
  const k=color+JSON.stringify(o||{});if(matC[k])return matC[k];
  return matC[k]=new T.MeshStandardMaterial(Object.assign({color,roughness:.55,metalness:.35},o||{}));
}
function glowMat(c){return mat(c,{emissive:c,emissiveIntensity:1.4,roughness:.3,metalness:0});}

// ── procedural gun builder (barrel points to -Z) ──
function bx(g,m,w,h,d,x,y,z,rx){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(rx)o.rotation.x=rx;g.add(o);return o;}
function cy(g,m,r,l,x,y,z,axis,seg){const o=new T.Mesh(new T.CylinderGeometry(r,r,l,seg||12),m);o.position.set(x,y,z);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;g.add(o);return o;}
function optic(g,kind,top,zc){
  const dark=mat('#16171a'),metal=mat('#3a3d42');
  if(kind==='reddot'){bx(g,dark,2.6,2.6,4.5,0,top+1.5,zc);bx(g,glowMat('#ff2222'),.6,.6,.2,0,top+1.7,zc-2.3);}
  else if(kind==='acog'){bx(g,metal,1.6,1.2,6,0,top+.6,zc);cy(g,dark,1.9,9,0,top+2.6,zc,'z');cy(g,mat('#335577',{metalness:.9,roughness:.1}),1.5,.2,0,top+2.6,zc-4.6,'z');}
  else if(kind==='sniper'){bx(g,metal,1.4,1.4,10,0,top+.7,zc);cy(g,dark,1.8,22,0,top+3,zc,'z');cy(g,dark,2.6,3.5,0,top+3,zc-11,'z');cy(g,dark,2.4,3,0,top+3,zc+10.5,'z');
    cy(g,mat('#224466',{metalness:.9,roughness:.1}),2.2,.2,0,top+3,zc-12.8,'z');}
}
function buildProc(id){
  const W=DZ.WEAPONS[id],p=W.proc||{kind:'rifle'},g=new T.Group();
  const body=mat(W.color),dark=mat('#1c1d20'),metal=mat('#5a5e64',{metalness:.7,roughness:.35}),wood=mat('#6b4423',{metalness:0,roughness:.8});
  const stockM=p.wood?wood:dark;let muzzleZ=-20,top=3;
  switch(p.kind){
    case'pistol':{const c=p.chunky?1.25:1;bx(g,body,3*c,3.2*c,18*c,0,1.6*c,-8*c);bx(g,dark,2.8*c,1.8*c,14*c,0,-.6*c,-7*c);
      bx(g,dark,2.8*c,9,4.2*c,0,-5,0,.22);cy(g,metal,.7*c,2,0,1.8*c,-18*c,'z');bx(g,dark,.6,.8,.8,0,3.6*c,-16*c);bx(g,dark,1.6,.8,.8,0,3.6*c,0);muzzleZ=-19*c;top=3.4*c;break;}
    case'revolver':{cy(g,metal,1.1,15,0,1.2,-12,'z');cy(g,body,2.7,5,0,.6,-2.5,'z',8);bx(g,body,2.6,3.6,8,0,.4,0);bx(g,wood,2.6,9,4.2,0,-5.2,3,.3);bx(g,dark,.8,1.6,1.4,0,2.8,3);muzzleZ=-19.5;top=2.6;break;}
    case'smg':{const L=p.compact?16:22;bx(g,body,3.4,4.6,L,0,0,-L/2+4);cy(g,metal,.8,6,0,.4,-L+1,'z');bx(g,dark,2.4,p.compact?12:11,3,0,-7,p.compact?1:-L/2+3,p.compact?.1:.15);
      bx(g,dark,2.6,7,3.6,0,-5,3,.3);if(!p.compact){bx(g,dark,1,4,1,0,-.5,10);bx(g,dark,1,1,8,0,-2,12);}bx(g,dark,1,1.2,14,0,2.8,-L/2+4);muzzleZ=-L-2;top=3.4;break;}
    case'rifle':{const BL=p.longBarrel?24:15;bx(g,body,3.6,5,26,0,0,-4);bx(g,p.wood?wood:body,4,4.2,17,0,.2,-24);cy(g,metal,.8,BL,0,.8,-32-BL/2+6,'z');
      bx(g,stockM,3.4,6,16,0,-1,16);bx(g,dark,3.6,8,2,0,-2,24);bx(g,dark,2.6,7.5,3.6,0,-5.5,4,.3);
      const mg=bx(g,dark,2.8,11,5,0,-7,-9,p.curvedMag?.3:.12);if(p.curvedMag)mg.position.z=-8;
      bx(g,dark,1.4,1.2,24,0,3.1,-6);if(!p.optic){bx(g,dark,.8,2,1,0,4.2,-32);bx(g,dark,1.6,1.6,1.4,0,4.2,6);}
      muzzleZ=-32-BL+6;top=3.7;if(p.optic)optic(g,p.optic,3.7,-6);break;}
    case'sniper':{const BL=p.heavy?46:40;bx(g,body,3.8,4.6,26,0,0,-2);cy(g,metal,p.heavy?1.3:1,BL,0,.8,-15-BL/2,'z');if(p.heavy)bx(g,dark,3.2,2.4,5,0,.8,-15-BL);
      bx(g,stockM,3.6,7.5,22,0,-1.5,20);bx(g,dark,3.6,3,8,0,2.6,18);bx(g,dark,2.6,7.5,3.6,0,-5.5,6,.3);bx(g,dark,2.6,6,5,0,-5,-6);
      cy(g,metal,.5,4,2.6,.6,5,'x');bx(g,dark,.8,8,.8,1.4,-4,-30,.5);bx(g,dark,.8,8,.8,-1.4,-4,-30,.5);
      optic(g,'sniper',2.4,-3);muzzleZ=-15-BL-(p.heavy?3:0);top=2.4;break;}
    case'shotgun':{if(p.double){cy(g,metal,1.25,34,-1.3,1.2,-22,'z');cy(g,metal,1.25,34,1.3,1.2,-22,'z');bx(g,wood,3.8,3,12,0,-.8,-12);}
      else{cy(g,metal,1.3,34,0,1.6,-22,'z');cy(g,dark,1.05,28,0,-.9,-19,'z');bx(g,p.wood?wood:dark,4,3.6,10,0,-.9,-20);}
      bx(g,body,3.6,5,14,0,0,0);bx(g,stockM,3.4,6.5,18,0,-2,15,-.08);bx(g,dark,2.6,7,3.6,0,-5.2,5,.3);
      if(p.drum)cy(g,dark,5.2,3.6,0,-7,-6,'x',16);bx(g,dark,.8,.9,.9,0,3.2,-37);muzzleZ=-39;top=3;break;}
    case'lmg':{bx(g,body,4.6,6,30,0,0,-4);cy(g,metal,1.1,28,0,.8,-32,'z');bx(g,dark,4.4,4.6,16,0,.8,-24);
      for(let i=0;i<5;i++)bx(g,dark,4.8,.5,1,0,3.4,-30+i*3);bx(g,dark,5.4,6.5,8,-4.5,-4,-8);bx(g,dark,1.2,3.5,8,0,5,-8);
      bx(g,dark,3.6,6.5,16,0,-1,16);bx(g,dark,2.6,7.5,3.6,0,-5.8,6,.3);bx(g,dark,.8,9,.8,1.6,-4,-40,.6);bx(g,dark,.8,9,.8,-1.6,-4,-40,.6);muzzleZ=-46;top=4.5;break;}
    case'minigun':{const sp=new T.Group();sp.name='spin';sp.position.set(0,0,-18);g.add(sp);
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2;cy(sp,metal,.7,40,Math.cos(a)*2.2,Math.sin(a)*2.2,-14,'z',8);}
      cy(sp,dark,3.6,2,0,0,-28,'z');cy(sp,dark,3.6,2,0,0,-6,'z');
      bx(g,body,7,7,16,0,0,0);bx(g,dark,1.6,6,14,0,6,2);bx(g,dark,6,6,9,-6,-3,0);bx(g,dark,2.6,7,3.6,0,-6,6,.3);muzzleZ=-52;top=4;break;}
    case'flamer':{cy(g,mat('#aa3311'),3.6,15,0,-7,-2,null,14);cy(g,metal,1.4,26,0,1,-22,'z');cy(g,dark,2,10,0,1,-14,'z');
      bx(g,body,3.8,5,16,0,1,2);bx(g,dark,2.6,7,3.6,0,-4,6,.3);bx(g,dark,3,5,12,0,0,16);
      const pl=new T.Mesh(new T.SphereGeometry(.6,8,6),glowMat('#55aaff'));pl.position.set(0,-.6,-35);g.add(pl);muzzleZ=-36;top=3.5;break;}
    case'gl':{cy(g,dark,4.6,9,0,0,-4,'z',10);for(let i=0;i<6;i++){const a=i/6*Math.PI*2;cy(g,metal,1.2,9.2,Math.cos(a)*2.8,Math.sin(a)*2.8,-4,'z',8);}
      cy(g,body,2.4,16,0,1,-17,'z');bx(g,dark,3,3,8,0,-3.5,-16);bx(g,dark,2.6,7,3.6,0,-6,4,.3);bx(g,body,3.4,5.5,14,0,-1,12);muzzleZ=-26;top=4.5;break;}
    case'rpg':{cy(g,body,3.6,70,0,0,-6,'z',14);cy(g,mat('#5a6a3a'),2.4,10,0,0,-44,'z');const c=new T.Mesh(new T.ConeGeometry(4.2,12,12),mat('#7a8a4a'));c.rotation.x=-Math.PI/2;c.position.set(0,0,-55);g.add(c);
      bx(g,dark,2.6,8,3.6,0,-7,-2,.25);bx(g,dark,2.6,8,3.6,0,-7,-16,.15);bx(g,dark,3,3,9,3.6,2,-8);muzzleZ=-62;top=3.8;break;}
    case'energy':{const gl=glowMat(p.glow||'#ff44ff');bx(g,body,4,5.4,30,0,0,-8);bx(g,dark,4.4,3,24,0,-1.8,-8);bx(g,gl,4.5,.6,22,0,1.2,-9);
      for(let i=0;i<4;i++){const t=new T.Mesh(new T.TorusGeometry(1.6,.45,6,14),gl);t.position.set(0,.6,-26-i*2.6);g.add(t);}cy(g,metal,.9,12,0,.6,-30,'z');
      bx(g,dark,2.6,7.5,3.6,0,-5.5,2,.3);bx(g,body,3.6,6,14,0,-.5,14);muzzleZ=-37;top=2.8;break;}
    case'tesla':{const gl=glowMat(p.glow||'#33ccff'),cu=mat('#b86a2a',{metalness:.8,roughness:.3});bx(g,body,4,5,22,0,0,-2);
      for(let i=0;i<3;i++){const t=new T.Mesh(new T.TorusGeometry(2.4,.8,8,16),cu);t.position.set(0,.8,-15-i*4);g.add(t);}
      cy(g,mat('#88ccff',{transparent:true,opacity:.45}),1.4,16,0,.8,-19,'z');const orb=new T.Mesh(new T.SphereGeometry(2.4,12,10),gl);orb.position.set(0,.8,-29);g.add(orb);
      bx(g,dark,2.6,7.5,3.6,0,-5.5,4,.3);bx(g,dark,3.4,5.5,12,0,-.5,12);muzzleZ=-31;top=3;break;}
    case'rail':{const gl=glowMat(p.glow||'#00ffcc');bx(g,metal,1.2,1.6,46,-2.2,0,-24);bx(g,metal,1.2,1.6,46,2.2,0,-24);cy(g,gl,.7,44,0,0,-24,'z');
      bx(g,body,5.6,6,22,0,-.5,4);bx(g,gl,5.8,.6,16,0,1.5,4);bx(g,dark,2.6,7.5,3.6,0,-6,8,.3);bx(g,dark,3.6,6,14,0,-1,20);optic(g,'acog',2.6,0);muzzleZ=-48;top=2.6;break;}
    default:bx(g,body,3.6,5,30,0,0,-6);muzzleZ=-22;
  }
  return finish(g,muzzleZ,top,true,vmLen(id));
}
// Scale a group so its length is TARGET_LENGTH and remember where the muzzle and sight line are.
function finish(g,muzzleZ,top,proc,len){
  const box=new T.Box3().setFromObject(g),size=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3());
  const s=(len||TARGET_LENGTH)/Math.max(size.z,size.x,size.y,1e-6);
  const w=new T.Group();g.position.set(-c.x,-c.y,-c.z);w.add(g);w.scale.setScalar(s);
  w.userData={muzzle:new T.Vector3(0,(top*.4-c.y)*s,((muzzleZ!=null?muzzleZ:box.min.z)-c.z)*s),top:(proc?(box.max.y-c.y):(size.y/2))*s,len:size.z*s,proc};
  return w;
}

// ── .glb loading (only works over http/https) ──
function loadGLBs(){
  if(location.protocol==='file:'||!global.GLTFLoader)return;
  const loader=new global.GLTFLoader();
  for(const id in DZ.WEAPONS){
    const f=DZ.WEAPONS[id].model;if(!f)continue;
    loader.load(encodeURI(MODEL_DIR+f),gl=>{glbTpl[id]=normalizeGLB(gl.scene,id);for(const k in instCache)if(k.startsWith(id+'|'))delete instCache[k];if(cur&&curKey.startsWith(id+'|'))curKey='';},
      undefined,()=>{console.warn('WeaponVM: using procedural model for',id);});
  }
}
function normalizeGLB(obj,id){
  const box=new T.Box3().setFromObject(obj),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const inner=new T.Group();obj.position.sub(center);inner.add(obj);
  const dims=[size.x,size.y,size.z],mi=dims.indexOf(Math.max(...dims));
  if(mi===0)inner.rotation.y=Math.PI/2;else if(mi===1)inner.rotation.x=-Math.PI/2;
  // Model files don't agree on which way is "forward" or "up", so look at the shape:
  // the muzzle end is the thin one, and the long flat run (slide / barrel) is on top.
  inner.updateMatrixWorld(true);
  const P=[],v=new T.Vector3();
  inner.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position,st=Math.max(1,Math.floor(a.count/2000));for(let i=0;i<a.count;i+=st){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);P.push([v.x,v.y,v.z]);}});
  const rng=(f,k)=>{let lo=1e9,hi=-1e9;for(const p of P)if(f(p)){lo=Math.min(lo,p[k]);hi=Math.max(hi,p[k]);}return hi>lo?hi-lo:0;};
  const ext=k=>{let lo=1e9,hi=-1e9;for(const p of P){lo=Math.min(lo,p[k]);hi=Math.max(hi,p[k]);}return[lo,hi];};
  let[z0,z1]=ext(2),Lz=z1-z0;
  const yaw=new T.Group(),roll=new T.Group();yaw.add(inner);roll.add(yaw);
  if(P.length&&rng(p=>p[2]<z0+Lz*.12,1)>rng(p=>p[2]>z1-Lz*.12,1)*1.15){yaw.rotation.y=Math.PI;for(const p of P){p[0]=-p[0];p[2]=-p[2];}}
  const[y0,y1]=ext(1),Hy=y1-y0;
  if(P.length&&rng(p=>p[1]<y0+Hy*.15,2)>rng(p=>p[1]>y1-Hy*.15,2)*1.15){roll.rotation.z=Math.PI;for(const p of P){p[0]=-p[0];p[1]=-p[1];}}
  [z0,z1]=ext(2);Lz=z1-z0;
  let my=0,mn=0;for(const p of P)if(p[2]<z0+Lz*.08){my+=p[1];mn++;}my=mn?my/mn:0;
  const s=vmLen(id)/Math.max(dims[mi],1e-6);
  const w=new T.Group();w.add(roll);w.scale.setScalar(s);
  const cfg=WEAPON_CONFIG[id]||{};
  if(cfg.extraRotY)w.rotation.y+=cfg.extraRotY;if(cfg.extraRotX)w.rotation.x+=cfg.extraRotX;if(cfg.extraRotZ)w.rotation.z+=cfg.extraRotZ;
  if(cfg.scaleMul)w.scale.multiplyScalar(cfg.scaleMul);if(cfg.offset)w.position.set(cfg.offset.x||0,cfg.offset.y||0,cfg.offset.z||0);
  const b2=new T.Box3().setFromObject(w);
  w.userData={muzzle:new T.Vector3(0,my*s,b2.min.z),top:b2.max.y,len:b2.max.z-b2.min.z,proc:false};
  return w;
}
function template(id){return glbTpl[id]||procTpl[id]||(procTpl[id]=buildProc(id));}
// instance = template + tier tint + optional optic/laser attachments
function instance(id,tier,opt,las){
  const key=id+'|'+(tier||0)+'|'+(opt||'')+'|'+(las?1:0);
  if(instCache[key])return instCache[key];
  const tpl=template(id),inst=tpl.clone(true);inst.userData=Object.assign({},tpl.userData);
  const tint=DZ.TIERS[tier||0]&&DZ.TIERS[tier||0].tint;
  if(tint)inst.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.emissive){o.material.emissive.set(tint);o.material.emissiveIntensity=.28;}if(o.material.color)o.material.color.lerp(new T.Color(tint),.35);}});
  if(opt){const og=new T.Group(),u=inst.userData,s=TARGET_LENGTH/40;og.scale.setScalar(s);og.position.set(0,u.top,-u.len*.05);optic(og,opt,0,0);inst.add(og);inst.userData.top=u.top+3.6*s;inst.userData.opt=opt;}
  if(las){const s=TARGET_LENGTH/40,lg=new T.Group();lg.scale.setScalar(s);lg.position.set(.05,0,inst.userData.muzzle.z*.55);
    bx(lg,mat('#222'),1.6,1.6,4,0,0,0);const beamM=new T.MeshBasicMaterial({color:'#ff2020',transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false});
    const b=new T.Mesh(new T.CylinderGeometry(.12,.12,300,4),beamM);b.rotation.x=Math.PI/2;b.position.z=-152;lg.add(b);inst.add(lg);}
  return instCache[key]=inst;
}

// ── public API ──
const VM={
  ready:false,
  init(){
    T=global.THREE;
    scene=new T.Scene();camera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.01,30);
    scene.add(new T.AmbientLight('#ffffff',1.6));
    const key=new T.DirectionalLight('#ffffff',2.4);key.position.set(.6,1,.8);scene.add(key);
    const fill=new T.DirectionalLight('#8899ff',.9);fill.position.set(-.8,-.4,.6);scene.add(fill);
    flashLight=new T.PointLight('#ffaa55',0,4,0);scene.add(flashLight);
    flash=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#ffaa55',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,map:GFX.glowTex()}));
    scene.add(flash);
    rig=new T.Group();scene.add(rig);holder=new T.Group();rig.add(holder);
    loadGLBs();VM.ready=true;
    global.addEventListener('keydown',onDebugKey);
  },
  resize(w,h){if(camera){camera.aspect=w/h;camera.updateProjectionMatrix();}},
  setVisible(v){visible=!!v;},
  onFire(w){
    S.flashCol=w.special==='plasma'?'#ff66ff':w.special==='tesla'||w.special==='rail'?'#66ddff':w.special==='flame'?'#ff6600':'#ffaa44';
    S.flashT=w.special==='flame'?.03:.06;
    const k=Math.min(.16,.02+(w.rec||3)*.011);S.rv+=k*6;
    S.rx-=Math.min(.24,.025+(w.rec||3)*.012);S.rr+=(Math.random()-.5)*.05;
  },
  // s: {id,tier,optic,laser,bob,bobAmt,sprint,crouch,adsF,reloadP,switchP,meleeP,spin,mdx,mdy,hide,visible}
  update(dt,s){
    if(!VM.ready)return;dt=Math.min(dt||0,.1);
    visible=!!s.visible&&!s.hide;
    const key=s.id+'|'+(s.tier||0)+'|'+(s.optic||'')+'|'+(s.laser?1:0);
    if(key!==curKey&&s.id){curKey=key;while(holder.children.length)holder.remove(holder.children[0]);cur=instance(s.id,s.tier,s.optic,s.laser);holder.add(cur);}
    if(!cur)return;
    const u=cur.userData,a=Math.max(0,Math.min(1,s.adsF==null?1:s.adsF));
    // aim-down-sights pose lines the sight up with the screen centre
    const ads={x:0,y:-u.top-.012,z:-.62};
    const bobY=Math.sin(s.bob||0)*(s.bobAmt||0)*.03*(s.crouch?2.5:3.5)*(.25+.75*a);
    const bobX=Math.cos((s.bob||0)*.5)*(s.bobAmt||0)*.03*2.6*(.25+.75*a);
    S.swx+=((-(s.mdx||0)*.0009)-S.swx)*Math.min(1,dt*9);S.swy+=(((s.mdy||0)*.0009)-S.swy)*Math.min(1,dt*9);
    S.swx=Math.max(-.08,Math.min(.08,S.swx));S.swy=Math.max(-.06,Math.min(.06,S.swy));
    const spr=s.sprint?1:0;S.sp=(S.sp||0)+(spr-(S.sp||0))*Math.min(1,dt*8);
    let rp=0,rd=0;if(s.reloadP>0&&s.reloadP<1){const q=Math.sin(s.reloadP*Math.PI);rp=q*.55;rd=q*.2;}
    const sw=1-(s.switchP==null?1:s.switchP);
    const ml=s.meleeP>0?Math.sin(s.meleeP*Math.PI):0;
    S.rv-=S.rv*Math.min(1,dt*14);S.rz+=S.rv*dt;S.rz*=Math.max(0,1-dt*10);S.rx*=Math.max(0,1-dt*9);S.rr*=Math.max(0,1-dt*9);
    const L=(p,q)=>p+(q-p)*a;
    rig.position.set(L(ads.x,BASE_POS.x)+bobX+S.swx*a+ml*.25,L(ads.y,BASE_POS.y)-bobY+S.swy*a-rd-sw*.55-S.sp*.12+(s.crouch?.03:0),L(ads.z,BASE_POS.z)+S.rz);
    rig.rotation.set(L(0,BASE_ROT.x)+S.rx-S.sp*.25-sw*.6,L(0,BASE_ROT.y)+S.sp*.55+ml*.6,L(0,BASE_ROT.z)+rp+S.rr-ml*.9);
    const spinG=cur.getObjectByName('spin');if(spinG){S.spin+=(s.spin||0)*dt*45;spinG.rotation.z=S.spin;}
    // muzzle flash at the gun tip
    S.flashT=Math.max(0,S.flashT-dt);const fi=S.flashT>0?Math.min(1,S.flashT/.06):0;
    const tip=cur.localToWorld(u.muzzle.clone());
    flash.position.copy(tip);flash.lookAt(camera.position);flash.material.color.set(S.flashCol);flash.material.opacity=fi*.95;
    const fs=.18+fi*.14;flash.scale.set(fs,fs,1);flash.rotation.z=Math.random()*6;
    flashLight.position.copy(tip);flashLight.color.set(S.flashCol);flashLight.intensity=fi*6;
  },
  render(renderer){
    if(!VM.ready||!visible||!cur)return;
    renderer.clearDepth();renderer.render(scene,camera);
  },
  mountShopPreviews(){
    document.querySelectorAll('.gun-preview[data-weapon]').forEach(el=>{if(el._gp)return;el._gp=true;addPreview(el);});
    startPreviews();
  },
};

function onDebugKey(e){
  if(!cur||!cur.children[0])return;const inst=cur.children[0];let ch=false;
  if(e.code==='BracketRight'){inst.rotation.y+=Math.PI/2;ch=true;}if(e.code==='BracketLeft'){inst.rotation.y-=Math.PI/2;ch=true;}
  if(e.code==='Equal'){inst.rotation.x+=Math.PI/18;ch=true;}if(e.code==='Minus'){inst.rotation.x-=Math.PI/18;ch=true;}
  if(ch)console.log(`[WeaponVM] ${curKey} -> extraRotY: ${inst.rotation.y.toFixed(3)}, extraRotX: ${inst.rotation.x.toFixed(3)}`);
}

// ── shop previews: ONE shared offscreen renderer, blitted into per-tile 2D canvases
// (one WebGL context per tile would blow the browser's context limit) ──
let pr=null,prRAF=0;const previews=[];
function addPreview(el){
  if(!VM.ready)return;
  const id=el.dataset.weapon,w=el.clientWidth||160,h=el.clientHeight||110,dpr=Math.min(devicePixelRatio||1,1.5);
  const cv=document.createElement('canvas');cv.style.width='100%';cv.style.height='100%';cv.width=Math.max(1,w*dpr|0);cv.height=Math.max(1,h*dpr|0);el.appendChild(cv);
  const sc=new T.Scene(),cam=new T.PerspectiveCamera(36,w/h,.01,20);cam.position.set(0,0,1.75);
  sc.add(new T.AmbientLight('#ffffff',1.8));const dl=new T.DirectionalLight('#ffffff',2.4);dl.position.set(1,1.2,1.5);sc.add(dl);
  const g=new T.Group();sc.add(g);const inst=template(id).clone(true);inst.rotation.y=Math.PI*.5;g.add(inst);
  previews.push({el,cv,cx:cv.getContext('2d'),sc,cam,g});
}
function startPreviews(){
  if(prRAF||!VM.ready)return;
  if(!pr){pr=new T.WebGLRenderer({alpha:true,antialias:true});pr.outputColorSpace=T.SRGBColorSpace;}
  const dpr=Math.min(devicePixelRatio||1,1.5);
  const frame=()=>{
    for(let i=previews.length-1;i>=0;i--)if(!previews[i].el.isConnected)previews.splice(i,1);
    if(!previews.length){prRAF=0;return;}
    for(const p of previews){
      if(p.el.offsetParent===null)continue;
      const w=p.el.clientWidth||160,h=p.el.clientHeight||110,bw=Math.max(1,w*dpr|0),bh=Math.max(1,h*dpr|0);
      if(p.cv.width!==bw||p.cv.height!==bh){p.cv.width=bw;p.cv.height=bh;}
      if(Math.abs(p.cam.aspect-w/h)>1e-3){p.cam.aspect=w/h;p.cam.updateProjectionMatrix();}
      p.g.rotation.y+=.012;pr.setPixelRatio(dpr);pr.setSize(w,h,false);pr.render(p.sc,p.cam);
      p.cx.clearRect(0,0,bw,bh);p.cx.drawImage(pr.domElement,0,0,bw,bh);
    }
    prRAF=requestAnimationFrame(frame);
  };
  prRAF=requestAnimationFrame(frame);
}

VM.template=template; // handy for debugging models from the console
global.WeaponVM=VM;
})(window);
