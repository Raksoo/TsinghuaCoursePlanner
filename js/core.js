"use strict";

/* ============================================================
   Base data
   ============================================================ */
const BLOCKS = [
  {n:1, start:"08:00", end:"09:35"},
  {n:2, start:"09:50", end:"12:15"},
  {n:3, start:"13:30", end:"15:05"},
  {n:4, start:"15:20", end:"16:55"},
  {n:5, start:"17:05", end:"18:40"},
  {n:6, start:"19:20", end:"21:45"}
];
/* Official Tsinghua timetable: the six blocks (大节) and their sub-sections
   (小节), grouped by morning/afternoon/evening. Reference display only —
   the app schedules by block (see BLOCKS above). */
const CLASS_SCHEDULE = [
  { period:"Morning", cn:"上午", blocks:[
    { n:1, cn:"第一大节", subs:[ {n:1,t:"08:00–08:45"}, {n:2,t:"08:50–09:35"} ] },
    { n:2, cn:"第二大节", subs:[ {n:3,t:"09:50–10:35"}, {n:4,t:"10:40–11:25"}, {n:5,t:"11:30–12:15"} ] }
  ]},
  { period:"Afternoon", cn:"下午", blocks:[
    { n:3, cn:"第三大节", subs:[ {n:6,t:"13:30–14:15"}, {n:7,t:"14:20–15:05"} ] },
    { n:4, cn:"第四大节", subs:[ {n:8,t:"15:20–16:05"}, {n:9,t:"16:10–16:55"} ] },
    { n:5, cn:"第五大节", subs:[ {n:10,t:"17:05–17:50"}, {n:11,t:"17:55–18:40"} ] }
  ]},
  { period:"Evening", cn:"晚上", blocks:[
    { n:6, cn:"第六大节", subs:[ {n:12,t:"19:20–20:05"}, {n:13,t:"20:10–20:55"}, {n:14,t:"21:00–21:45"} ] }
  ]}
];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS = [
  {id:"booked", label:"Booked"},
  {id:"bid",    label:"Bidding"},
  {id:"option", label:"Option"},
  {id:"out",    label:"Dropped"}
];
const WEEK1_MONDAY = new Date(2026, 8, 14);   // September 14, 2026
const TOTAL_WEEKS = 18;
const STORE_KEY = "tsinghua-planner-v1";

/* Starting courses: current selection from the elective list / MBA schedule */
function seedCourses(){
  return [
    {
      id:"seed-digital", titleEn:"Digital Economy: Global versus Chinese Perspectives",
      titleCn:"数字经济：全球与中国视野", number:"70511131", seq:"1", credits:1,
      instructor:"CHEN Yubo", dept:"School of Economics and Management", lang:"English",
      room:"Rm. A201, Jianhua Bldg.", weeks:"1-3,5", status:"booked",
      slots:[{day:1, start:"08:00", end:"11:25"}],
      note:"GMBA and exchange students have first priority."
    },
    {
      id:"seed-frontiers", titleEn:"Frontiers of Chinese Contemporary Issues Research",
      titleCn:"中国经济前沿问题解读", number:"60510371", seq:"0", credits:1,
      instructor:"HE Ping", dept:"School of Economics and Management", lang:"English",
      room:"Rm. A419, Jianhua Bldg.", weeks:"6-9", status:"booked",
      slots:[{day:3, start:"13:30", end:"16:55"}],
      note:"International and exchange students only."
    },
    {
      id:"seed-leadership", titleEn:"Leadership in A New Era",
      titleCn:"麦肯锡课程：全球领导力", number:"80515182", seq:"1", credits:2,
      instructor:"HU Jia", dept:"School of Economics and Management", lang:"English",
      room:"Rm. LG1-21, Jianhua Bldg.", weeks:"5-14", status:"booked",
      slots:[{day:3, start:"19:00", end:"22:00"}],
      note:"Check: elective list says week 5-14, MBA schedule says week 1-3,5-16."
    },
    {
      id:"seed-chinese", titleEn:"Elementary Chinese B",
      titleCn:"初级汉语（B）", number:"64203022", seq:"0", credits:2,
      instructor:"ZHU Wentao", dept:"Language Centre of Tsinghua University", lang:"Chinese",
      room:"Rm. 4103, No.4 Teaching Bldg.", weeks:"1-12", status:"booked",
      slots:[{day:5, start:"13:30", end:"16:05"}],
      note:"Exchange students only."
    }
  ];
}

/* ============================================================
   Generic helpers
   ============================================================ */
const $ = sel => document.querySelector(sel);
const el = (tag, cls, txt) => { const n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; };
const toMin = t => { const [h,m] = String(t).split(":").map(Number); return h*60 + (m||0); };
const fmtMin = m => String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const uid = () => "c"+Math.random().toString(36).slice(2,9);
const esc = s => String(s==null?"":s);
const pad2 = n => String(n).padStart(2,"0");

function parseWeeks(str){
  const out = new Set();
  String(str||"").replace(/week/ig,"").split(/[,、;]/).forEach(part=>{
    const p = part.trim(); if(!p) return;
    const m = p.match(/^(\d+)\s*[-–~]\s*(\d+)$/);
    if(m){ const a=+m[1], b=+m[2]; for(let i=Math.min(a,b);i<=Math.max(a,b);i++) out.add(i); }
    else if(/^\d+$/.test(p)) out.add(+p);
  });
  return [...out].sort((a,b)=>a-b);
}

/* Calendar date (in the browser's local calendar) for a given semester
   week + weekday. Used for display labels. */
function dateFor(w, day){
  return new Date(WEEK1_MONDAY.getTime() + ((w-1)*7 + (day-1))*86400000);
}
function weekDates(w){
  const mon = dateFor(w, 1);
  const sun = dateFor(w, 7);
  const f = d => MONTHS[d.getMonth()]+" "+d.getDate();
  return {mon, sun, label: f(mon)+" – "+f(sun)+(sun.getFullYear()!==2026?", "+sun.getFullYear():"")};
}
function dayDate(w, day){
  const d = dateFor(w, day);
  return MONTHS[d.getMonth()]+" "+d.getDate();
}

/* Which semester week "today" falls in. Returns {week, inRange} where
   week is clamped to [1, TOTAL_WEEKS] and inRange says whether today is
   actually inside the semester date range. */
function currentSemesterWeek(){
  const now = new Date();
  const diff = Math.floor((now - WEEK1_MONDAY)/(7*86400000)) + 1;
  return { week: Math.min(Math.max(diff,1), TOTAL_WEEKS), inRange: diff>=1 && diff<=TOTAL_WEEKS, raw: diff };
}

function statusLabel(id){ const s = STATUS.find(x=>x.id===id); return s?s.label:id; }
function slotText(c){
  if(!c.slots || !c.slots.length) return "—";
  return c.slots.map(s=>DAYS_SHORT[s.day-1]+" "+s.start+"–"+s.end+(s.block?" (B"+s.block+")":"")).join("; ");
}
function toast(msg, actionLabel, actionFn){
  const host = $("#toastHost"); host.innerHTML = "";
  const t = el("div","toast", msg);
  if(actionLabel && actionFn){
    const b = el("button","toast-action", actionLabel);
    b.addEventListener("click", ()=>{ t.remove(); actionFn(); });
    t.appendChild(b);
    setTimeout(()=>{ if(t.parentNode) t.remove(); }, 6000);  // longer window so an undo is catchable
  } else {
    setTimeout(()=>{ if(t.parentNode) t.remove(); }, 2600);
  }
  host.appendChild(t);
  return t;
}

/* ============================================================
   State and storage
   ============================================================ */
let state = { courses: [], visible: {booked:true, bid:true, option:true, out:false}, week: 1, goal: 0 };
let storageOK = true;

function save(){
  if(!storageOK) return;
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch(e){ storageOK = false; renderStorageNote(); }
}
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      const p = JSON.parse(raw);
      if(p && Array.isArray(p.courses)){
        state.courses = p.courses;
        if(p.visible) state.visible = Object.assign(state.visible, p.visible);
        if(p.week) state.week = p.week;
        if(p.goal) state.goal = parseFloat(p.goal) || 0;
        return;
      }
    }
  }catch(e){ storageOK = false; }
  state.courses = seedCourses();
  state.week = currentSemesterWeek().week;
}
