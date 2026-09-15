"use strict";

/* ============================================================
   Schedule import: read the course system's "Export to XLS"
   file (a binary .xls / BIFF8 workbook) with no external
   library. We unwrap the OLE2 (Compound File) container, walk
   the Workbook stream's BIFF records, read the shared-string
   table (SST) and the string cells (LABELSST / LABEL), then
   turn the day × period grid into courses.

   The export only carries each course's title, room, weekday
   and period — no week range, number, instructor or credits.
   Imported courses therefore come in as "Option" with weeks
   defaulting to 1-16, to be adjusted by hand afterwards.
   ============================================================ */

/* ---- little-endian readers over a Uint8Array ---- */
function _u16(b,o){ return b[o] | (b[o+1]<<8); }
function _u32(b,o){ return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0; }

/* ---- OLE2 / Compound File: return the bytes of a named stream ---- */
function cfbReadStream(b, wantNames){
  if(b.length < 512 || _u32(b,0)!==0xE011CFD0 || _u32(b,4)!==0xE11AB1A1)
    throw new Error("This is not an OLE2 .xls file.");
  const secSize  = 1 << _u16(b,30);   // usually 512
  const miniSize = 1 << _u16(b,32);   // usually 64
  const dirStart   = _u32(b,48);
  const miniCutoff = _u32(b,56);
  const miniFatStart = _u32(b,60);
  const difatStart = _u32(b,68);
  const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;
  const secOff = s => (s+1) * secSize;

  // DIFAT: first 109 entries live in the header, the rest in DIFAT sectors
  const fatSectors = [];
  for(let i=0;i<109;i++){ const v=_u32(b,76+i*4); if(v!==FREE) fatSectors.push(v); }
  let ds = difatStart, guard = 0;
  while(ds!==END && ds!==FREE && guard++<1e6){
    const base = secOff(ds), per = secSize/4;
    for(let i=0;i<per-1;i++){ const v=_u32(b,base+i*4); if(v!==FREE) fatSectors.push(v); }
    ds = _u32(b, base+(per-1)*4);
  }

  // Build the FAT (sector allocation table)
  const fat = [];
  for(const s of fatSectors){ const base = secOff(s); for(let i=0;i<secSize/4;i++) fat.push(_u32(b,base+i*4)); }
  const chain = start => { const out=[]; let s=start, g=0; while(s!==END && s!==FREE && g++<1e7){ out.push(s); s=fat[s]; } return out; };
  const readBig = (start,size) => {
    const secs = chain(start), out = new Uint8Array(secs.length*secSize);
    secs.forEach((s,i)=> out.set(b.subarray(secOff(s), secOff(s)+secSize), i*secSize));
    return size!=null ? out.subarray(0,size) : out;
  };

  // Directory entries
  const dir = readBig(dirStart, null), entries = [];
  for(let o=0;o+128<=dir.length;o+=128){
    const nameLen = _u16(dir,o+64); if(nameLen<=0) continue;
    let name=""; for(let i=0;i<nameLen-2;i+=2) name += String.fromCharCode(_u16(dir,o+i));
    entries.push({ name, type:dir[o+66], start:_u32(dir,o+116), size:_u32(dir,o+120) });
  }
  const root = entries.find(e=>e.type===5);

  // Mini FAT + mini stream container (for streams below the cutoff)
  const miniFat = [];
  if(miniFatStart!==END && miniFatStart!==FREE)
    for(const s of chain(miniFatStart)){ const base=secOff(s); for(let i=0;i<secSize/4;i++) miniFat.push(_u32(b,base+i*4)); }
  const miniContainer = root ? readBig(root.start, root.size) : new Uint8Array(0);
  const readMini = (start,size) => {
    const out = new Uint8Array(size); let s=start, off=0, g=0;
    while(s!==END && s!==FREE && off<size && g++<1e7){
      const chunk = miniContainer.subarray(s*miniSize, s*miniSize+miniSize);
      out.set(chunk.subarray(0, Math.min(miniSize, size-off)), off); off += miniSize; s = miniFat[s];
    }
    return out;
  };

  const w = entries.find(e => e.type===2 && wantNames.includes(e.name));
  if(!w) throw new Error("No Workbook stream inside the .xls file.");
  return (w.size < miniCutoff) ? readMini(w.start, w.size) : readBig(w.start, w.size);
}

/* ---- BIFF record list ---- */
function _biffRecords(wb){
  const recs=[]; let i=0;
  while(i+4<=wb.length){ const t=_u16(wb,i), l=_u16(wb,i+2); recs.push({t, o:i+4, l}); i += 4 + l; }
  return recs;
}

/* ---- Shared-string table (handles CONTINUE and the 8/16-bit flag) ---- */
function _parseSST(segs, cstUnique){
  let si=0, pos=0;
  const ensure = () => { while(si<segs.length && pos>=segs[si].length){ si++; pos=0; } };
  const u8 = () => { ensure(); return segs[si][pos++]; };
  const u16r = () => { ensure(); const b=segs[si]; if(pos+2<=b.length){ const v=b[pos]|(b[pos+1]<<8); pos+=2; return v; } const lo=u8(),hi=u8(); return lo|(hi<<8); };
  const u32r = () => { const a=u16r(), b2=u16r(); return (a|(b2<<16))>>>0; };

  const out=[];
  for(let n=0;n<cstUnique && si<segs.length;n++){
    ensure();
    const cch = u16r();
    const grbit = u8();
    let high = (grbit & 0x01)!==0;
    const rich = (grbit & 0x08)!==0;
    const ext  = (grbit & 0x04)!==0;
    const cRun = rich ? u16r() : 0;
    const cbExt = ext ? u32r() : 0;
    let left = cch, str="";
    while(left>0){
      ensure();
      if(high){
        while(left>0 && pos+2<=segs[si].length){ str += String.fromCharCode(segs[si][pos]|(segs[si][pos+1]<<8)); pos+=2; left--; }
      } else {
        while(left>0 && pos<segs[si].length){ str += String.fromCharCode(segs[si][pos]); pos++; left--; }
      }
      if(left>0){ si++; pos=0; ensure(); if(si>=segs.length) break; high = (segs[si][pos++] & 0x01)!==0; } // CONTINUE re-states the flag
    }
    let skip = cRun*4 + cbExt;
    while(skip>0 && si<segs.length){ ensure(); const take = Math.min(skip, segs[si].length-pos); pos+=take; skip-=take; if(skip>0){ si++; pos=0; } }
    out.push(str);
  }
  return out;
}

/* ---- "Machine Learning(六教-6A216)" → {title, room} ---- */
function _splitTitleRoom(text){
  text = String(text).replace(/\s+/g," ").trim();
  const m = text.match(/[（(]([^（）()]*)[）)]\s*$/);
  if(m) return { title: text.slice(0,m.index).trim(), room: m[1].trim() };
  return { title: text, room: "" };
}

/* ---- grid entries → courses (merge consecutive blocks on the same day) ---- */
function _entriesToCourses(entries){
  const groups = new Map();
  entries.forEach(e=>{
    const key = e.title+"||"+e.room;
    if(!groups.has(key)) groups.set(key, {title:e.title, room:e.room, cells:[]});
    groups.get(key).cells.push({day:e.day, block:e.block});
  });
  const courses=[];
  groups.forEach(g=>{
    const byDay = new Map();
    g.cells.forEach(c=>{ if(!byDay.has(c.day)) byDay.set(c.day,[]); byDay.get(c.day).push(c.block); });
    const slots=[];
    byDay.forEach((blocks,day)=>{
      blocks.sort((a,b)=>a-b);
      let i=0;
      while(i<blocks.length){
        let j=i; while(j+1<blocks.length && blocks[j+1]===blocks[j]+1) j++;
        const b1=BLOCKS.find(x=>x.n===blocks[i]), b2=BLOCKS.find(x=>x.n===blocks[j]);
        if(b1&&b2) slots.push({ day, start:b1.start, end:b2.end, block: (i===j ? blocks[i] : undefined) });
        i=j+1;
      }
    });
    courses.push({
      id: uid(), titleEn:g.title, titleCn:"", number:"", seq:"", credits:0,
      instructor:"", dept:"", lang:"", room:g.room, weeks:"1-16", status:"option",
      note:"Imported from schedule XLS — the export carries no week range; check the Weeks field.",
      slots
    });
  });
  return courses;
}

/* ---- public entry: ArrayBuffer → course objects ---- */
function parseScheduleXLS(arrayBuffer){
  const bytes = new Uint8Array(arrayBuffer);
  const wb = cfbReadStream(bytes, ["Workbook","Book"]);
  const recs = _biffRecords(wb);

  // Shared strings
  let sst = [];
  const sstIdx = recs.findIndex(r=>r.t===0x00FC);
  if(sstIdx>=0){
    const s0 = recs[sstIdx];
    const segs = [ wb.subarray(s0.o+8, s0.o+s0.l) ];
    for(let k=sstIdx+1;k<recs.length && recs[k].t===0x003C;k++) segs.push(wb.subarray(recs[k].o, recs[k].o+recs[k].l));
    sst = _parseSST(segs, _u32(wb, s0.o+4));
  }

  // String cells → grid
  const cells = [];
  const put = (r,c,s)=>{ if(!cells[r]) cells[r]=[]; cells[r][c]=s; };
  recs.forEach(r=>{
    if(r.t===0x00FD){ // LABELSST
      put(_u16(wb,r.o), _u16(wb,r.o+2), sst[_u32(wb,r.o+6)] || "");
    } else if(r.t===0x0204){ // LABEL (inline string)
      const cch=_u16(wb,r.o+6), high=(wb[r.o+8]&1)!==0; let s="", p=r.o+9;
      for(let i=0;i<cch;i++){ if(high){ s+=String.fromCharCode(_u16(wb,p)); p+=2; } else { s+=String.fromCharCode(wb[p]); p+=1; } }
      put(_u16(wb,r.o), _u16(wb,r.o+2), s);
    }
  });

  // Locate the grid: weekday columns and Period (block) rows
  const DAY = {monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:7};
  const dayCol = {};
  cells.forEach(row=>{ if(!row) return; row.forEach((v,ci)=>{ if(v && DAY[String(v).trim().toLowerCase()]) dayCol[ci] = DAY[String(v).trim().toLowerCase()]; }); });
  const blockOfRow = {};
  cells.forEach((row,ri)=>{ if(!row) return; for(let ci=0;ci<row.length;ci++){ const m = row[ci] && String(row[ci]).match(/period\s*0*([1-6])/i); if(m){ blockOfRow[ri] = +m[1]; break; } } });

  // Fallbacks if the labels were localised: assume cols 1-7 = Mon-Sun,
  // and the six rows after the weekday header = blocks 1-6.
  if(!Object.keys(dayCol).length) for(let c=1;c<=7;c++) dayCol[c]=c;
  if(!Object.keys(blockOfRow).length){
    let headerRow = -1;
    cells.forEach((row,ri)=>{ if(headerRow<0 && row && row.some(v=>v && DAY[String(v).trim().toLowerCase()])) headerRow = ri; });
    if(headerRow>=0) for(let n=1;n<=6;n++) blockOfRow[headerRow+n]=n;
  }

  const entries = [];
  Object.keys(blockOfRow).forEach(ri=>{
    const row = cells[+ri] || [];
    Object.keys(dayCol).forEach(ci=>{
      const v = row[+ci];
      if(v && String(v).trim()){ const {title,room} = _splitTitleRoom(v); entries.push({ day:dayCol[+ci], block:blockOfRow[+ri], title:title||String(v).trim(), room }); }
    });
  });
  return _entriesToCourses(entries);
}
