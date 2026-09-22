import fs from 'node:fs';
import { exercises } from '../lib/fitness.ts';
// Original schematic poses. Points: head, shoulder, hip, elbows, hands, knees, feet.
const stand = { h:[155,62],s:[155,96],p:[155,173],e1:[137,139],w1:[132,179],e2:[173,139],w2:[178,179],k1:[136,223],f1:[125,279],k2:[174,223],f2:[185,279] };
const pose=(base, changes)=>({...base,...changes});
const squatStart=pose(stand,{p:[150,160],k1:[204,218],f1:[219,279],k2:[112,220],f2:[78,279]});
const squatEnd=pose(squatStart,{h:[146,105],s:[146,136],p:[140,208],e1:[125,175],w1:[121,215],e2:[165,175],w2:[170,215],k1:[204,221],k2:[111,263]});
const bridge0={h:[63,224],s:[87,231],p:[174,263],e1:[110,264],w1:[135,279],e2:[112,267],w2:[142,279],k1:[227,222],f1:[260,279],k2:[223,225],f2:[253,279]};
const bridge1=pose(bridge0,{p:[171,210],k1:[223,214],k2:[217,218]});
const specs={
 'Dumbbell Romanian deadlift':{a:stand,b:pose(stand,{h:[245,126],s:[217,144],p:[132,175],e1:[207,183],w1:[193,224],e2:[220,183],w2:[206,224],k1:[141,227],k2:[171,227]}),label:'Side view · hinge at the hips',weights:true,focus:'trunk'},
 'Prone W raise':{a:{h:[160,80],s:[160,116],p:[160,198],e1:[108,160],w1:[78,118],e2:[212,160],w2:[242,118],k1:[145,241],f1:[142,282],k2:[175,241],f2:[178,282]},b:{h:[160,80],s:[160,116],p:[160,198],e1:[113,153],w1:[85,104],e2:[207,153],w2:[235,104],k1:[145,241],f1:[142,282],k2:[175,241],f2:[178,282]},label:'Face down · overhead view',focus:'arms',mat:true,prone:true},
 'Split squat':{a:squatStart,b:squatEnd,label:'Side view · lower between your feet',focus:'legs'},
 'Reverse lunge':{a:stand,b:squatEnd,label:'Step back · lower · return',focus:'legs'},
 'Calf raise':{a:stand,b:pose(stand,{h:[155,47],s:[155,81],p:[155,158],e1:[137,124],w1:[132,164],e2:[173,124],w2:[178,164],k1:[136,208],k2:[174,208],f1:[130,270],f2:[180,270]}),label:'Rise onto your toes · lower slowly',focus:'legs',calf:true},
 'Pike push-up':{a:{h:[221,212],s:[200,191],p:[153,126],e1:[229,230],w1:[250,279],e2:[213,238],w2:[235,279],k1:[111,203],f1:[71,279],k2:[102,197],f2:[57,279]},b:{h:[243,249],s:[218,229],p:[157,148],e1:[252,241],w1:[250,279],e2:[236,243],w2:[235,279],k1:[111,211],f1:[71,279],k2:[102,205],f2:[57,279]},label:'Hips high · bend elbows · press',focus:'arms'},
 'Self-resisted curl':{a:pose(stand,{e1:[134,139],w1:[130,188],e2:[178,145],w2:[131,186]}),b:pose(stand,{e1:[134,139],w1:[127,96],e2:[180,113],w2:[128,98]}),label:'Opposite hand supplies gentle resistance',focus:'arms'},
 'Self-resisted wrist curl':{a:pose(stand,{e1:[131,137],w1:[91,142],e2:[184,130],w2:[92,142]}),b:pose(stand,{e1:[131,137],w1:[91,142],e2:[177,114],w2:[81,127]}),label:'Forearm steady · gently curl wrist',focus:'arms',wrist:true},
 'Cable chest fly':{a:pose(stand,{e1:[102,111],w1:[51,126],e2:[208,111],w2:[259,126]}),b:pose(stand,{e1:[122,126],w1:[150,149],e2:[188,126],w2:[160,149]}),label:'Front view · bring hands together',focus:'arms',cables:true},
 'Dumbbell floor fly':{a:{h:[160,75],s:[160,111],p:[160,195],e1:[95,115],w1:[45,143],e2:[225,115],w2:[275,143],k1:[124,232],f1:[121,279],k2:[196,232],f2:[199,279]},b:{h:[160,75],s:[160,111],p:[160,195],e1:[127,119],w1:[152,136],e2:[193,119],w2:[168,136],k1:[124,232],f1:[121,279],k2:[196,232],f2:[199,279]},label:'Lying face up · overhead view',focus:'arms',weights:true,mat:true},
 'Hamstring walkout':{a:bridge1,b:pose(bridge1,{p:[170,230],k1:[225,246],f1:[293,279],k2:[220,247],f2:[281,279]}),label:'Hold a bridge · small steps out and back',focus:'legs',walk:true},
 'Assisted pull-up':{a:pose(stand,{h:[160,130],s:[160,160],p:[160,227],e1:[115,113],w1:[91,51],e2:[205,113],w2:[229,51],k1:[138,255],f1:[149,282],k2:[182,255],f2:[171,282]}),b:pose(stand,{h:[160,46],s:[160,78],p:[160,147],e1:[108,89],w1:[91,51],e2:[212,89],w2:[229,51],k1:[138,183],f1:[149,211],k2:[182,183],f2:[171,211]}),label:'Assisted machine · pull without swinging',focus:'arms',pullup:true},
 'Reverse EZ-bar curl':{a:stand,b:pose(stand,{e1:[137,139],w1:[132,100],e2:[173,139],w2:[178,100]}),label:'Overhand grip · elbows stay near sides',focus:'arms',bar:true},
 'Dumbbell step-up':{a:pose(stand,{h:[116,92],s:[116,124],p:[119,195],e1:[95,164],w1:[93,204],e2:[133,164],w2:[136,204],k1:[180,189],f1:[196,229],k2:[112,234],f2:[101,279]}),b:pose(stand,{h:[191,32],s:[191,64],p:[191,137],e1:[173,107],w1:[168,146],e2:[209,107],w2:[214,146],k1:[193,183],f1:[196,229],k2:[170,183],f2:[178,229]}),label:'Stable low step · lead leg lifts you',focus:'legs',weights:true,step:true},
 'Cable glute kickback':{a:pose(stand,{h:[123,70],s:[142,102],p:[182,175],e1:[106,118],w1:[75,98],e2:[116,121],w2:[77,103],k1:[174,224],f1:[165,279],k2:[192,225],f2:[202,279]}),b:pose(stand,{h:[123,70],s:[142,102],p:[182,175],e1:[106,118],w1:[75,98],e2:[116,121],w2:[77,103],k1:[174,224],f1:[165,279],k2:[236,196],f2:[275,233]}),label:'Torso steady · extend one hip',focus:'legs',kickback:true},
 'Dumbbell hip thrust':{a:pose(bridge0,{h:[56,159],s:[82,181],p:[174,244],e1:[122,216],w1:[176,235],e2:[119,219],w2:[163,237]}),b:pose(bridge0,{h:[55,161],s:[82,181],p:[174,185],e1:[123,197],w1:[176,180],e2:[117,196],w2:[163,180],k1:[232,190],k2:[226,195]}),label:'Upper back supported · lift hips',focus:'trunk',bench:true,hipWeight:true},
 'Single-leg calf raise':{a:pose(stand,{k2:[195,214],f2:[218,199],e2:[213,124],w2:[274,115]}),b:pose(stand,{h:[155,47],s:[155,81],p:[155,158],e1:[137,124],w1:[132,164],e2:[213,115],w2:[274,115],k1:[136,208],f1:[130,270],k2:[195,199],f2:[218,184]}),label:'Use support · work each side',focus:'legs',support:true,calf:true},
 'Bird dog':{a:{h:[75,150],s:[105,162],p:[195,163],e1:[105,207],w1:[100,257],e2:[116,207],w2:[112,257],k1:[190,222],f1:[249,237],k2:[207,224],f2:[261,237]},b:{h:[75,150],s:[105,162],p:[195,163],e1:[60,162],w1:[20,160],e2:[116,207],w2:[112,257],k1:[190,222],f1:[249,237],k2:[244,162],f2:[296,160]},label:'Opposite arm + leg · keep torso steady',focus:'trunk',mat:true},
 'Side plank hip lift':{a:{h:[71,143],s:[92,170],p:[176,234],e1:[98,227],w1:[59,229],e2:[135,192],w2:[176,234],k1:[233,246],f1:[285,273],k2:[235,252],f2:[288,279]},b:{h:[72,124],s:[94,153],p:[181,192],e1:[98,227],w1:[59,229],e2:[139,167],w2:[181,192],k1:[235,234],f1:[285,273],k2:[237,240],f2:[288,279]},label:'Elbow supported · lift hips · switch sides',focus:'trunk',mat:true},
};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const anim=(attr,a,b,enabled)=>enabled&&a!==b?`<animate attributeName="${attr}" values="${a};${a};${b};${b};${a}" keyTimes="0;.12;.45;.6;1" dur="4s" repeatCount="indefinite"/>`:'';
const points=(p,keys)=>keys.map((key,i)=>(i?'L':'M')+p[key].join(' ')).join(' ');
function render(name,s,animated,endpoint=0){
 const a=endpoint?s.b:s.a,b=s.b;
 const path=(keys,color,width,extra='')=>{const d=points(a,keys),to=points(b,keys);return `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}>${anim('d',d,to,animated)}</path>`;};
 const limbKeys=[['s','e1','w1'],['s','e2','w2'],['p','k1','f1'],['p','k2','f2']];
 let equipment='';
 if(s.mat)equipment+='<rect x="24" y="57" width="272" height="242" rx="22" fill="#cfdee4" opacity=".7"/>';
 if(s.bench)equipment+='<path d="M25 198H102M37 198V283M89 198V283" fill="none" stroke="#708396" stroke-width="12"/>';
 if(s.step)equipment+='<path d="M168 233H237V288H168Z" fill="#a6b9c6" stroke="#708396" stroke-width="4"/>';
 if(s.pullup){equipment+='<path d="M52 284V45H268V284" fill="none" stroke="#8b9dab" stroke-width="9"/>';const yy=a.k1[1]+8,to=b.k1[1]+8;equipment+=`<rect x="125" y="${yy}" width="70" height="9" rx="4" fill="#7798a7">${anim('y',String(yy),String(to),animated)}</rect>`;}
 if(s.support)equipment+='<path d="M278 281V84" stroke="#8b9dab" stroke-width="8"/>';
 if(s.cables){equipment+='<path d="M28 279V74M292 279V74" stroke="#7b8f9f" stroke-width="9"/>';for(const [key,x]of[['w1',28],['w2',292]]){const d=`M${x} 105L${a[key].join(' ')}`,to=`M${x} 105L${b[key].join(' ')}`;equipment+=`<path d="${d}" stroke="#607f90" stroke-width="2">${anim('d',d,to,animated)}</path>`;}}
 if(s.kickback){equipment+='<path d="M67 65V285" stroke="#8b9dab" stroke-width="9"/>';equipment+=`<path d="M67 270L${a.f2.join(' ')}" stroke="#607f90" stroke-width="2">${anim('d',`M67 270L${a.f2.join(' ')}`,`M67 270L${b.f2.join(' ')}`,animated)}</path>`;}
 let body=path(['s','p'],'#657c92',23)+limbKeys.map(keys=>path(keys,'#849aab',13)).join('');
 if(s.focus==='arms')body+=limbKeys.slice(0,2).map(keys=>path(keys,'#27b6ae',6)).join('');
 if(s.focus==='legs')body+=limbKeys.slice(2).map(keys=>path(keys,'#27b6ae',6)).join('');
 if(s.focus==='trunk')body+=path(['s','p'],'#27b6ae',9);
 body+=`<circle cx="${a.h[0]}" cy="${a.h[1]}" r="17" fill="#8298a9">${anim('cx',String(a.h[0]),String(b.h[0]),animated)}${anim('cy',String(a.h[1]),String(b.h[1]),animated)}</circle>`;
 for(const key of ['e1','e2','k1','k2'])body+=`<circle cx="${a[key][0]}" cy="${a[key][1]}" r="4" fill="#c5e0e6">${anim('cx',String(a[key][0]),String(b[key][0]),animated)}${anim('cy',String(a[key][1]),String(b[key][1]),animated)}</circle>`;
 if(s.weights||s.hipWeight){for(const key of s.hipWeight?['p']:['w1','w2'])body+=`<rect x="${a[key][0]-11}" y="${a[key][1]-5}" width="22" height="10" rx="3" fill="#344d61">${anim('x',String(a[key][0]-11),String(b[key][0]-11),animated)}${anim('y',String(a[key][1]-5),String(b[key][1]-5),animated)}</rect>`;}
 if(s.bar)body+=path(['w1','w2'],'#344d61',10);
 if(s.wrist){const d=`M${a.w1.join(' ')}l-20 6`,to=`M${b.w1.join(' ')}l-14 -17`;body+=`<path d="${d}" stroke="#27b6ae" stroke-width="9" stroke-linecap="round">${anim('d',d,to,animated)}</path>`;}
 const note=s.prone?'Keep forehead supported; lift arms gently.':s.walk?'Take small alternating steps; keep hips raised.':'Controlled movement · comfortable range';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 350" role="img" aria-labelledby="title desc"><title id="title">${esc(name)} animated technique diagram</title><desc id="desc">${esc(s.label)}. ${esc(note)}. Schematic illustration, not a motion capture.</desc><rect width="320" height="350" fill="#eaf0f3"/><path d="M20 290H300" stroke="#c5d4dc" stroke-width="3"/>${equipment}${body}<text x="160" y="318" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#395568">${esc(s.label)}</text><text x="160" y="338" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="#506b7e">${esc(note)}</text></svg>`;
}
const media=JSON.parse(fs.readFileSync('lib/exercise-media.json','utf8'));
fs.mkdirSync('public/exercise-animations',{recursive:true});
for(const [name,spec]of Object.entries(specs)){
 const slug=name.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-');
 fs.writeFileSync(`public/exercise-animations/${slug}.svg`,render(name,spec,true));
 fs.writeFileSync(`public/exercise-animations/${slug}-start.svg`,render(name,spec,false));
 fs.writeFileSync(`public/exercise-animations/${slug}-finish.svg`,render(name,spec,false,1));
 media[name]={animation:`/exercise-animations/${slug}.svg`,images:[`/exercise-animations/${slug}-start.svg`,`/exercise-animations/${slug}-finish.svg`],source:'/exercise-animations/README.txt'};
}
for(const exercise of exercises)if(!media[exercise.name])throw Error('Missing guide: '+exercise.name);
fs.writeFileSync('lib/exercise-media.json',JSON.stringify(media,null,2)+'\n');
fs.writeFileSync('public/exercise-animations/README.txt','Original SculptAI schematic movement guides, generated from exercise-specific key poses.\nSource: scripts/generate-exercise-animations.mjs\nThese simplified diagrams demonstrate motion direction; they are not anatomical motion capture.\nReference for prone shoulder stabilization: https://www.acefitness.org/certifiednewsarticle/2660/a-commonsense-approach-to-addressing-shoulder-instability/\nReference for bird dog: https://www.nasm.org/resource-center/exercise-library/bird-dog\n');
console.log(`Created ${Object.keys(specs).length} animated SVG guides. Catalog coverage ${exercises.filter(e=>media[e.name]).length}/${exercises.length}.`);
