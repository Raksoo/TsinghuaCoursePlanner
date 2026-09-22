"use strict";

/* ============================================================
   Parser for pasted course rows
   ============================================================ */
const RE_CODE = /(\d)\s*[-–]\s*(\d)\s*\(\s*week\s*([0-9,\s\-–]+)\)/ig;
const CJK = /[一-鿿]/;

/* "1-6(week 1-8),2-6(week 9-16)" → slots with their own week range when the
   ranges differ; `weeks` is the union (what course.weeks holds). */
function slotsFromCode(str){
  const slots = []; const ranges = []; let m;
  RE_CODE.lastIndex = 0;
  while((m = RE_CODE.exec(str)) !== null){
    const day = +m[1], blk = +m[2], wk = m[3].replace(/\s+/g,"");
    const b = BLOCKS.find(x=>x.n===blk);
    if(day>=1 && day<=7 && b){ slots.push({day, start:b.start, end:b.end, block:blk, weeks:wk}); ranges.push(wk); }
  }
  const allSame = ranges.every(r=>r===ranges[0]);
  const union = allSame ? (ranges[0]||"") : compressWeekList([...new Set(ranges.flatMap(parseWeeks))].sort((a,b)=>a-b));
  if(allSame) slots.forEach(s=>{ delete s.weeks; });
  return {slots, weeks: union};
}
/* [1,2,3,5] → "1-3,5" (the app's own weeks notation) */
function compressWeekList(list){
  const out = []; let i = 0;
  while(i < list.length){
    let j = i; while(j+1 < list.length && list[j+1]===list[j]+1) j++;
    out.push(i===j ? String(list[i]) : list[i]+"-"+list[j]);
    i = j+1;
  }
  return out.join(",");
}

function parseRecord(fields){
  fields = fields.map(f=>f.trim()).filter(Boolean);
  if(!fields.length) return null;

  const codeLines = fields.filter(f=>{ RE_CODE.lastIndex=0; return RE_CODE.test(f); });
  const {slots, weeks} = slotsFromCode(codeLines.join(" "));

  const rest = fields.filter(f=>!codeLines.includes(f));
  const nums = rest.filter(f=>/^\d+(\.\d+)?$/.test(f));
  const longNum = rest.find(f=>/^\d{6,}(-\d+)?$/.test(f)) || "";
  const shorts = nums.filter(f=>f!==longNum && f.length<3);

  const deptRe = /School|Department|Centre|Center|College|Institute|Academy|学院|学系|中心|大学/i;
  const cjk = rest.filter(f=>CJK.test(f) && f!==longNum);
  const cjkDept = cjk.filter(f=>deptRe.test(f));
  const cjkOther = cjk.filter(f=>!cjkDept.includes(f));
  const latin = rest.filter(f=>!CJK.test(f) && !/^\d/.test(f));
  const latinDept = latin.filter(f=>deptRe.test(f));
  const latinOther = latin.filter(f=>!latinDept.includes(f) && !/^(english|chinese)$/i.test(f));
  const langLine = latin.find(f=>/^(english|chinese)$/i.test(f)) || "";

  let titleCn = "", instructor = "";
  if(cjkOther.length === 1){ titleCn = cjkOther[0]; }
  else if(cjkOther.length > 1){
    titleCn = cjkOther[0];
    const last = cjkOther[cjkOther.length-1];
    if(last !== titleCn && last.replace(/[^一-鿿·]/g,"").length <= 6) instructor = last;
  }
  if(!instructor){
    const latinName = latinOther.find(f=>/^[A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+$/.test(f) && f.split(/\s+/).length===2 && latinOther.indexOf(f)>0);
    if(latinName) instructor = latinName;
  }

  const titleEn = latinOther.find(f=>f!==instructor) || "";
  const dept = latinDept[0] || cjkDept[0] || "";

  return {
    id: uid(),
    titleEn, titleCn,
    number: longNum.split("-")[0] || "",
    seq: (longNum.split("-")[1] || shorts[0] || ""),
    credits: parseFloat(shorts.length>1 ? shorts[1] : (shorts[0]||0)) || 0,
    instructor, dept, lang: langLine, room:"",
    weeks: weeks || "1-16",
    slots: slots.length ? slots : [],
    status: "option", note:""
  };
}

function parsePaste(text){
  const raw = text.replace(/\r/g,"");
  const out = [];
  if(/\t/.test(raw)){
    raw.split("\n").forEach(line=>{
      if(!line.trim()) return;
      const c = parseRecord(line.split("\t"));
      if(c) out.push(c);
    });
  } else {
    raw.split(/\n\s*\n/).forEach(chunk=>{
      const c = parseRecord(chunk.split("\n"));
      if(c) out.push(c);
    });
  }
  return out.filter(c => c.titleEn || c.titleCn || c.number);
}
