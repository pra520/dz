// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Collision & pathfinding
//  · Circle-vs-box collision that pushes things OUT of walls
//    (zombies and players slide along walls, never sink into them)
//  · Grid flow fields (BFS from every player) so zombies route
//    around buildings instead of grinding against them
//  · 3D ray-vs-box for bullets
// ═══════════════════════════════════════════════════════
(function(global){
'use strict';

const CELL=40;
const REACH=70;               // broadphase margin, must exceed the largest radius
const CLASS_R=[22,32,52];     // clearance needed per zombie size class
const INF=65535;
const SHOOT_THROUGH=new Set(['fence','water']);

const N={B:3200,cols:0,rows:0,walls:[],hazards:[],cells:null,clear:null,free:[],field:[],queue:null,spawns:[]};

function cellOf(x,y){
  const cx=Math.max(0,Math.min(N.cols-1,Math.floor(x/CELL))),cy=Math.max(0,Math.min(N.rows-1,Math.floor(y/CELL)));
  return cy*N.cols+cx;
}

function load(map){
  N.B=map.B;N.walls=map.walls;N.hazards=map.hazards||[];
  N.cols=N.rows=Math.ceil(map.B/CELL);
  const n=N.cols*N.rows;
  N.cells=Array.from({length:n},()=>[]);
  N.walls.forEach((w,i)=>{
    const x0=Math.max(0,Math.floor((w.x-REACH)/CELL)),x1=Math.min(N.cols-1,Math.floor((w.x+w.w+REACH)/CELL));
    const y0=Math.max(0,Math.floor((w.y-REACH)/CELL)),y1=Math.min(N.rows-1,Math.floor((w.y+w.h+REACH)/CELL));
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++)N.cells[cy*N.cols+cx].push(w);
  });
  // clearance = distance from each cell centre to the nearest wall
  N.clear=new Float32Array(n);
  for(let i=0;i<n;i++){
    const px=(i%N.cols+.5)*CELL,py=(Math.floor(i/N.cols)+.5)*CELL;
    let best=999;
    for(const w of N.cells[i]){
      const dx=Math.max(w.x-px,0,px-(w.x+w.w)),dy=Math.max(w.y-py,0,py-(w.y+w.h));
      const d=Math.hypot(dx,dy);if(d<best)best=d;
    }
    N.clear[i]=best;
  }
  N.free=CLASS_R.map(r=>{const f=new Uint8Array(n);for(let i=0;i<n;i++)f[i]=N.clear[i]>=r?1:0;return f;});
  N.field=CLASS_R.map(()=>new Uint16Array(n).fill(INF));
  N.queue=new Int32Array(n);
  N.spawns=buildSpawns(map);
}

// ── circle collision ──
function circleHits(x,y,r){
  for(const w of N.cells[cellOf(x,y)]){
    const cx=Math.max(w.x,Math.min(x,w.x+w.w)),cy=Math.max(w.y,Math.min(y,w.y+w.h));
    const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy<r*r)return true;
  }
  return x<30+r||y<30+r||x>N.B-30-r||y>N.B-30-r;
}
// Push a circle out of every wall it overlaps. Mutates p.{x,y}. Returns true if it touched a wall.
function resolve(p,r){
  let hit=false;
  for(let it=0;it<3;it++){
    let moved=false;
    for(const w of N.cells[cellOf(p.x,p.y)]){
      const cx=Math.max(w.x,Math.min(p.x,w.x+w.w)),cy=Math.max(w.y,Math.min(p.y,w.y+w.h));
      const dx=p.x-cx,dy=p.y-cy,d2=dx*dx+dy*dy;
      if(d2>=r*r)continue;
      if(d2>1e-6){const d=Math.sqrt(d2),k=(r-d)/d;p.x+=dx*k;p.y+=dy*k;}
      else{
        // centre is inside the box: leave by the shortest side
        const l=p.x-w.x,rt=w.x+w.w-p.x,t=p.y-w.y,b=w.y+w.h-p.y,m=Math.min(l,rt,t,b);
        if(m===l)p.x=w.x-r;else if(m===rt)p.x=w.x+w.w+r;else if(m===t)p.y=w.y-r;else p.y=w.y+w.h+r;
      }
      moved=hit=true;
    }
    if(!moved)break;
  }
  const lo=30+r,hi=N.B-30-r;
  if(p.x<lo){p.x=lo;hit=true;}if(p.x>hi){p.x=hi;hit=true;}
  if(p.y<lo){p.y=lo;hit=true;}if(p.y>hi){p.y=hi;hit=true;}
  return hit;
}
// Can a circle of radius r travel in a straight line from a to b?
function pathClear(x0,y0,x1,y1,r){
  const d=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(d/16));
  for(let i=1;i<=steps;i++){const t=i/steps;if(circleHits(x0+(x1-x0)*t,y0+(y1-y0)*t,r))return false;}
  return true;
}

// ── 3D rays (world: x, height z, y) ──
// returns {t,w,n:[nx,nz,ny]} for the nearest wall hit, or null
function rayWalls(ox,oy,oz,dx,dy,dz,maxT){
  let best=maxT,bw=null,bn=0;
  for(const w of N.walls){
    if(SHOOT_THROUGH.has(w.k))continue;
    let t0=0,t1=best,ax=0;
    // x slab
    if(Math.abs(dx)<1e-9){if(ox<w.x||ox>w.x+w.w)continue;}
    else{let a=(w.x-ox)/dx,b=(w.x+w.w-ox)/dx;if(a>b){const s=a;a=b;b=s;}if(a>t0){t0=a;ax=0;}if(b<t1)t1=b;if(t0>t1)continue;}
    // y slab (ground plane)
    if(Math.abs(dy)<1e-9){if(oy<w.y||oy>w.y+w.h)continue;}
    else{let a=(w.y-oy)/dy,b=(w.y+w.h-oy)/dy;if(a>b){const s=a;a=b;b=s;}if(a>t0){t0=a;ax=1;}if(b<t1)t1=b;if(t0>t1)continue;}
    // height slab
    if(Math.abs(dz)<1e-9){if(oz<0||oz>w.ht)continue;}
    else{let a=(0-oz)/dz,b=(w.ht-oz)/dz;if(a>b){const s=a;a=b;b=s;}if(a>t0){t0=a;ax=2;}if(b<t1)t1=b;if(t0>t1)continue;}
    if(t0<best&&t0>=0){best=t0;bw=w;bn=ax;}
  }
  if(!bw)return null;
  const n=bn===0?[-Math.sign(dx),0,0]:bn===1?[0,0,-Math.sign(dy)]:[0,-Math.sign(dz),0];
  return{t:best,w:bw,n};
}

// ── flow fields ──
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function computeField(k,sources){
  const f=N.field[k],fr=N.free[k],q=N.queue,C=N.cols,R=N.rows;
  f.fill(INF);let h=0,t=0;
  for(const s of sources){const i=cellOf(s.x,s.y);if(f[i]!==0){f[i]=0;q[t++]=i;}}
  while(h<t){
    const i=q[h++],cx=i%C,cy=(i-cx)/C,nd=f[i]+1;
    for(let d=0;d<8;d++){
      const dx=DIRS[d][0],dy=DIRS[d][1],nx=cx+dx,ny=cy+dy;
      if(nx<0||ny<0||nx>=C||ny>=R)continue;
      const ni=ny*C+nx;
      if(!fr[ni]||f[ni]<=nd)continue;
      if(d>=4&&!fr[cy*C+nx]&&!fr[ny*C+cx])continue; // never squeeze between two blocked cells
      f[ni]=nd;q[t++]=ni;
    }
  }
}
function fieldAt(k,x,y){return N.field[k][cellOf(x,y)];}
// Direction (unit vector) a zombie of class k at (x,y) should walk to reach the nearest player.
// tx,ty = the player it is heading for (used to break ties so paths look natural).
function flowDir(k,x,y,tx,ty,r){
  const f=N.field[k],fr=N.free[k],C=N.cols,R=N.rows;
  let i=cellOf(x,y);
  if(f[i]===0)return null;
  const step=(ci,px,py)=>{
    const cx=ci%C,cy=(ci-cx)/C;let best=-1,bv=f[ci],bs=-2;
    for(let d=0;d<8;d++){
      const dx=DIRS[d][0],dy=DIRS[d][1],nx=cx+dx,ny=cy+dy;
      if(nx<0||ny<0||nx>=C||ny>=R)continue;
      const ni=ny*C+nx,v=f[ni];
      if(v===INF||v>bv)continue;
      if(d>=4&&!fr[cy*C+nx]&&!fr[ny*C+cx])continue;
      // prefer lower cost, then the neighbour that points most toward the target
      const ex=(nx+.5)*CELL-px,ey=(ny+.5)*CELL-py,el=Math.hypot(ex,ey)||1;
      const s=(ex*(tx-px)+ey*(ty-py))/(el*(Math.hypot(tx-px,ty-py)||1));
      if(v<bv||(v===bv&&best>=0&&s>bs)){best=ni;bv=v;bs=s;}
    }
    return best;
  };
  let nxt=step(i,x,y);
  if(nxt<0){
    // wedged in a spot the field can't see (e.g. between two trees): head for the best cell nearby
    const cx=i%C,cy=(i-cx)/C;let bv=INF;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=C||ny>=R)continue;
      const v=f[ny*C+nx];if(v<bv){bv=v;nxt=ny*C+nx;}
    }
    if(nxt<0)return null;
    const ax=(nxt%C+.5)*CELL-x,ay=(Math.floor(nxt/C)+.5)*CELL-y,l=Math.hypot(ax,ay)||1;
    return{x:ax/l,y:ay/l};
  }
  // look ahead along the path and aim at the farthest cell we can walk to in a straight line
  let aim=nxt,cur=nxt;
  for(let s=0;s<4;s++){
    const n2=step(cur,(cur%C+.5)*CELL,(Math.floor(cur/C)+.5)*CELL);if(n2<0||f[n2]>=f[cur])break;
    cur=n2;
    const ax=(cur%C+.5)*CELL,ay=(Math.floor(cur/C)+.5)*CELL;
    if(pathClear(x,y,ax,ay,r*.9))aim=cur;else break;
  }
  const ax=(aim%C+.5)*CELL-x,ay=(Math.floor(aim/C)+.5)*CELL-y,l=Math.hypot(ax,ay)||1;
  return{x:ax/l,y:ay/l};
}
function sizeClass(r){return r<=22?0:r<=32?1:2;}

// ── spawn points: reachable open cells far from the player start ──
function buildSpawns(map){
  // k = the biggest size class that can stand here AND walk to the player start
  const reach=CLASS_R.map((_,k)=>{computeField(k,[map.pSpawn]);return N.field[k].slice();});
  const out=[],C=N.cols,R=DZMaps.rng(map.B*7+map.walls.length);
  for(let i=0;i<reach[0].length;i++){
    if(reach[0][i]===INF||!N.free[0][i])continue;
    const x=(i%C+.5)*CELL,y=(Math.floor(i/C)+.5)*CELL;
    if(Math.hypot(x-map.pSpawn.x,y-map.pSpawn.y)<900)continue;
    const k=reach[2][i]!==INF&&N.free[2][i]?2:reach[1][i]!==INF&&N.free[1][i]?1:0;
    out.push({x,y,k});
  }
  // keep a well-spread random subset
  for(let i=out.length-1;i>0;i--){const j=Math.floor(R()*(i+1));const s=out[i];out[i]=out[j];out[j]=s;}
  return out.slice(0,140);
}

function hazardAt(x,y){
  for(const h of N.hazards)if(x>h.x&&x<h.x+h.w&&y>h.y&&y<h.y+h.h)return h.dps;
  return 0;
}

global.Nav={N,CELL,INF,load,circleHits,resolve,pathClear,rayWalls,computeField,fieldAt,flowDir,sizeClass,hazardAt,cellOf};
})(window);
