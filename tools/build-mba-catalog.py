#!/usr/bin/env python3
"""Build data/catalog-mba.json from the two MBA PDFs in assets/.

Run once (and again only if the PDFs change):

    python3 tools/build-mba-catalog.py

Needs `pdfplumber` (pip3 install pdfplumber).

Two sources, merged by course number:
- The syllabus PDF has structured header fields per course (number, titles,
  credits, prerequisites, language, assessment, instructor e-mail, page).
  Those are read automatically.
- The one-page schedule PDF (times, rooms, weeks, programme) is a visual
  grid that does not extract reliably — it is transcribed by hand into
  SCHEDULE below. Same for the short descriptions: DESCRIPTIONS are 1–2
  sentence summaries written from the syllabus text.

Where the two PDFs disagree, the schedule wins for time/room/instructor
and the disagreement is kept in "notes".
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SYLLABUS = ROOT / "assets" / "2026 Fall Elective Course Syllabuses (English-Instructed) - Exchange student.pdf"
SCHEDULE_PDF = "26Fall_MBA Course Schedule_20260702_Exchange stdudents.pdf"
OUT = ROOT / "data" / "catalog-mba.json"

# --- hand-transcribed from the schedule PDF (Academic Affairs Office, 2026-07-02) ---
# day: 1=Mon … 5=Fri. program: MBA | MiM | MoF | Chinese (Language Centre)
SCHEDULE = [
  # number,     title (as printed in the schedule),               instr,        day, start,  end,    weeks,      room,                              program
  ("70511131", "Digital Economy: Global versus Chinese Perspectives", "CHEN Yubo", 1, "08:00", "11:25", "1-3,5",    "Rm. A201, Jianhua Bldg.",         "MBA"),
  ("60510341", "Macroeconomics: The Chinese Economy",              "DONG Feng",   1, "13:30", "16:55", "1-3,5",    "Rm. A209, Jianhua Bldg.",         "MBA"),
  ("80516081", "Business Marketing Management",                    "ZHANG Fan",   1, "13:30", "16:55", "6-9",      "Rm. A209, Jianhua Bldg.",         "MBA"),
  ("80510872", "Marketing Research",                               "ZHAO Yu",     1, "13:30", "16:55", "9-16",     "Rm. A307, Jianhua Bldg.",         "MiM"),
  ("80511412", "Technology and Strategy",                          "LI Xibao",    2, "09:50", "12:15", "1-12",     "Rm. A307, Jianhua Bldg.",         "MiM"),
  ("80517022", "Firm Valuation",                                   "LU Yao",      2, "13:30", "16:55", "1-3,5-8",  "Rm. A101, Jianhua Bldg.",         "MBA"),
  ("70511212", "People Analytics",                                 "LI Ning",     2, "13:30", "16:55", "9-16",     "Rm. A204, Jianhua Bldg.",         "MiM"),
  ("70510983", "Financial Data Analysis",                          "LIU Shuo",    3, "09:50", "12:15", "1-16",     "Rm. A301, Jianhua Bldg.",         "MoF"),
  ("60510371", "Frontiers of Chinese Contemporary Issues Research", "HE Ping",    3, "13:30", "16:55", "6-9",      "Rm. A419, Jianhua Bldg.",         "MBA"),
  ("70518023", "Financial Theory",                                 "SHENG Tao",   3, "13:30", "16:55", "1-12",     "Rm. A420, Jianhua Bldg.",         "MoF"),
  ("80510862", "Consumer Behavior",                                "HUANG Liang", 3, "13:30", "16:55", "9-16",     "Rm. A404, Jianhua Bldg.",         "MiM"),
  ("80515182", "Leadership in A New Era",                          "HU Jia",      3, "19:00", "22:00", "1-3,5-16", "Rm. LG1-21, Jianhua Bldg.",       "MBA"),
  ("64203022", "Elementary Chinese B",                             "ZHU Wentao",  5, "13:30", "16:05", "1-12",     "Rm. 4103, No.4 Teaching Bldg.",   "Chinese"),
  ("64203042", "Pre-intermediate Chinese B",                       "DAI Yunjuan", 5, "13:30", "16:05", "1-12",     "Rm. 4204, No.4 Teaching Bldg.",   "Chinese"),
  ("64203052", "Intermediate Chinese",                             "GUO Zhen",    5, "13:30", "16:05", "1-12",     "Rm. 1206, No.3 Teaching Bldg.",   "Chinese"),
]

# --- short summaries written from the syllabus course descriptions ---
DESCRIPTIONS = {
  "70511131": "How digital technologies reshape business in China versus the West: platform strategy, digital transformation and the logic behind China's digital innovations — and whether it transfers to global markets.",
  "60510341": "An MBA course on the Chinese economy with a macroeconomic focus: growth, structural change, policy and what it means for business decisions.",
  "80516081": "Practice-oriented marketing management: the marketing operation process, customer needs and buying centres, competitor monitoring; groups run a simulated company in the market.",
  "80510872": "Hands-on data analysis for marketing research: linear and generalised linear models, survey design and practice projects. Requires the MBA core course in finance.",
  "80511412": "Strategic frameworks for technology-driven industries: forces behind the pace of technological change, industry dynamics and the managerial challenges of innovation.",
  "80517022": "Corporate valuation for investment decisions: fundamental analysis applied to listed and private companies, equity issues, acquisitions and restructurings.",
  "70511212": "Using data and analytics for people decisions — hiring, performance, retention — with cases and group work on real HR analytics problems.",
  "70510983": "Introduction to data analysis in finance and business: methods and tools to turn data into decisions, with extensive hands-on work and a progress journal.",
  "60510371": "China's economic frontier issues: the market-based economy with a strong state role, the bank-centred financial system and the current policy debates.",
  "70518023": "Core finance theory: capital structure, asset valuation, interest rates, portfolio theory, asset pricing, behavioural finance and financial history.",
  "80510862": "A conceptual framework for understanding people as consumers: the consumer decision process, its determinants and the implications for marketing strategy.",
  "80515182": "McKinsey global leadership programme: new leadership theories and insights, applied through cases, reflection journals and group work.",
  "64203022": "Chinese for beginners (level B). Taught in Chinese.",
  "64203042": "Pre-intermediate Chinese (level B): for students with roughly 600–800 words of vocabulary or HSK 2.",
  "64203052": "Intermediate Chinese: for students with roughly 1800–2000 words of vocabulary or HSK 3 and above.",
}

NOTES = {
  "70511131": "GMBA and exchange students have first priority. The syllabus says 2 credits, the elective list for exchange students said 1 — check which applies.",
  "60510371": "International and exchange students only. The syllabus lists this course as \"Frontier Economic Issues in China\".",
  "80510872": "Course of MiM — only a few seats open to MBA/exchange students.",
  "80511412": "Course of MiM — only a few seats open to MBA/exchange students. Syllabus title: \"Technology Strategy\".",
  "70511212": "Course of MiM — only a few seats open to MBA/exchange students.",
  "80510862": "Course of MiM — only a few seats open to MBA/exchange students.",
  "70510983": "Course of MoF — only a few seats open to MBA/exchange students.",
  "70518023": "Course of MoF — only a few seats open to MBA/exchange students. Syllabus title: \"Finance Theory\", instructor spelled \"SHEN Tao\" there.",
  "64203022": "Exchange students only.",
  "64203042": "Exchange students only. The syllabus names GUO Zhen as instructor; the schedule says DAI Yunjuan.",
  "64203052": "Exchange students only. The syllabus names DAI Yunjuan as instructor; the schedule says GUO Zhen.",
}

DEPT = {
  "MBA": "School of Economics and Management", "MiM": "School of Economics and Management",
  "MoF": "School of Economics and Management", "Chinese": "Language Centre of Tsinghua University",
}


def checked(fragment):
  """'□a ■b ■c' -> ['b', 'c'] (the boxes that are ticked)."""
  parts = re.split(r"(?=[■□])", fragment)
  out = []
  for p in parts:
    p = p.strip()
    if p.startswith("■"):
      label = p[1:].strip().strip("_ ").rstrip("_")
      label = re.sub(r"^others?\s*_*\s*", "", label, flags=re.I)   # "others__ Progress Journal" -> "Progress Journal"
      label = re.sub(r"\s+", " ", label)
      if label: out.append(label.lower())
  return out


def read_syllabus():
  import pdfplumber
  courses = {}
  with pdfplumber.open(str(SYLLABUS)) as pdf:
    for pno, page in enumerate(pdf.pages, start=1):
      txt = page.extract_text() or ""
      m = re.search(r"^Course Number:\s*(\d{8})", txt, re.M)
      if not m: continue
      num = m.group(1)
      def field(key):
        mm = re.search(r"^" + re.escape(key) + r":\s*(.*)$", txt, re.M)
        return mm.group(1).strip() if mm else ""
      lang_m = re.search(r"Teaching Language:(.*)", txt)
      lang_boxes = checked(lang_m.group(1)) if lang_m else []
      lang = "English" if any("en" == l or l.startswith("en") for l in lang_boxes) and not any(l == "ch" for l in lang_boxes) else \
             ("Chinese" if any(l == "ch" for l in lang_boxes) else "")
      assess_m = re.search(r"Assessment Method:(.*?)(?:Semester:|Course Category:)", txt, re.S)
      assessment = checked(" ".join(assess_m.group(1).split())) if assess_m else []
      prereq = field("Prerequisites")
      if prereq.startswith("Teaching Language"): prereq = ""      # field was empty; the next line got swallowed
      prereq = re.sub(r"^(No N/A|N/A|No|None)$", "", prereq, flags=re.I)
      email = field("E-mail") or field("Email")
      email = email.split()[0] if email else ""
      courses[num] = {
        "number": num,
        "titleCn": field("Course Name (CH)"),
        "titleEnSyllabus": field("Course Name (EN)"),
        "credits": float(field("Credits") or 0),
        "prereq": prereq,
        "lang": lang,
        "assessment": assessment,
        "email": email,
        "syllabusPage": pno,
      }
  return courses


def main():
  syl = read_syllabus()
  out = []
  for num, title, instr, day, start, end, weeks, room, prog in SCHEDULE:
    s = syl.get(num, {})
    if not s: print("WARN: no syllabus entry for", num, title, file=sys.stderr)
    credits = s.get("credits") or 0
    if not credits: print("WARN: no credits for", num, title, file=sys.stderr)
    out.append({
      "key": num,
      "number": num,
      "titleEn": title,
      "titleCn": s.get("titleCn", ""),
      "aliases": [a for a in [s.get("titleEnSyllabus", "")] if a and a != title],
      "credits": credits if credits != int(credits) else int(credits),
      "instructor": instr,
      "email": s.get("email", ""),
      "dept": DEPT[prog],
      "program": prog,
      "lang": s.get("lang") or ("Chinese" if prog == "Chinese" else "English"),
      "room": room,
      "weeks": weeks,
      "slots": [{"day": day, "start": start, "end": end}],
      "prereq": s.get("prereq", ""),
      "assessment": s.get("assessment", []),
      "description": DESCRIPTIONS.get(num, ""),
      "syllabusPage": s.get("syllabusPage"),
      "notes": NOTES.get(num, ""),
    })
  doc = {
    "source": "MBA Course Schedule for Fall Semester 2026 (Academic Affairs Office, 2026-07-02) + MBA Elective Course Syllabuses (English-Instructed)",
    "snapshot": "2026-07-02",
    "files": {
      "schedule": "assets/" + SCHEDULE_PDF,
      "syllabus": "assets/" + SYLLABUS.name,
    },
    "deadlines": [
      {"label": "2nd round add/drop (MBA Intranet)", "from": "2026-09-14T16:00", "to": "2026-09-20T24:00"},
      {"label": "1st withdrawal period (Tsinghua Info), all courses", "from": "2026-10-19T08:00", "to": "2026-10-23T16:00"},
      {"label": "2nd withdrawal period, only courses starting week 9+", "from": "2026-11-16T08:00", "to": "2026-11-20T16:00"},
    ],
    "courses": out,
  }
  OUT.parent.mkdir(exist_ok=True)
  OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
  print("wrote", OUT.relative_to(ROOT), "with", len(out), "courses")


if __name__ == "__main__":
  main()
