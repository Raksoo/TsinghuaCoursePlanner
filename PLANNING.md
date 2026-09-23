# Planung — Tsinghua Course Planner, Ausbaustufe 2

Stand: 2026-09-22. Dieses Dokument ist die Arbeitsgrundlage für die nächsten
Feature-Runden. Jede Phase wird einzeln freigegeben, gebaut, getestet,
committet. **Status: Phase 1–4 umgesetzt, Phase 5 app-seitig fertig — wartet auf den
Portal-Snapshot von Oskar (2026-09-22). Phase 6 offen.**

**Regel für jede Phase — localStorage nicht kaputt machen:** Es gibt bereits
Nutzer der Live-Seite. `STORE_KEY` bleibt `tsinghua-planner-v1`; neue Felder
sind optional und bekommen in `load()` Defaults; nichts wird umbenannt oder
umstrukturiert; `load()` schreibt nie zurück. Vor jedem Push: alten Stand
(ohne die neuen Felder) in den Storage legen, neu laden, prüfen.

**Datenformat:** Alle Datendateien sind JSON unter `data/` und werden per
`fetch()` geladen (`holidays.json` jetzt, später die Kataloge). Ein Format,
ein Loader; Tools schreiben direkt JSON. Lokal deshalb immer über
`python3 -m http.server` (bzw. `.claude/launch.json` → „planner"), nicht
`file://`.

**Leitplanke (gilt für alles):** Das Tool ist ein *Planer*, kein Kalender.
Pipeline = Katalog durchsuchen → Plan bauen → Konflikte/Credits prüfen →
`.ics` exportieren → iOS/Google Calendar übernimmt den Alltag. Alles, was
*während* des Semesters täglich läuft (Erinnerungen, Wegzeiten, private
Termine), ist bewusst außerhalb des Scopes.

---

## 0. Antworten auf die offenen Fragen

### Was ist PWA?

*Progressive Web App* = eine normale Website, die sich per „Zum Home-Bildschirm"
wie eine App installieren lässt: eigenes Icon, startet ohne Safari-Adressleiste
(Vollbild), optional offline nutzbar. Technisch: eine `manifest.json` (Name,
Icon, Farben) plus optional ein *Service Worker* (cached die Dateien für
offline). Für uns relevant ist nur die billige Hälfte: Icon + Vollbild +
Theme-Farbe (ca. 30 Minuten, 3 Dateien). Der Service Worker bringt wenig — die
App braucht ohnehin kein Netz außer beim ersten Laden — und Caching macht
Updates schwerer nachvollziehbar. → Als kleiner Teilschritt in Phase 6 (Mobile)
eingeplant, ohne Service Worker.

### Was sollen „Alternative Sections bei Clash" (G) und „Free-Slot-Finder" (H) sein?

Beides sind Folgefunktionen des Portal-Katalogs (Phase 5), keine eigenen Features:

- **G — Alternative Sections:** Im Portal gibt es Kurse mit gleicher Kursnummer
  und mehreren *Course sequences* (= Parallelgruppen, z. B. `00040172` seq 91
  Mo Block 6 / seq 92 Di Block 6). Wenn die App einen Clash meldet, schaut sie
  im Katalog nach, ob einer der beiden Kurse eine andere Sequence hat, die
  *nicht* kollidiert, und zeigt sie direkt unter der Clash-Meldung an:
  „Alternative: seq 92, Tue Block 6, weeks 1–16 — no clash · [Swap]".
  *Swap* tauscht Zeit/Sequence im Plan. Für die MBA-Kurse (nur eine Gruppe pro
  Kurs) bringt das nichts — es ist ein Portal-Feature.
- **H — Free-Slot-Finder:** Umgekehrte Suche. Statt „welcher Kurs" fragt man
  „was passt noch in meinen Plan?". Im Katalog ein Filter *„Fits my plan"*:
  zeigt nur Kurse, die mit keinem `booked`/`bid`-Kurs überlappen (Tag + Zeit +
  Wochen). Plus optional: Klick auf einen leeren Block in der Week View öffnet
  den Katalog vorgefiltert auf genau diesen Tag/Block.

H ist als Filter fast gratis, sobald der Katalog steht (→ Teil von Phase 5).
G ist ein eigener Schritt mittlerer Größe (→ Phase 5, optional, zuletzt).

### Wie mit Make-up-Days umgehen, ohne Sa/So abzubilden?

Hintergrund: Um den National Day (1.–7. Okt) herum verschiebt die Uni
üblicherweise Unterricht per Aushang („Sat Oct 10 follows Thursday
timetable"). Das steht *nicht* im Academic Calendar, wird meist Ende September
angekündigt und betrifft nur einzelne Tage.

Entscheidung: **Verschiebungen werden pro einzelnem Termin markiert, nicht als
Spalte und nicht als Uni-weite Regel.**

- Am betroffenen Termin (z. B. *Elementary Chinese B*, Fr 2. Okt, Woche 3)
  kann man „Move this meeting" wählen und ein neues Datum eintragen — auch ein
  Samstag oder Sonntag.
- Die Week View bleibt Mo–Fr. Der Termin bleibt an seinem ursprünglichen
  Platz stehen, bekommt aber einen Vermerk „→ moved to Sat Oct 10". So sieht
  man beim Planen weiterhin, wo der Kurs *normalerweise* liegt, und trotzdem,
  dass diese eine Sitzung woanders stattfindet.
- Der ICS-Export erzeugt genau diese eine Sitzung am neuen Datum (mit Hinweis
  „Moved from Thu Oct 1 (National Day)" in der Beschreibung). Das Handy zeigt
  also das Richtige, die Planungsansicht bleibt schmal.
- Nur dieser eine Termin ist betroffen; alle anderen Wochen des Kurses bleiben
  unverändert.

Eine Uni-weite Make-up-Regel („Sa 10. Okt = Donnerstagsplan", automatisch für
alle Kurse) kommt auf den Backlog — sie lässt sich später auf denselben
Override-Mechanismus abbilden, falls die Uni so etwas ankündigt.

---

## 1. Ist-Zustand (kurz, damit nichts doppelt gebaut wird)

Schon vorhanden und im Plan wiederverwendet:

| Vorhanden | Wo | Relevanz für Plan |
|---|---|---|
| Share-Link (`#plan=` base64) + Import beim Laden | `dataShare.js` | Basis für QR-Sync (nice-to-have) |
| Credit-Goal-Balken im Header (`state.goal`) | `summary.js` | Bleibt so; kein weiterer Learning-Agreement-Ausbau |
| XLS-Import des Stundenplan-Exports | `xlsImport.js` | Unabhängig vom Katalog |
| Paste-Parser inkl. `4-6(week 1-16)`-Format | `parser.js` → `slotsFromCode()` | Wird vom Katalog wiederverwendet |
| Toast mit Undo-Aktion (nur für Löschen) | `core.js` `toast()`, `courseList.js` | Muster für globales Undo |
| ICS mit stabilen UIDs (`courseId-slotIdx-wN`), UTC-Konvertierung, Travel-Alarm | `icsExport.js` | Wird erweitert, nicht ersetzt |
| Responsive Ansätze nur für Formular (2 Breakpoints) | `styles.css` Z. 312/313/363/518 | Mobile-Phase baut darauf auf |

Bekannte Lücken im Datenmodell, die *mit* dem Portal-Katalog (Phase 5) gefixt
werden müssen:

1. `weeks` gilt pro Kurs. Portal-Zeilen wie `1-6(week 1-8),2-6(week 9-16)`
   (zwei Meetings mit unterschiedlichen Wochen) sind nicht darstellbar.
   `slotsFromCode()` nimmt aktuell nur den *ersten* Wochenbereich.
2. Kurs-IDs aus Paste/Formular sind Zufalls-IDs. Für Katalog-Kurse braucht es
   deterministische IDs (`number-seq`), damit Export-UIDs auch nach
   Neu-Import stabil bleiben.

---

## 2. Reihenfolge (Roadmap)

| Phase | Feature | Warum an dieser Stelle | Aufwand |
|---|---|---|---|
| 1 ✅ | **Undo/Redo** | Klein, berührt alle Mutationsstellen — danach hängt jeder weitere Bulk-Eingriff (Katalog-Add, Import) automatisch am Undo | S |
| 2 ✅ | **Feiertage + verschobene Termine** | Eigenständige Feiertags-„Datenbank" + Termin-Overrides; Kurse bleiben unberührt. ICS (Phase 3) fragt nur zwei Helfer ab | S–M |
| 3 ✅ | **ICS-Export verbessern** | Baut direkt auf Phase 2 auf | M |
| 4 ✅ | **Katalog a) MBA-Kurse** | Kuratierte Daten aus den beiden PDFs + neuer Tab; die UI entsteht hier | M |
| 5 ◐ | **Katalog b) Portal-Crawl** | Scraper-Snippet, Merge, dann H (Fits-my-plan) und optional G (Alternative Sections) | M–L |
| 6 | **Mobile** | Zuletzt, damit der neue Katalog-Tab gleich mitbehandelt wird und keine Doppelarbeit entsteht | M–L |

Aufwand: S = eine kurze Session, M = eine lange Session, L = mehrere Sessions.
Reihenfolge ist tauschbar — einzige harte Abhängigkeiten: 2 → 3, 4 → 5, und
Phase 6 sollte nach 4 kommen.

---

## 3. Must-have-Features im Detail

### Phase 1 — Undo/Redo ✅ (umgesetzt 2026-09-22)

Umgesetzt wie geplant: `js/history.js` mit `commit()/undo()/redo()`, Buttons
↶ ↷ neben dem „?" im Header, ⌘Z/⌘⇧Z (Ctrl+Z/Ctrl+Y), alle acht
Mutationsstellen umgestellt, `confirm()` beim Löschen entfernt.

**Ziel.** Jede Änderung am Plan (nicht: Ansichtseinstellungen) ist per Klick
oder ⌘Z rückgängig zu machen; Redo per ⌘⇧Z.

**Design-Entscheidungen.**
- *Snapshot-Stack, kein Command-Pattern.* Der Plan ist klein (< 100 Kurse); ein
  Stack aus vollständigen Kopien von `state.courses` (max. 50 Einträge) ist
  einfacher und fehlerärmer als invertierbare Operationen. Entspricht auch der
  Immutability-Regel: `state.courses` wird immer als Ganzes ersetzt, nie
  in-place mutiert.
- *Nur im Speicher, nicht in `localStorage`.* Reload leert die History. Klar
  im Tooltip kommuniziert. Vorteil: Storage-Format bleibt unverändert, Nutzer
  mit altem Stand sind nicht betroffen.
- *Was ist undo-fähig:* Kurs speichern/ändern, löschen, Statuswechsel in der
  Liste, Archiv-Restore/-Delete, Bulk-Add (Paste, XLS, später Katalog),
  JSON-Import, Reset, Laden aus Share-Link. *Nicht:* Wochenwahl,
  Sichtbarkeits-Toggles, Credit-Goal, Sortierung.
- *UI:* ein „↶ Undo"-Button (mit Redo daneben) in der Leiste über der Week View
  und der Course List, disabled wenn leer; Tooltip zeigt das Label der letzten
  Aktion („Undo: Deleted 'Firm Valuation'"). Jede Mutation zeigt weiterhin den
  Toast mit Undo-Aktion (bestehendes Muster). Tastatur: ⌘Z / Ctrl+Z, ⌘⇧Z /
  Ctrl+Y — nur wenn der Fokus nicht in einem Eingabefeld liegt.

**Umsetzung.**
1. Neue Datei `js/history.js`: `commit(nextCourses, label)`, `undo()`,
   `redo()`, `canUndo()/canRedo()`, `renderUndoButtons()`. `commit` legt den
   *alten* Zustand auf den Stack, setzt `state.courses = nextCourses`, ruft
   `save()` + `renderAll()`, leert den Redo-Stack.
2. Alle Mutationsstellen auf `commit()` umstellen (aktuell 8 Stellen:
   `main.js` Save-Handler, `courseList.js` Delete + Statuswechsel,
   `archive.js` Restore/Delete, `form.js` Bulk-Add, `dataShare.js` Import /
   Hash-Import / Reset). Alle Stellen erzeugen dabei neue Arrays statt
   `push`/`splice`.
3. Das bestehende Spezial-Undo in `deleteCourseWithConfirm` durch das
   generische ersetzen. `confirm()`-Dialog beim Löschen kann dann entfallen —
   Undo ist die bessere Absicherung.
4. Buttons in `index.html` (Week-View-Leiste + Course-List-Leiste),
   Keyboard-Handler in `main.js`, Load-Order: `history.js` nach `core.js`.

**Akzeptanz.** Kurs löschen → Undo → Kurs ist zurück, an alter Position, mit
gleicher ID. Paste mit 5 Kursen → ein Undo entfernt alle 5. Redo nach Undo
stellt wieder her. Neue Mutation nach Undo leert Redo. ⌘Z in einem Textfeld
löst *kein* Plan-Undo aus.

---

### Phase 2 — Feiertage + verschobene Termine ✅ (umgesetzt 2026-09-22)

Umgesetzt wie unten beschrieben, mit zwei Abweichungen: Feiertage liegen in
`data/holidays.json` (JSON, nicht JS — s. Datenformat-Regel oben), und die
betroffenen Seed-Kurse sind die Chinesisch-Kurse (Fr), nicht Leadership.
Der ICS-Export liest die Overrides noch **nicht** — das ist Phase 3.

**Designprinzip: eigenständig, ohne die Kurse anzufassen.** Das Feature
besteht aus zwei Datenquellen, die *neben* den Kursen liegen und nur über
Datum bzw. (Kurs, Meeting, Woche) mit ihnen verknüpft werden:

1. **Feiertags-„Datenbank"** — statische Datei, die ich beim ersten Mal von
   Hand aus dem Academic Calendar pflege. Kein Kurs weiß etwas davon.
2. **Termin-Overrides** — kleine Tabelle im `state`, in der einzelne Sitzungen
   als „verschoben" markiert sind. Auch hier: die Kursobjekte (`weeks`,
   `slots`) bleiben exakt, wie sie sind.

Damit ist das Feature ein reiner *Overlay* über der bestehenden Logik: Grid,
Clash-Erkennung, Liste, Credits funktionieren ohne Änderung weiter; nur
Darstellung und ICS-Export lesen die zwei Quellen zusätzlich.

**Datenlage (aus `assets/Tsinghua academic calendar.png`).** Woche 1 = Mo
14. Sep 2026, Woche 18 endet 17. Jan 2027. Vorlesungsfreie Tage im Semester:

| Datum | Wochentag | Semesterwoche | Anlass |
|---|---|---|---|
| 25. Sep 2026 | Fr | 2 | Mid-Autumn Festival |
| 1.–2. Okt 2026 | Do, Fr | 3 | National Day |
| 5.–7. Okt 2026 | Mo–Mi | 4 | National Day |
| 1. Jan 2027 | Fr | 16 | New Year |

**Beobachtung aus dem MBA-Schedule-PDF.** Die MBA-Kurse lassen Woche 4
aus (`Week 1-3,5`) — der National Day ist dort schon eingepreist. Die
Chinesisch-Kurse (Language Centre, Fr 13:30, Woche 1–12) dagegen treffen
Fr 25. Sep und Fr 2. Okt. Regel daraus: **Die App verändert nie selbst
Kursdaten oder löscht Termine. Sie markiert, warnt, und lässt den Export den
Tag überspringen.** Ob nachgeholt wird, weiß nur der Dozent — deshalb der
manuelle „Move this meeting"-Mechanismus.

**Datenformat.**

```js
// data/holidays.json — per fetch() geladen; ein Eintrag pro Tag, damit
// Lookups trivial sind.
{ "semester":"2026-2027 Autumn", "source":"…", "updated":"2026-09-22",
  "holidays":[ { "date":"2026-09-25", "name":"Mid-Autumn Festival" },
               { "date":"2026-10-01", "name":"National Day" }, /* … */
               { "date":"2027-01-01", "name":"New Year" } ] }

// state.overrides — pro verschobener Sitzung ein Eintrag; Schlüssel ist
// courseId|slotIdx|week, damit die Kursobjekte selbst unverändert bleiben.
state.overrides = {
  "seed-chinese|0|3": { movedTo:"2026-10-10", start:"13:30", end:"16:05", note:"" }
};
```

`movedTo` darf jeder Kalendertag sein (auch Sa/So). `start/end` sind
optional (Default = die Slot-Zeit), falls die Nachholsitzung eine andere
Uhrzeit hat. Ein Eintrag ohne `movedTo` (nur `note`) ist zulässig — z. B.
„fällt aus, keine Nachholung" — und wird im Export ebenfalls übersprungen.

**Helfer** in `js/calendar.js` (neu, Load-Order nach `history.js`):
`holidayOn(week, day)` → Feiertagsname oder `null`; `overrideFor(courseId,
slotIdx, week)`; `setOverride()/clearOverride()` (über `commit()` aus
Phase 1, damit Undo greift); `affectedMeetings()` → Liste aller Sitzungen
über das Semester, die auf einen Feiertag fallen oder verschoben sind (für
die Info-Box). Kein allgemeiner Termin-Generator — die bestehende Schleife
`parseWeeks × slots` bleibt, wo sie ist.

**Week View.**
- Feiertag: Spaltenkopf bekommt Zusatz „Oct 1 · National Day", die Spalte
  wird leicht getönt/schraffiert. Kurse an diesem Tag werden weiter
  gezeichnet, aber gedimmt, mit Badge „Holiday — no class". Nicht
  ausblenden — sonst sucht man den Kurs.
- Verschobene Sitzung: bleibt an ihrem normalen Platz, gestrichelter Rahmen,
  Badge „→ Sat Oct 10". Tooltip nennt Datum, Uhrzeit, Notiz.
- Bedienung: In der Einzelwochen-Ansicht hat jede Sitzung einen kleinen
  „Move…"-Link im Event-Kasten (nur bei Hover/Fokus sichtbar, damit das Grid
  ruhig bleibt). Klick öffnet ein Mini-Modal: Datum (`<input type="date">`),
  optional Uhrzeit, Notiz, Buttons „Save" / „Clear move". Zusätzlich hat jede
  Zeile in der Info-Box (s. u.) denselben Link — das ist der Weg, den man bei
  Feiertagen tatsächlich nimmt.
- Wochenauswahl: Optionstext mit Hinweis, z. B. „Week 4 · Oct 5 – 11 ·
  holiday Mon–Wed". Betrifft 4 von 18 Wochen.
- „All weeks"-Ansicht: keine Feiertagsdarstellung (ist datumslos); verschobene
  Sitzungen erscheinen dort nicht extra.
- Clash-Erkennung: unverändert. Sie arbeitet auf wöchentlichen Slots; ein
  Clash am 1. Okt ist eine Warnung für den Normalfall und darf stehen bleiben.

**Info-Box „Holidays & moved meetings"** unter der Clash-Box: alle Sitzungen
aus `affectedMeetings()`, z. B. „Elementary Chinese B — Fri Oct 2 (week 3)
is National Day. [Move this meeting…]" bzw. „… moved to Sat Oct 10 19:00
[Edit] [Clear]". Leer → Box versteckt. Das ist die eigentliche Planungshilfe:
eine Liste dessen, was man beim Dozenten klären muss.

**Print View:** Spaltenkopf-Hinweis + Dimmen wie in der Week View; Badge
„moved → …" im Kärtchen. Kleiner Eingriff in `printView.js`.

**Storage/Kompatibilität:** `state.overrides` ist ein neues, optionales Feld
(Default `{}`); `load()` ergänzt es, wenn es fehlt. Share-Link und JSON-Export
nehmen es mit, damit Verschiebungen mitgeteilt werden können. Alte Links ohne
das Feld laden weiter.

**Umsetzung.**
1. `data/holidays.json` anlegen (Daten), `js/calendar.js` (Helfer +
   `loadHolidays()`), in `index.html` einbinden.
2. `weekView.js`: Spaltenkopf/Tönung, Event-Badges, „Move…"-Link, Info-Box.
3. Mini-Modal für Verschieben in `index.html` + Handler in `main.js`.
4. `printView.js`: Markierung übernehmen.
5. `styles.css`: `.dayhead.holiday`, `.daycol.holiday`, `.ev.on-holiday`,
   `.ev.moved`, Badge-Styles.
6. `core.js`: `state.overrides` mit Default; `dataShare.js`: im Share-Link
   und JSON mitführen.
7. Seed-Kurs *Leadership* auf `weeks: "1-3,5-16"` korrigieren (laut
   MBA-PDF; die Notiz zum Widerspruch entfällt). Erledigt den offenen Punkt
   aus `CLAUDE.md`.

**Akzeptanz (geprüft 2026-09-22).** Woche 4 zeigt Mo–Mi getönt mit
„National Day"; Woche 2 Fr „Mid-Autumn"; Woche 16 Fr „New Year". Elementary
Chinese B steht in der Info-Box mit Fr 25. Sep und Fr 2. Okt. „Move this
meeting" auf Sa 10. Okt → Event in Woche 3 bleibt am Freitag stehen, mit
Badge „→ Sat Oct 10 13:30–16:05"; Undo entfernt die Verschiebung. Das
Kursobjekt bleibt unverändert. Alter Storage-Stand ohne `overrides` lädt.

---

### Phase 3 — ICS-Export verbessern ✅ (umgesetzt 2026-09-22)

Umgesetzt: Punkte 1–3 und 5–9 unten (Feiertage übersprungen, Overrides am
neuen Datum mit gleicher UID, Share-Sheet auf Mobile mit Download-Fallback,
`SEQUENCE`/`LAST-MODIFIED` über `state.icsSeq`, `X-WR-CALNAME`, Default nur
`booked` + „Booked only"-Button, optionaler Reminder, Kursnummer in der
Beschreibung, Dateiname mit Wochenbereich, `CATEGORIES`). Neu dazu: eine
Live-Zeile „34 events · 1 skipped (holidays) · 1 moved" im Modal. Punkt 4
(deterministische IDs) kam mit Phase 4. **Offen: Test auf dem echten iPhone**
(Share-Sheet → Kalender) durch Oskar — die Emulation kann das nicht.

**Ziel.** Die Übergabe an den Kalender ist der Punkt, an dem das Tool aufhört —
sie muss auf dem iPhone in zwei Taps funktionieren, keine Feiertags-Termine
erzeugen und bei erneutem Export keine Duplikate hinterlassen.

**Was heute schon gut ist:** UTC-Konvertierung (Beijing = UTC+8, kein DST),
stabile UIDs, Wochenbereich + Kurs-Auswahl, optionale Beschreibungsfelder,
Travel-Alarm.

**Änderungen, nach Nutzen sortiert.**

1. **Feiertage und Verschiebungen respektieren** (Phase 2). Pro Termin
   fragt `buildICS()` zwei Helfer: `holidayOn()` → Termin überspringen
   (Modal-Schalter „Skip holiday dates (Sep 25, Oct 1–7, Jan 1)", *an* per
   Default, mit Live-Zähler „3 meetings skipped"); `overrideFor()` → Termin
   am `movedTo`-Datum statt am Normaltermin erzeugen, Beschreibung „Moved
   from Thu Oct 1 (National Day)". Gleiche UID wie der Normaltermin, damit
   ein späterer Export ohne Verschiebung ihn wieder ersetzt.
2. **Mobile-Übergabe.** Auf iOS Safari landet ein `<a download>` in „Dateien",
   nicht im Kalender. Lösung: wenn `navigator.canShare({files})` verfügbar ist
   (iOS 15+, Android Chrome), das Share-Sheet öffnen → dort erscheint direkt
   „Kalender"/„Add All". Desktop behält den Download. Muss auf dem echten
   iPhone getestet werden — Emulation reicht hier nicht.
3. **Update statt Duplikat.** `SEQUENCE:<n>` pro Event, wobei `n` ein
   Export-Zähler in `state` ist (`state.icsSeq`, wird pro Export erhöht), plus
   `LAST-MODIFIED`. Kalender, die UIDs respektieren (Google, Outlook), ersetzen
   dann den alten Termin. Apple Calendar dedupliziert beim Datei-Import *nicht*
   zuverlässig — deshalb zusätzlich im Modal der Hinweis: „Import into a
   dedicated calendar (e.g. 'Tsinghua'). To update, delete that calendar and
   re-import." Das ist ehrlich und funktioniert überall.
4. **Deterministische IDs für Katalog-Kurse** (`number-seq`, Phase 4/5), damit
   UIDs auch nach Reset/Neu-Import identisch bleiben.
5. **Kalender-Metadaten:** `X-WR-CALNAME:Tsinghua Fall 2026`,
   `X-WR-TIMEZONE:Asia/Shanghai`. Erzeugt beim Import einen benannten Kalender
   statt „Unbenannt".
6. **Default-Auswahl:** nur `booked` vorausgewählt; `bid`/`option` sind
   abwählbar sichtbar mit Hinweis. Exportiert man Optionen, landen im Kalender
   Kurse, die man nie belegt — der häufigste Fehler.
7. **Optionaler Reminder** („Alert 15 min before", Default aus) unabhängig
   vom Travel-Block. Das ist noch Übergabe, kein Kalender-Ersatz: der Kalender
   zeigt den Alarm, die App hat ihn nur mitgeschickt.
8. **Beschreibung:** Kursnummer + Sequence mit aufnehmen (heute fehlt die
   Nummer), damit man im Kalender-Termin den Kurs eindeutig wiederfindet.
9. Kleinigkeiten: Dateiname mit Wochenbereich (`tsinghua-w1-18-2026-09-22.ics`),
   `CATEGORIES:` = Status.

**Nicht gemacht (bewusst):** RRULE-basierte Serientermine (Wochenlücken +
Feiertage machen Einzeltermine robuster); `METHOD:CANCEL` zum Entfernen
gelöschter Kurse (wird von Importern nicht umgesetzt); Webcal-Abo (bräuchte
einen Server je Nutzer).

**Umsetzung.** `icsExport.js` (Holiday-/Override-Abfrage, Share-Sheet,
neue Properties), `index.html` (Modal: Holiday-Schalter, Reminder, Hinweistext,
Defaults), `core.js` (`state.icsSeq`), `main.js` (Handler). Verifikation:
`buildICS()` per Playwright aufrufen und die Ausgabe auf Feiertagsdaten prüfen;
Import-Test in macOS Calendar + Google Calendar; iPhone-Test durch Oskar.

**Akzeptanz.** Export Woche 1–18 der Seed-Kurse enthält keinen Termin am
1. Okt; Zähler im Modal stimmt; erneuter Export hat `SEQUENCE` um 1 höher;
auf dem iPhone öffnet sich das Share-Sheet mit Kalender-Option.

---

### Phase 4 — Katalog a) MBA-Kurse (kuratiert) ✅ (umgesetzt 2026-09-22)

Umgesetzt: `tools/build-mba-catalog.py` (pdfplumber liest die
Syllabus-Kopfdaten; Stundenplan, Kurzbeschreibungen und Notizen sind im
Skript von Hand transkribiert) → `data/catalog-mba.json` (15 Kurse, inkl.
Add/Drop-Fristen) → Tab „Catalog" (`js/catalog.js`): Suche, Programm-/
Wochentag-Filter, **„Fits my plan" (= H)**, „Hide courses in my plan",
Karten mit Clash-Hinweis, aufklappbaren Details und Syllabus-Link auf die
Seite. „Add to plan" → Status Option, `id = cat-<number>`, `catalogRef`.
Abweichungen vom Plan: keine Mehrfachauswahl (Undo macht Einzel-Adds billig),
keine Seed-Migration (Erkennung läuft über die Kursnummer). Beim Kuratieren
gefunden: Syllabus sagt 2 CP für Digital Economy (Seed: 1), und die Dozenten
der beiden oberen Chinesisch-Kurse sind zwischen Schedule und Syllabus
vertauscht — beides steht als Notiz am Kurs.

**Quellen.**
- `assets/26Fall_MBA Course Schedule_20260702_Exchange stdudents.pdf` — 1 Seite,
  Wochenplan: Zeiten, Räume, Wochen, Dozent für 16 Kurse (inkl. 3 Chinesisch-
  Kurse). Enthält außerdem die Add/Drop-Fristen (2. Runde 14.–20. Sep,
  Withdrawal 19.–23. Okt und 16.–20. Nov).
- `assets/2026 Fall Elective Course Syllabuses (English-Instructed) - Exchange
  student.pdf` — 54 Seiten, 15 Kurse, strukturierte Kopfdaten: Kursnummer,
  Titel CN/EN, Credits, Voraussetzungen, Sprache, Prüfungsform, Dozent +
  E-Mail, Beschreibung, Seitenzahl im PDF.

Text-Extraktion mit `pdfplumber` funktioniert sauber (beide getestet). Die
Daten werden **einmalig von Hand/skriptgestützt kuratiert**, nicht zur
Laufzeit geparst — die PDFs ändern sich nicht mehr.

**Bekannte Inkonsistenzen, die beim Kuratieren entschieden werden müssen:**
- *Frontiers of Chinese Contemporary Issues Research* (Schedule) vs. *Frontier
  Economic Issues in China* (Syllabus), Nummer 60510371 — gleicher Kurs;
  Schedule-Titel als Anzeigename, Syllabus-Titel als Alias.
- *Leadership* Wochen `1-3,5-16` (Schedule) — Seed in Phase 2 angepasst ✅.
- Zeitangaben im Schedule (`8:00-11:25`, `13:30-16:55`, `19:00-22:00`) sind
  Custom-Times, keine Standardblöcke → `slots` mit `start/end` ohne `block`.
- Chinesisch-Kurse haben keine Syllabus-Kopfdaten (Nummer, Credits) — Seed
  hat `64203022`/2 CP für Elementary B; die anderen beiden bleiben ohne Nummer,
  Credits laut Kenntnis (Oskar prüft).

**Datenformat.** `data/catalog-mba.json`:

```json
{
  "source": "MBA Course Schedule 2026-07-02 + Elective Syllabuses",
  "snapshot": "2026-07-02",
  "courses": [{
    "key": "80516081",            // Kursnummer; Sequence unbekannt → ohne
    "titleEn": "Business Marketing Management",
    "titleCn": "实战的市场营销管理",
    "number": "80516081", "credits": 1,
    "instructor": "ZHANG Fan", "email": "…",
    "dept": "School of Economics and Management", "lang": "English",
    "program": "MBA",              // oder "MiM" / "MoF" (Course of …)
    "room": "Rm. A209, Jianhua Bldg.",
    "weeks": "6-9",
    "slots": [{ "day": 1, "start": "13:30", "end": "16:55" }],
    "prereq": "No", "assessment": "case analysis (report)",
    "description": "…erste 2–3 Sätze…",
    "syllabusPage": 2,
    "notes": "Only a few seats for MiM/MoF courses open to MBA."
  }]
}
```

**UI — neuer Tab „Catalog"** (5. Tab, zwischen *Add / edit* und *Data*):
- Suchfeld (Titel EN/CN, Nummer, Dozent), Filter-Chips: Programm (MBA / MiM /
  MoF / Chinese), Wochentag, „Fits my plan" (Phase 5, hier schon als Chip mit
  einfacher Overlap-Prüfung möglich).
- Ergebnis als Karten (nicht Tabelle — funktioniert später auf Mobile ohne
  Umbau): Titel, Dozent, Zeit/Wochen, Raum, CP, Programm-Badge; aufklappbar
  für Beschreibung/Prüfung/Voraussetzungen; Link „Syllabus p. 2" öffnet das
  PDF aus `assets/` an der Seite (`#page=2`).
- Button **Add to plan** → Kurs mit Status `option`, `id` = `cat-80516081`
  (deterministisch), `catalogRef: { source:"mba", key:"80516081" }`. Ist der
  Kurs bereits im Plan: Badge „In plan · Booked" + Button „Show in list".
  Mehrfach-Auswahl + „Add selected" für den ersten Durchlauf.
- Bereits-im-Plan-Erkennung über `catalogRef.key` *oder* gleiche Kursnummer
  (Seed-Kurse haben keine `catalogRef`).
- Hinweisleiste oben: Snapshot-Datum + „Times/rooms may change — the official
  schedule wins."

**Umsetzung.**
1. Kurationsskript `tools/build-mba-catalog.py` (pdfplumber, einmalig) →
   erzeugt `data/catalog-mba.json`; danach manuelle Korrektur der o. g.
   Inkonsistenzen. Skript wird committet, damit der Weg nachvollziehbar ist.
2. `js/catalog.js`: Laden per `fetch("data/catalog-mba.json")` beim ersten
   Öffnen des Tabs (lazy), Suche/Filter, Karten-Rendering, Add-Logik über
   `commit()` (Phase 1).
3. `index.html`: Tab + Panel; `styles.css`: Karten, Chips.
4. `core.js`: `catalogRef` im Datenmodell dokumentieren; Seed-Kurse bekommen
   `catalogRef` nachträglich beim Laden, wenn Nummer im Katalog gefunden wird
   (leichter Migrationsschritt in `load()`).
5. `file://`-Fallback: `fetch` auf lokale Dateien scheitert in Chrome bei
   `file://`. Für lokales Entwickeln `python3 -m http.server` (steht schon in
   CLAUDE.md); im Tab bei Fehler ein klarer Hinweis statt leerer Liste.

**Akzeptanz.** Alle 16 Kurse aus dem Schedule sind im Tab; Suche nach „LU Yao"
findet *Firm Valuation*; *Add to plan* legt den Kurs als Option an und die
Week View zeigt ihn in Woche 1 Di 13:30; ein zweites *Add* ist blockiert;
Undo entfernt ihn wieder.

---

### Phase 5 — Katalog b) Portal-Crawl ◐ (App-Seite umgesetzt 2026-09-22)

Umgesetzt: `tools/portal-scrape.js` (Konsolen-Skript, Fetch-Strategie; liest
das eingebettete `var gridData = […]`-Array statt HTML zu parsen — der Dump
zeigte, dass die Seite die Tabelle so ausliefert; Resume über
`sessionStorage`, Test-Modus `thuScrape({pages:3})`), `slot.weeks`
(Parser, Grid, Clashes, ICS, Feiertage, Formular-Feld „Weeks (this
meeting)"), Merge beider Quellen in `catalog.js` (Portal-Zeile mit gleicher
Kursnummer ergänzt den MBA-Eintrag um Sequence/Remarks), Filter Source /
Department / Block, `Restricted:`/`Priority:`-Übersetzung der Remarks-Präfixe,
„Show more" ab 120 Karten. Getestet mit den 20 Zeilen aus dem HTML-Dump.
**Offen:** Oskar führt das Skript aus → `data/catalog-portal.json` committen;
danach prüfen, ob G (Alternative Sections) sich lohnt (wie viele Kursnummern
haben mehrere Sequences?). Die DOM-Fallback-Strategie wurde nicht gebaut —
erst, falls die Fetch-Variante am echten Portal scheitert.

**Rahmen.** Portal `zhjwe.cic.tsinghua.edu.cn`, Funktion *Query courses open
this semester* (`xkJxs.vxkJxsXkbBs.do?m=jxsKkxxSearch`): 5.032 Datensätze,
252 Seiten à 20. Login-geschützt, CORS-gesperrt → **kein Live-Zugriff aus der
App**. Der Katalog ist ein *Snapshot*, den Oskar selbst zieht.

Aus dem HTML-Dump bekannt:
- Formularfelder: `p_xnxq` (Semester), `p_kkdwnm` (Department), `p_kch`
  (Nummer), `p_kcm` (Titel), `p_xm` (Dozent), `p_skxq` (Wochentag), `p_skjc`
  (Block), `page`, `goPageNumber`, `token`, Sortierfelder `p_sort.*`.
- Tabellenspalten: Titel EN, Titel CN, Nummer, Sequence, Credits, Department,
  Dozent (Link `showJsDetail&p_jsh=…`), Class time (`4-6(week 1-16)`, mehrere
  durch Komma), Course features. **Kein Raum, keine Sprache.**
- Die Trefferliste rendert in einem `iframe name="right"`.

**Scraper — Vorgehen.**
- `tools/portal-scrape.js`: ein Snippet zum Einfügen in die DevTools-Konsole
  *im Iframe-Kontext* der eingeloggten Portal-Seite. Zwei Strategien,
  eingebaut in einem Skript:
  1. *Fetch-Variante:* Formular-POST mit `page=N` nachbauen (Cookies + Token
     kommen automatisch mit, weil same-origin), HTML parsen (`DOMParser`),
     Zeilen extrahieren. 252 Requests, 400 ms Pause → ~2 Minuten.
  2. *DOM-Variante (Fallback):* Aktuelle Tabelle auslesen, „Next" klicken,
     per `MutationObserver` auf neue Tabelle warten, wiederholen. Langsamer,
     aber unabhängig davon, wie der Server das Formular genau erwartet.
- Ergebnis wird als `catalog-portal.json` heruntergeladen (Blob-Download aus
  der Konsole) und von Oskar nach `data/` gelegt und committet.
- Regeln: nur Lesen, eigener Account, gedrosselt, keine personenbezogenen
  Daten außer öffentlich gelisteten Dozentennamen. Dozenten-IDs (`p_jsh`)
  werden *nicht* gespeichert.
- Risiko: Das Snippet kann ich nur gegen den Dump schreiben; die erste echte
  Ausführung wird Iterationen brauchen (Token-Handling, Encoding). Deshalb
  beide Strategien. Ein erster Test mit 3 Seiten vor dem Volllauf.

**Datenformat.** `data/catalog-portal.json`:

```json
{
  "source": "Tsinghua Info portal, Query courses open this semester",
  "snapshot": "2026-09-2x", "semester": "2026-2027 Autumn",
  "courses": [{
    "key": "00040172-92",
    "number": "00040172", "seq": "92",
    "titleEn": "Future Disaster Control", "titleCn": "未来灾害调控",
    "credits": 2, "dept": "Department of Hydraulic Engineering",
    "instructor": "张嘎", "time": "2-6(week 1-16)", "features": ""
  }]
}
```

Grob 1 MB unkomprimiert; GitHub Pages liefert JSON gzip-komprimiert (≈150 KB).
Wird nur geladen, wenn der Katalog-Tab geöffnet wird.

**Merge & Modell.**
- Katalog-Tab zeigt die Vereinigung beider Quellen. Gleiche Kursnummer in MBA-
  und Portal-Datei → ein Eintrag, MBA-Felder (Raum, Beschreibung) gewinnen,
  Portal liefert Sequence(n).
- `time` wird beim Add über `slotsFromCode()` in Slots übersetzt. Dafür
  `slotsFromCode()` erweitern: Wochenbereich *pro Code* behalten →
  optionales `slot.weeks` (Semantik `slot.weeks || course.weeks`, gelesen von
  `renderGrid`, `findClashes`, `weekStrip`, `buildICS`); `course.weeks` =
  Union.
- Formular bekommt pro Meeting-Zeile ein optionales Wochenfeld (klein,
  Placeholder „same as course"), damit importierte Kurse editierbar bleiben.
- IDs `cat-<number>-<seq>`.

**Filter im Tab (zusätzlich zu Phase 4):** Department (Dropdown aus den Daten),
Block, Wochenbereich („runs in week N"), Quelle (MBA-Liste / Portal), und
**„Fits my plan" (= H)**: Overlap-Prüfung gegen alle `booked`/`bid`-Kurse mit
Woche × Tag × Zeit. Bei 5.000 Kursen: Filter erst nach Eingabe, Ergebnis auf
200 Karten begrenzt + „Show more".

**Optional in dieser Phase: G — Alternative Sections.** In `renderClashes()`
pro Clash nachsehen, ob im Katalog eine andere Sequence desselben Kurses
existiert, die mit dem Rest des Plans nicht kollidiert; Vorschlag + „Swap"
(ersetzt Slots/Weeks/Seq, per `commit()` undo-fähig). Erst bauen, wenn der
Snapshot zeigt, dass es genügend Mehrfach-Sequences gibt.

**Aktualisierung.** Snapshot-Datum sichtbar im Tab. Erneuter Lauf des
Snippets = neue Datei = Commit. Kein automatisches „Update my plan from
catalog" — würde manuell korrigierte Räume überschreiben. Stattdessen pro Kurs
mit `catalogRef` ein Hinweis „Catalog says Tue Block 3 — your plan says Tue
Block 4" mit „Take catalog values" (später, wenn Bedarf).

**Akzeptanz.** Snippet liefert 5.032 Zeilen (Zähler gegen Portal-Angabe
geprüft); Tab zeigt Department-Filter; Suche „Disaster" findet 3 Kurse;
„Fits my plan" blendet alles aus, was mit Digital Economy (Mo 8:00–11:25,
W 1–3,5) kollidiert; Add eines Kurses mit zwei Codes erzeugt zwei Slots mit
korrekten Wochen.

---

### Phase 6 — Mobile (Safari auf iPhone), ohne Desktop-Regression

**Befund (375×812, echte Live-Seite, 2026-09-22):** Grundsätzlich benutzbar,
aber:
- Header belegt ~40 % des Bildschirms (Titel, Untertitel, CP-Block, Goal,
  Tabs in *zwei* Zeilen).
- Week View scrollt horizontal, zeigt ~1,7 Tage; man sieht die Woche nie
  auf einmal.
- Course List ist eine 1.320-px-Tabelle → horizontales Scrollen über 4
  Bildschirmbreiten.
- Filter-Chips stapeln sich untereinander (4 Zeilen).
- Formular ist bereits brauchbar (2 Breakpoints vorhanden).
- Now-Badge überlappt Inhalt; Modals sind nicht getestet.

**Grundregel für Null-Desktop-Regression.** Alle Änderungen leben
ausschließlich in `@media (max-width: 640px)` (Phone) und ggf.
`@media (max-width: 900px)` (Tablet/kleines Fenster) — *keine* Änderung an
bestehenden Regeln außerhalb dieser Blöcke. Ausnahme sind additive
Attribute im Markup (`data-label` an `<td>`), die Desktop nicht rendert.
Verifikation: Playwright-Screenshots bei 1280 und 1440 px *vor* und *nach*
jeder Änderung, Pixelvergleich; Abweichung = Fehler.

**Design-Entscheidungen pro Bereich.**
1. **Header:** kompakt — Titel einzeilig kleiner, „6 CP · booked · 4 courses"
   und Goal in *einer* Zeile, Tabs als *eine* horizontal scrollbare Zeile mit
   Kurzlabels (Week · List · Add · Catalog · Data) statt Umbruch. Kein
   Bottom-Tab-Bar (kollidiert mit Now-Badge und iOS-Home-Indicator).
2. **Week View — Kompaktmodus mit 5 Spalten:** alle Tage sichtbar (Gutter
   40 px + 5 × ~65 px), Event zeigt nur Titel (2–3 Zeilen, abgeschnitten) und
   Zeit; Raum/CP entfallen. Tipp auf ein Event öffnet ein **Bottom-Sheet** mit
   allen Details + Button „Edit" — statt direkt ins Formular zu springen.
   Das ist das Muster jeder Stundenplan-App und die einzige Variante, bei der
   man die Woche als Ganzes sieht. Tages-Pager (ein Tag pro Bildschirm) wurde
   verworfen: man will beim Planen Clashes *sehen*.
3. **Course List → Karten:** per CSS die Tabelle in Karten umlegen
   (`tr` als Karte, `td` als Zeile mit `data-label`), Status-Select bleibt
   bedienbar, Weekstrip bleibt. Kein zweiter Renderer.
4. **Filter-Chips:** horizontal scrollbare Zeile.
5. **Modals** (ICS, Print, Paste, XLS, Help): als Sheet von unten,
   `max-height: 100dvh`, obere Ecken rund, Buttons unten fixiert.
6. **Katalog (Phase 4/5):** Karten sind schon mobil; nur Filterzeile
   scrollbar machen.
7. **Katalog auf dem Handy:** Clash-Details und Remarks sind auf dem Desktop
   nur als Tooltip erreichbar (kein Hover auf Touch) → im Detailbereich der
   Zeile ausschreiben; Tabelle als Karten- oder 2-Spalten-Layout, Pager
   bleibt.
8. **iOS-Spezifika:** `font-size ≥ 16px` in Inputs (sonst zoomt Safari beim
   Fokus), `viewport-fit=cover` + `env(safe-area-inset-bottom)` für Badge und
   Sheets, `dvh` statt `vh`, Touch-Ziele ≥ 44 px, `-webkit-tap-highlight-color`.
9. **ICS-Handoff** über Share-Sheet (Phase 3).
10. **PWA light:** `manifest.json` + `apple-touch-icon` + `theme-color`, damit
   „Zum Home-Bildschirm" ein Icon und Vollbild ergibt. Kein Service Worker.
   Erledigt nebenbei das fehlende Favicon.
11. **Print** bleibt unberührt (eigener `@media print`-Block).

**Umsetzung.** Reihenfolge: Header/Tabs → Week View kompakt + Sheet → Liste
→ Modals → iOS-Details → PWA light. Jeder Schritt mit Desktop-Screenshot-Diff.
Neue Dateien: `js/sheet.js` (Detail-Bottom-Sheet, auch von Desktop nutzbar,
dort aber nicht aktiv), `manifest.json`, `assets/icon-*.png`.

**Akzeptanz.** iPhone Safari (Oskar, echtes Gerät): alle fünf Tabs erreichbar
ohne Umbruch; Woche 1 zeigt Mo–Fr auf einem Bildschirm; Tipp auf Digital
Economy öffnet das Sheet; Course List ist ohne horizontales Scrollen lesbar;
ICS-Export öffnet das Share-Sheet; kein Zoom beim Fokus eines Feldes. Desktop
1280/1440: Screenshot-Diff = 0.

---

## 4. Nice-to-have (kurz, aber konkret genug zum Einordnen)

- **Bidding-Helfer.** Für Kurse mit Status `bid`: eine Priorität (1–n) und ein
  optionaler Fallback-Kurs („wenn das Bidding scheitert → Firm Valuation").
  Die App prüft die Fallback-Kette auf Clashes und zeigt eine Tabelle „Best
  case / Worst case" mit CP-Summe. Datenmodell: `bidPriority`, `fallbackId`.
  Aufwand M. Sinnvoll erst, wenn klar ist, wie das Bidding für Exchange
  Students konkret abläuft.
- **Szenarien (Plan A / Plan B).** Mehrere benannte Pläne in `state.plans`,
  Umschalter im Header, Diff-Ansicht („B hat zusätzlich X, ohne Y"). Export
  und Share pro Szenario. Aufwand M; berührt `load()/save()` (Migration von
  `state.courses` → `state.plans[active].courses`). Undo muss szenario-bewusst
  sein.
- **QR-Sync.** Der bestehende Share-Link als QR-Code (kleine Inline-Library
  oder handgeschriebener QR-Encoder, ~200 Zeilen) im Data-Tab; Handy scannt →
  Plan geladen. Aufwand S. Grenze: Link-Länge bei > ~40 Kursen (QR Version 40
  ≈ 2.9 KB) → vorher `lz-string`-Kompression des Hash.
- **Tests.** Playwright-Suite im Repo (`tests/`), Smoke-Flows: Seed laden,
  Kurs anlegen, Clash erkennen, ICS erzeugen (Inhalt prüfen), Katalog-Add,
  Undo, Mobile-Viewport. Plus Desktop-Screenshot-Diff aus Phase 6 als fester
  Test. Aufwand M einmalig, danach spart es jede Session Zeit.
- **Dark Mode.** CSS-Custom-Properties existieren bereits (`--ink`, `--card`,
  `--line`…) → `@media (prefers-color-scheme: dark)` mit zweitem Token-Satz +
  manueller Schalter. Statusfarben brauchen eigene Dark-Varianten. Print
  bleibt hell. Aufwand S–M.

## 5. Backlog (eine Liste für alles Aufgeschobene)

Offen, noch nicht eingeplant — sortiert nach Nähe zum Scope:

- **ICS respektiert Overrides/Feiertage** — kommt mit Phase 3, bis dahin
  exportiert der Kalender verschobene Sitzungen noch am Normaltermin.
- **Feiertage per UI anlegen** (unter *Data & sharing*), gespeichert als
  `state.holidaysExtra` im selben Format wie `data/holidays.json`; bis dahin
  ist die JSON-Datei die einzige Quelle.
- **Uni-weite Make-up-Regel** („Sa 10. Okt = Donnerstagsplan") — würde beim
  Aktivieren automatisch Overrides für alle betroffenen Sitzungen anlegen;
  nutzt denselben Mechanismus wie Phase 2.
- **Katalog: „Take catalog values"** pro Kurs mit `catalogRef`, wenn Snapshot
  und Plan auseinanderlaufen (siehe Phase 5, Abschnitt Aktualisierung).
- **G — Alternative Sections bei Clash** (Phase 5, optional). Vorstufe:
  Badge „N sections" an Katalogzeilen mit mehreren Sequences (427
  Kursnummern im Snapshot), Klick filtert auf die Nummer.
- **Katalog: Default-Sortierung** (MBA zuerst, dann Portal nach Nummer) —
  Alternative alphabetisch; offen.
- **Klick auf leeren Block → Katalog vorgefiltert** (H, Ausbaustufe).
- **Undo-History über Reload hinweg** (sessionStorage) — nur falls es im
  Alltag stört, dass ⌘Z nach einem Reload leer ist.
- Nice-to-haves aus Abschnitt 4: Bidding-Helfer, Szenarien, QR-Sync, Tests,
  Dark Mode.

Verworfen (nicht wieder vorschlagen):

- **Learning-Agreement-Tracker** — der vorhandene Credit-Goal-Balken bleibt,
  wird aber nicht ausgebaut.
- **Drag & Drop / Resize in der Week View** — Kurszeiten sind fix; ohne
  persönliche Blöcke gibt es nichts Sinnvolles zu verschieben.
- **Persönliche Blöcke, Benachrichtigungen, Wegzeit-Warnungen, Prüfungs-
  termine als eigene Verwaltung** — Kalender-Territorium, außerhalb des Scopes.
- **Webcal-Abo statt Datei-Import** — bräuchte pro Nutzer eine gehostete Datei;
  nur für Oskar selbst machbar (eigene `.ics` im Repo). Bei Bedarf als
  Einzelfall-Lösung.

## 6. Querschnitt

- **Doku:** `CLAUDE.md` und `README.md` nach jeder Phase nachziehen (Modul-
  liste, Datenmodell mit `overrides`/`slot.weeks`/`catalogRef`, Load-Order, neue `data/`-
  und `tools/`-Verzeichnisse). `CLAUDE.md` ist heute schon hinter dem Code
  (Share-Link, Goal, XLS-Import fehlen dort).
- **Storage-Kompatibilität:** Kein Feature ändert das Format bestehender
  Felder; neue Felder sind optional. Nutzer mit bereits geteilten Links
  behalten ihre Daten. Falls doch eine Migration nötig wird (Szenarien), über
  `STORE_KEY`-Version + Migrationsfunktion in `load()`.
- **Deployment:** unverändert `git push` → GitHub Pages. `data/` und `tools/`
  werden mit ausgeliefert (JSON muss öffentlich sein, Scraper-Skript ist
  harmlos).
- **Load-Order nach allen Phasen:** `core.js` → `history.js` →
  `calendar.js` → `parser.js` → `weekView.js` → `summary.js` → `courseList.js` →
  `archive.js` → `form.js` → `catalog.js` → `sheet.js` → `icsExport.js` →
  `printView.js` → `dataShare.js` → `main.js`.
