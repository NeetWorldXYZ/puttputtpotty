import type { EarnedBall } from '../../server/potty/cosmeticCatalog';

/** The same paths paint the picker, portraits, and the playable ball. All fit its existing circle. */
export interface MaterialPath { d:string; fill:string; stroke?:string; width?:number; opacity?:number }
const p=(d:string,fill:string,stroke?:string,width=1,opacity=1):MaterialPath=>({d,fill,stroke,width,opacity});
const c=(x:number,y:number,r:number,fill:string,opacity=1)=>p(`M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0`,fill,undefined,0,opacity);
const star=(x:number,y:number,r:number,fill='#fff8cb')=>p(`M${x} ${y-r}q1 ${r-1} ${r} ${r}q${1-r} 1 ${-r} ${r}q-1 ${1-r} ${-r} ${-r}q${r-1}-1 ${r}-${r}`,fill);
const crown='M29 62 25 40 40 49 50 30 60 49 75 40 71 62Z';
export function ballMaterialPaths(key:EarnedBall):MaterialPath[] {
  switch(key){
    case 'pearl':return [p('M-8 53Q35-15 93 7Q54 18 26 52T-8 96Z','#ffc7e6',undefined,0,.7),p('M0 83Q40 34 110 23L109 49Q48 48 16 109Z','#c9bafa',undefined,0,.65),p('M6 71Q47 21 86 14','none','#fffcec',3,.65),p(crown,'#fff0a5','#678eaa',2),p('M31 64h38v5H31Z','#dba657'),star(75,25,5,'#fff'),star(20,70,4,'#fff')];
    case 'meteor':return [p('M1 20 21 31 36 20 56 25 68 6M-4 64 19 60 33 72 35 102M98 34 71 43 69 62 83 82 95 84M36 20 40 43 22 61M40 43 69 62M40 43 71 43','none','#e95629',9),p('M1 20 21 31 36 20 56 25 68 6M-4 64 19 60 33 72 35 102M98 34 71 43 69 62 83 82 95 84M36 20 40 43 22 61M40 43 69 62M40 43 71 43','none','#ffd365',3),p('M4 30 17 39 29 31 33 42 19 52 3 55Z','#392837'),p('M43 55 59 63 63 89 44 97 39 77Z','#322333'),c(52,16,4,'#88616a'),c(85,54,5,'#362537'),c(80,52,2,'#9c6165')];
    case 'ooze':return [p('M-5 15Q18 32 27 14T62 14T106 16V56Q94 65 88 45T66 44Q67 68 55 67T44 48Q30 36 29 55T8 57Z','#b7f75b'),p('M3 18Q25 35 30 16M69 20Q83 30 98 24','none','#f2ffb3',3),c(40,30,7,'#ddff91'),c(65,77,10,'#218776'),c(63,75,8,'#8beb7c'),c(60,71,2,'#f2ffc8'),c(26,68,5,'#ddffb0',.6),c(81,59,4,'#e3ffb4'),p('M15 81Q41 101 73 89','none','#17696a',4,.35)];
    case 'glacier':return [p('M0 33 28 6 40 38 17 59Z','#d1faff'),p('M28 6 62-4 58 26 40 38Z','#eefeff'),p('M40 38 58 26 80 55 53 75Z','#b4f7ff'),p('M62-4 93 20 80 55 58 26Z','#68abd9'),p('M0 70 17 59 53 75 28 106Z','#48a8d9'),p('M80 55 105 35 108 74 70 100 53 75Z','#94e8f6'),p('M28 6 40 38 17 59M40 38 53 75 80 55M53 75 45 101','none','#fff',2.5,.85),star(66,24,7,'#fff'),star(22,68,4,'#e8ffff')];
    case 'hoops':return [...Array.from({length:85},(_,i)=>c(7+(i%10)*10+(Math.floor(i/10)%2)*5,8+Math.floor(i/10)*11,1.1,'#8b401e',.38)),p('M2 48Q49 43 100 52M47-2Q58 42 51 102M10 8Q68 39 19 94M88 7Q29 48 89 95','none','#482e29',4),p('M2 45Q49 40 100 49M44-2Q55 42 48 102','none','#ffce73',1.2,.85)];
    case 'sushi':return [c(50,51,40,'#081f2c'),c(50,49,35,'#f4f4d7'),...Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return p(`M${50+Math.cos(a)*29} ${49+Math.sin(a)*29}l${Math.cos(a+1)*4} ${Math.sin(a+1)*4}`,'none',i%2?'#b4cbb9':'#fffef1',3)}),c(50,49,23,'#426b52'),p('M31 38Q42 22 59 33L46 53Z','#ffd36c'),p('M49 53 62 33Q81 48 65 65Z','#ff8c7f'),p('m57 42 11 8m-16 0 12 9','none','#fff0cf',2),p('M32 44 44 55 60 67Q37 78 29 57Z','#9bd879'),p('M34 55 43 63','none','#e0f19b',3)];
    case 'orbit':return [p('M-3 14Q50 45 104 25L106 39Q50 59-3 28Z','#bfacf9'),p('M-6 57Q43 78 103 49L108 65Q43 90-6 72Z','#4054ad'),p('M-4 31Q46 64 105 42','none','#f0c491',6),p('M-8 84Q42 32 104 9','none','#222849',13),p('M-8 83Q42 30 104 8','none','#f4ce8e',9),p('M-8 83Q42 30 104 8','none','#fff4c4',2),c(66,61,8,'#998add'),p('M57 60q8-7 17-1','none','#d4beff',2),star(78,78,3)];
    case 'glaze':return [p('M-4 52Q10 36 20 54T41 52T63 56T84 52T105 54V107H-5Z','#dfa464'),p('M-5 51Q12 39 20 56T39 55T62 59T83 55T105 55','none','#ffd6a4',5),...[[23,23,7,3,'#fff0b4'],[46,15,3,7,'#80f3cf'],[70,27,-5,6,'#fff'],[38,37,8,-2,'#ca568d'],[58,43,5,5,'#74d8ff'],[85,43,3,-7,'#fff5ad'],[16,39,-3,5,'#7bded5'],[70,63,6,-3,'#fa649f'],[35,68,4,3,'#9e7bff'],[50,79,5,-2,'#fff0ae']].map(([x,y,dx,dy,color])=>p(`M${x} ${y}l${dx} ${dy}`,'none',String(color),3)),p('M22 16Q35 9 51 10','none','#ffe2ee',3)];
    case 'pirate':return [p('M-5 34Q45 60 106 30L104 53Q47 84-4 56Z','#172939'),c(50,51,31,'#a77e3b'),c(50,49,28,'#fae1a0'),c(50,49,24,'#243546'),p('M35 45Q33 28 50 28T65 45L62 57H57V64H43V57H38Z','#faf0d1'),c(42,44,5,'#162b3b'),c(58,44,5,'#162b3b'),p('M50 49 46 54H54Z','#162b3b'),p('m47 57v6m6-6v6','none','#243546',2),p('m30 61 38 15m-37 0 37-15','none','#f4ddac',4),star(78,18,4)];
    case 'dragonball':return Array.from({length:30},(_,i)=>{const row=Math.floor(i/5),x=(i%5)*25-12+(row%2)*12,y=row*20-8;return p(`M${x} ${y}q12-9 24 0l-2 12-10 10-10-10Z`,['#ae4550','#e06f57','#8c3348'][i%3],'#662d42',1.5)}).concat([p('M47 20 40 47 50 69 62 43Z','#ffdb7b','#e7934b',2),p('M50 31 46 46 50 57 55 43Z','#fff0ac'),star(23,24,4)]);
    case 'disco':return Array.from({length:64},(_,i)=>{const row=Math.floor(i/8),x=(i%8)*13-2,y=row*13-2;return p(`M${x} ${y}h11v11h-11Z`,['#8cc4e7','#e9f6f8','#b69ddd','#688cc0','#d8bcec','#9fd3d3'][(row*3+i)%6],'#506685',.7)}).concat([star(28,27,12,'#fff'),star(72,61,8,'#ffffed'),p('M28 9v36m-18-18h36','none','#fff',1.3)]);
    case 'nebula':return [p('M-8 85Q15 25 63 27T108 3L107 37Q55 40 18 102Z','#b763d8',undefined,0,.8),p('M-3 100Q19 40 78 40T104 18','none','#ed9cde',13,.5),p('M-3 72Q33 32 65 46T104 28','none','#786fdf',14,.65),p('M-5 91Q25 41 75 42','none','#79d8ec',4,.75),...[[15,20,1.6],[32,14,1],[69,13,2],[78,70,2],[25,76,1],[45,59,1.5],[86,87,1],[55,88,2]].map(([x,y,r])=>c(x,y,r,'#fff6da')),star(54,29,7),star(23,54,4,'#fff'),star(80,56,4,'#8efffa')];
    case 'prism':return [p('M16 8 50-5 84 8 74 34H26Z','#e2ffff'),p('M-5 27 16 8 26 34 11 60Z','#b4d2ff'),p('M84 8 104 27 89 60 74 34Z','#7bacdf'),p('M26 34H74L50 97Z','#a7fff3'),p('M11 60 26 34 50 97Z','#56bcda'),p('M74 34 89 60 50 97Z','#478fc4'),p('M-4 74 11 60 50 97 42 107Z','#4c90bd'),p('M89 60 104 74 62 107 50 97Z','#326f9c'),p('M16 8 26 34H74L84 8M26 34 50 97 74 34','none','#f1fffa',2),star(29,33,9,'#fff'),star(72,66,4,'#d4ffff')];
  }
}
export function ballMaterialSvg(key:EarnedBall):string {
  return ballMaterialPaths(key).map(s=>`<path d="${s.d}" fill="${s.fill}"${s.stroke?` stroke="${s.stroke}" stroke-width="${s.width}"`:''} opacity="${s.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}
const canvasMaterials=new Map<EarnedBall,(MaterialPath & {path:Path2D})[]>();
export function paintBallMaterial(ctx:CanvasRenderingContext2D,key:EarnedBall,x:number,y:number,r:number):void {
  if(!canvasMaterials.has(key))canvasMaterials.set(key,ballMaterialPaths(key).map(s=>({...s,path:new Path2D(s.d)})));
  ctx.save();ctx.translate(x-r,y-r);ctx.scale(r/50,r/50);
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const s of canvasMaterials.get(key)!){
    ctx.globalAlpha=s.opacity??1;
    if(s.fill!=='none'){ctx.fillStyle=s.fill;ctx.fill(s.path);}
    if(s.stroke){ctx.strokeStyle=s.stroke;ctx.lineWidth=s.width??1;ctx.stroke(s.path);}
  }
  ctx.restore();
}
