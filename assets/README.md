# assets/

Images and sample files used by the planner UI.

- **`highlight_course.png`** — shown inside the "Paste from the course system"
  pop-up (Add / edit courses tab): how to mark and copy a course row in the
  Course registration list. If this file is missing, the pop-up shows a dashed
  placeholder instead — nothing breaks. To use a different file, update the
  `<img src="assets/highlight_course.png">` in `index.html` (inside
  `#pasteModalOverlay`).
- **`export_schedule_xls.png`** — how to export the schedule (Function menu →
  Course registration information query → Class schedule inquiry → Export to XLS).
- **`Curriculum for visiting students in Tsinghua University.xls`** — a sample
  of that XLS export, used as the reference format for the ".xls schedule import".
