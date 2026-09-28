# Planung — Tsinghua Course Planner, Ausbaustufe 3

Stand: 2026-09-28 (Phasen 0–6 fertig). Vorgänger: `_Archive/PLANNING-v1-2026-09-22.md` (Phasen 1–6
der Ausbaustufe 2; untracked, aber in der Git-Historie unter `PLANNING.md`).

Diese Datei ist die einzige Roadmap. Sie enthält **alle offenen Punkte**: die
Reste aus Ausbaustufe 2 (Abschnitt 1) und die neuen Features (Abschnitte 3–8).

> **Grundsatzentscheidung 2026-09-28 — Portaldaten werden nicht veröffentlicht.**
> Der Kurskatalog des Info-Portals liegt hinter einem Login. Was hinter einem
> Login liegt, hat die Universität bewusst nicht veröffentlicht; ob die
> Nutzungsbedingungen eine Weiterveröffentlichung erlauben, ist ungeklärt, und
> diese Entscheidung steht uns nicht zu. **`data/catalog-portal.json` und alle
> Detaildaten bleiben deshalb dauerhaft gitignored.** Geteilt wird der
> *Scraper*, nicht die *Daten*: jede:r zieht den Snapshot mit dem eigenen Login
> selbst und legt ihn im eigenen Browser ab (IndexedDB, Abschnitt 3).
> Committet wird nur, was wir selbst erstellt haben — die 15 kuratierten
> MBA-Kurse, Feiertage, Department-Namen.

---

## 0. Kurzantwort auf „Sind die alten Phasen beendet?"

**Nein — 4 von 6 sind fertig.**

| Phase (alt) | Status | Rest |
|---|---|---|
| 1 Undo/Redo | ✅ fertig | — |
| 2 Feiertage + verschobene Termine | ✅ fertig | — |
| 3 ICS-Export | ✅ fertig | iOS-Share-Sheet nie auf echtem iPhone getestet |
| 4 Katalog a) MBA | ✅ fertig | — |
| 5 Katalog b) Portal-Crawl | ◐ **App fertig, Daten kommen nie aus dem Repo** | Snapshot ist lokal da (5.020 Zeilen), darf aber nicht committet werden (siehe Kasten oben) → die Live-Seite braucht einen **Import-Weg pro Nutzer:in** statt einer `fetch()`-Datei. Außerdem: „Alternative Sections" (G) nie gebaut |
| 6 Mobile | ❌ nicht begonnen | komplett |

Die Reste sind unten als **Phase 0** und **Phase 8** eingeplant, nicht
weggeworfen.

---

## 1. Ist-Zustand (was existiert, damit nichts doppelt gebaut wird)

**App (live, GitHub Pages):** Wochenansicht mit Clash-Erkennung, Feiertagen und
verschobenen Terminen; Kursliste + Archiv; Add/Edit-Formular mit Meetings-Editor,
Paste-Modal und `.xls`-Import; Katalog-Tab (MBA-Liste, Suche, Filter, „Fits my
plan", Ein-Klick-Add); ICS-Export; Druckansicht; JSON-Export/Import; Share-Link;
Undo/Redo. Kein Build-Schritt, kein Framework, kein Backend.

**Daten (lokal vorhanden):**

| Datei | Zeilen | Getrackt? | Inhalt |
|---|---|---|---|
| `data/catalog-mba.json` | 15 Kurse | ✅ | kuratiert aus zwei PDFs: Raum, Beschreibung, Prüfung, Syllabus-Seite |
| `data/catalog-portal.json` | **5.020** | ❌ **bleibt gitignored** | Portal-Snapshot 2026-09-22: Titel EN/CN, Nummer, Sequence, Credits, Department, Dozent, Zeit-Code, **features**, Remarks. Nur Oskars lokale Entwicklungskopie |
| `data/departments.json` | 83 | ✅ | Department-Namen |
| `data/holidays.json` | 10 | ✅ | Feiertage im Semester |

**Neu ausgewertet (2026-09-28) — der `features`-Wert ist das fehlende
Sprach-Feld:**

| `features` | Anzahl |
|---|---|
| (leer) | 3.900 |
| **Taught in foreign language** | **438** |
| Practice course | 282 |
| mainly taught in Chinese (bilingual course) | 172 |
| Experiment course | 123 |
| **≥50% taught in foreign language (bilingual course)** | **82** |
| Thematic seminar | 21 |
| Freshman seminar | 2 |

→ **520 Kurse sind auf Englisch belegbar, 692 zumindest teilweise.** Das ist
genau die Teilmenge, die für Austauschstudierende zählt → **Sprachfilter im
Katalog-Tab** (Phase 0, fällt dort fast gratis an). Mit dem Detail-Abruf hat
diese Zahl nichts mehr zu tun (siehe Kasten unten). Weitere Zahlen:
3.648 verschiedene Kursnummern, davon **427 mit mehreren Sequences** (→
„Alternative Sections" lohnt sich), 1.996 Kurse mit mehreren Zeit-Codes,
Dateigröße 1,7 MB roh / 247 KB gzip (→ zu groß für `localStorage`, unkritisch
für IndexedDB).

**Quellen im Info-Portal (`zhjwe.cic.tsinghua.edu.cn`), alle login-gated und
CORS-gesperrt:**

| # | Seite | URL | Liefert |
|---|---|---|---|
| **A** | Query courses open this semester | `xkJxs.vxkJxsXkbBs.do?m=jxsKkxxSearch` | Katalog, 5.033 Zeilen / 252 Seiten. **Kein Raum, keine Beschreibung.** Scraper existiert: `tools/portal-scrape.js` |
| **B** | My timetable (Stundenplan) | `xkJxs.vxkJxsXkbBs.do` | **Meine belegten Kurse + Raum + Wochen**, Gitter 6 Sections × 7 Tage. Noch kein Scraper |
| **C** | Course detail | `xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&p_kch=<nr>&p_kxh=<seq>&p_xnxq=2026-2027-1` | **Credit hours, Testing methods, Textbooks, Reference books, Beschreibung EN + CN.** Erreichbar **nur als Link aus B** (siehe Kasten) |

Belege im Repo: `_Archive/Schedule-Info-Portal/` (HTML-Dump von B +
Screenshots von B und C), `_Archive/Feature_Crawler/` (Dump von A).

> **Verifiziert 2026-09-28 — C hängt an B, nicht an A.** Im Katalog-Dump (A)
> kommt `showKcDetail` **kein einziges Mal** vor; die dortigen Links zeigen auf
> `showJsDetail` (Dozentenprofil) und `showToXs` (ungeprüft, siehe Backlog).
> Die Detailseite ist also nur für die Kurse erreichbar, die im eigenen
> Stundenplan stehen — im Regelfall **5–8 Stück**. Eine frühere Planversion
> ging von konstruierbaren URLs für beliebige Kursnummern aus (692 Seiten);
> das war eine unbelegte Annahme und ist gestrichen. Konsequenz: Der
> Detail-Abruf ist ein **kleiner Nachlauf des Stundenplan-Scrapers**, kein
> eigenes Großvorhaben.

---

## 2. Reihenfolge

| Phase | Feature | Warum hier | Größe |
|---|---|---|---|
| **0** ✅ | Katalog-Import pro Nutzer:in (IndexedDB) | Ersetzt den `fetch()` auf die nicht-committbare Datei. Alles Folgende baut auf einem geladenen Katalog auf | M |
| **1** ✅ | Schedule-Scraper (Quelle B) | Liefert Raum + „was ist wirklich belegt" — die größte Informationslücke | M |
| **2** ✅ | Schedule-Import in der App | Ohne Import nützt der Scraper nichts. Enthält den Abgleich Plan ↔ Portal | M |
| **3** ✅ | Kursdetails zu *meinen* Kursen (Quelle C) | Nachlauf des Stundenplan-Scrapers, ~6 Seiten. Füllt Beschreibung/Prüfungsform im eigenen Plan | **S** |
| **4** ✅ | „Add / edit course" umbauen | Erst sinnvoll, wenn Katalog + Schedule-Import stehen (Punkt 2 des Auftrags) | M |
| **5** ✅ | Scraper von der Planner-Seite starten (Bookmarklet + Übergabe) | Bequemlichkeit; setzt fertige Scraper voraus (Punkt 3 des Auftrags) | M |
| **6** ✅ | Testsuite | Läuft parallel ab Phase 1 mit (TDD), eigener Abschnitt wegen Setup | M |
| **7** | Alternative Sections (Rest aus alt-Phase 5) | Braucht einen importierten Katalog (Phase 0) | S–M |
| **8** | Mobile (alt-Phase 6) | Unverändert offen, zuletzt weil rein kosmetisch | M |

**Regel wie bisher:** Ein Feature ist dann gut, wenn es *Planungsarbeit
abnimmt*. Die App bleibt Planer, kein Kalender — Übergabe an iOS per `.ics`.

---

## 3. Phase 0 — Katalog-Import pro Nutzer:in (IndexedDB) ✅ (umgesetzt 2026-09-28)

**Umgesetzt:** `js/store.js` (IndexedDB `thu-planner-data`, Store `snapshots`,
`snapshotGet/Put/Clear/Available`, `validateCatalogSnapshot` — validiert *vor*
dem Schreiben), `ensureCatalog()` als Drei-Quellen-Kaskade (MBA-Datei →
importierter Snapshot → lokale Dev-Datei), Snapshot-Statuszeile im Katalog-Tab
mit „Update…"/„Remove", Leerzustand mit Ein-Klick-Einstieg, Sprachfilter
„Taught in English" aus `features` (528 Treffer, verifiziert), `data/README.md`
und ein erklärender `.gitignore`-Kommentar. 10 Tests in `tests/store.test.mjs`
+ 6 in `tests/storage.test.mjs`.



**Problem.** `catalog.js` holt den Portal-Katalog heute per
`fetch("data/catalog-portal.json")`. Diese Datei darf nicht ins öffentliche
Repo (Kasten oben) — auf der Live-Seite liefert der Request also 404, und der
Katalog-Tab zeigt seit dem 22.09. nur die 15 MBA-Kurse. Der Weg über eine
ausgelieferte Datei ist damit endgültig tot; der Katalog muss **pro Browser
importiert** werden.

**Prinzip.** Geteilt wird das *Werkzeug*, nicht die *Daten*. Jede:r
Austauschstudent:in hat einen Portal-Login, zieht sich mit demselben
Bookmarklet (Phase 5) den eigenen Snapshot und legt ihn im eigenen Browser ab.
Die Daten verlassen den Browser nie — sie gehen weder an GitHub noch an einen
Server. Das ist datenschutzrechtlich sauberer als der Commit *und* technisch
ehrlicher: der Snapshot ist ohnehin pro Semester verschieden.

### 3.1 Ablage: IndexedDB, getrennt vom Plan

| | Plan | Snapshots |
|---|---|---|
| Wo | `localStorage["tsinghua-planner-v1"]` | **IndexedDB `thu-planner-data`** |
| Was | Kurse, Status, Overrides, Goal, `detail` | nur Katalogzeilen |
| Größe | wenige KB (+ ~15 KB Details) | 1,7 MB |
| Wert | **unersetzlich** (Handarbeit) | jederzeit neu scrapbar |

**Warum nicht `localStorage`:** ~5 MB Gesamtbudget pro Origin, synchron. Ein
1,7-MB-String würde ein Drittel davon fressen, jeden Zugriff blockieren — und
im schlimmsten Fall mit einer Quota-Exception den **Plan** mitreißen. Die
Trennung ist bewusst: ein voller Katalog-Store darf niemals einen Plan
beschädigen.

**Schema** (`js/store.js`, neu, ~80 Zeilen):

```
DB "thu-planner-data", version 1
  objectStore "snapshots"   keyPath: "id"
    { id:"catalog", source, semester, snapshot:"2026-09-22",
      importedAt:"2026-09-28T…", count:5020, rows:[…] }
```

Ein Record pro Quelle, das Array/Objekt direkt gespeichert (structured clone) —
**kein `JSON.parse` beim Lesen**, also kein Parse-Overhead beim Öffnen des
Tabs. API:

```js
snapshotGet(id)          // -> record | null
snapshotPut(id, record)  // ersetzt vollständig
snapshotMeta()           // -> {catalog:{snapshot,count}} für die UI
snapshotClear(id)
```

Alles Promise-basiert, alles in try/catch: **IndexedDB kann fehlen**
(Privatmodus, Safari mit blockierten Website-Daten). Dann läuft die App
unverändert weiter und der Katalog-Tab zeigt „Kein Katalog importiert" —
niemals ein Fehlerdialog.

### 3.2 `catalog.js`: `ensureCatalog()` umbauen

Reihenfolge der Quellen, erste Treffer gewinnt:

1. `fetch("data/catalog-mba.json")` — committet, immer da (15 Kurse).
2. `snapshotGet("catalog")` — der importierte Portal-Snapshot.
3. *Dev-Fallback:* `fetch("data/catalog-portal.json")` — schlägt live mit 404
   fehl (still ignoriert), greift aber auf Oskars lokalem Server. Damit bleibt
   die lokale Entwicklung genau so bequem wie heute, ohne Sonderpfad.

Der Tab bekommt oben eine Statuszeile: *„Portal-Katalog: 5.020 Kurse, Stand
22.09.2026 · [Aktualisieren] [Entfernen]"* bzw. bei leerem Store ein
Hinweis-Panel mit dem Weg zum Bookmarklet (Phase 5).

### 3.3 Import-Wege (UI in *Data & sharing*, verlinkt aus dem Katalog-Tab)

1. **Datei wählen** — die vom Scraper heruntergeladene `catalog-portal.json`.
2. **Direktübergabe** aus dem Bookmarklet per `postMessage` (Phase 5, 8.2).
3. Validierung vor dem Schreiben: `courses` ist ein Array, Pflichtfelder
   `number`/`seq`/`titleEn` vorhanden, `semester` plausibel → sonst
   verständliche Fehlermeldung, Store bleibt unangetastet.
4. Import ersetzt den Snapshot vollständig (kein Merge — ein Snapshot ist ein
   Stand, keine Sammlung).

**Weitergabe unter Kommiliton:innen** ist damit nicht verboten, nur nicht
öffentlich: wer will, schickt die Datei per AirDrop/WeChat weiter. Das ist
private Weitergabe an Personen mit eigenem Portal-Zugang, keine
Veröffentlichung.

### 3.4 Schritte

1. `js/store.js` + Tests (IndexedDB im Test per `fake-indexeddb` oder
   Adapter-Injektion — siehe 9.1).
2. `ensureCatalog()` auf die Drei-Quellen-Kaskade umbauen.
3. Import-UI + Statuszeile + Sprachfilter aus `features` (fällt hier gratis an).
4. `.gitignore` **unverändert lassen** und einen Kommentar ergänzen, *warum*
   (damit es niemand — ich eingeschlossen — später „aufräumt").
5. `data/README.md`: welche Datei woher kommt, was committet wird und was nicht.
6. Cache-Bust `?v=` bumpen.

**Akzeptanz.**
- Frischer Browser, kein Import: App lädt, Katalog-Tab zeigt 15 MBA-Kurse +
  Hinweis, keine Konsolenfehler, kein 404-Dialog.
- Import der 1,7-MB-Datei: < 2 s, danach > 5.000 Zeilen, Department-Dropdown
  83 Einträge, Statuszeile mit Datum.
- Reload: Katalog ist noch da (IndexedDB überlebt), `localStorage`-Plan
  unverändert.
- Privatmodus/IndexedDB blockiert: App funktioniert, Hinweis statt Absturz.
- „Entfernen" leert den Store, der Plan bleibt vollständig erhalten.

**Aufwand:** ~1 Tag. **Risiko:** niedrig, aber höher als der frühere
Commit-Weg — IndexedDB-Fehlerpfade müssen sauber abgefangen werden.

---

## 4. Phase 1 — Schedule-Scraper (Quelle B) ✅ (umgesetzt 2026-09-28)

**Portal-Zugang (korrigiert 2026-09-28):** Das Kurssystem `zhjwe.cic.tsinghua.edu.cn`
hat **keinen eigenen Login** — es vertraut auf die Session von
`info.tsinghua.edu.cn`. Ein zhjwe-Link kalt aufgerufen schlägt fehl. Der
Dialog führt deshalb zuerst zum Login
(`https://info.tsinghua.edu.cn/f/info/gxfw_fg/common/index`) und erst danach
zur Seite. Direktlinks (beide von Oskar bestätigt):
- Stundenplan: `…/xkJxs.vxkJxsXkbBs.do?url=/xkJxs.vxkJxsXkbBs.do&m=kbSearchforPortal`
- Katalog: `…/xkJxs.vxkJxsXkbBs.do?url=/xkJxs.vxkJxsXkbBs.do&m=main&showtitle=0` —
  die Einstiegsseite des Belegungssystems. Sie ist ein **Frameset** (Menü
  links, Liste im `iframe name="right"`); von dort wählt man „Course
  registration information query" → „Query courses open this semester". Dass
  der Katalog-Scraper sein Formular auch in Frames sucht, passt genau dazu.

**Umgesetzt:** `js/scheduleParse.js` (`parseSchedulePage(doc)` — ein Parser für
App *und* Scraper), `tools/portal-schedule-scrape.js` (lädt den Parser per
Script-Tag von der Planner-Seite, `postMessage`-Rückgabe, Download-Fallback),
`js/portalImport.js` (geführter Drei-Schritt-Dialog mit Bookmarklet, Konsolen-
Fallback, Drag-&-Drop und „Quelltext einfügen"; `postMessage`-Empfänger mit
Origin-Prüfung). 14 Tests in `tests/schedule.test.mjs`, alle gegen den echten
Portal-Dump. Im Browser Ende zu Ende geprüft: Dump einfügen → 6 Meetings mit
Räumen, Zeiten und Wochen.
**Offen (Phase 2):** Die gelesenen Meetings in den Plan übernehmen (Abgleich
neu/abweichend/fehlt). Der Dialog zeigt sie bisher nur an.



### 4.1 Was die Seite liefert (aus dem Dump verifiziert)

Die Seite ist ein einzelnes Widget `div#kbSearch_portal` mit
`table.kebiao_table`: Kopfzeile Monday…Sunday, 6 Zeilen „Section 1…6",
Zellen `td#a<block>_<day>` (block 1–6, day 1–7). Eine belegte Zelle enthält:

```html
<td id="a1_1">
  <span onmouseover="return overlib('Classroom: 建华/经管新楼A201&lt;br&gt;Week: week 1-3,5', …)">
    <a class="mainHref"
       href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&p_kch=70511131&p_kxh=1&p_jsxm=&p_kslxdm=&p_xnxq=2026-2027-1"
       target="_blank">Digital Economy: Global versus Chinese Perspectives</a>
  </span><br>
</td>
```

Pro Meeting also: **Tag, Block, Raum, Wochen, Kursnummer (`p_kch`), Sequence
(`p_kxh`), Titel EN, Semester, Detail-Link**. Mehrere Kurse pro Zelle sind
möglich (mehrere `<span>`), Wochenenden haben `class="zhoumo"`.

**Nicht auf der Seite:** Credits, Dozent, Department, Sprache, Prüfungstermin.
Die kommen aus dem Katalog (A) bzw. den Details (C) über `number+seq`.

**Wichtig:** Ein Kurs über zwei Blöcke steht in **zwei** Zellen (Digital
Economy in `a1_1` *und* `a2_1`). Der Scraper muss die Zellen zu Meetings
zusammenfassen, nicht jede Zelle als eigenen Termin ausgeben.

### 4.2 `tools/portal-schedule-scrape.js`

Aufbau analog `portal-scrape.js` (gleiche Konventionen: IIFE, globale
Funktion, `download()`-Helper, gb2312-Decoding, Konsolen-Log als Anleitung).
Unterschied: **eine Seite, kein Paging, kein Token** → deutlich einfacher und
risikoärmer als der Katalog-Scraper.

Zwei Betriebsarten in einer Datei:
1. **DOM-Modus** (Standard): liest `document` der offenen Seite. Kein Fetch,
   kein Encoding-Problem, funktioniert garantiert.
2. **HTML-Modus**: `thuSchedule({ html: "<kompletter Quelltext>" })` — parst
   einen übergebenen String per `DOMParser`. Das ist derselbe Codepfad, den
   die App später beim „Quelltext einfügen"-Import benutzt (Phase 2/5), damit
   Parser und Tests nur einmal existieren.

Kern (eine reine Funktion, testbar, ohne DOM-Seiteneffekte):

```js
parseSchedulePage(doc) -> {
  semester: "2026-2027-1",
  scraped:  "2026-09-28",
  meetings: [ { number, seq, titleEn, day, block, room, weeksRaw, weeks, detailUrl } ]
}
```

- `weeksRaw` = `"week 1-3,5"` wie im Tooltip, `weeks` = `"1-3,5"` in der
  App-Notation (durch `parseWeeks()` verdaubar).
- `room` bleibt der Originalstring (`建华/经管新楼A201`). Übersetzung ist ein
  Anzeigethema, siehe 4.4.
- Der Tooltip wird aus `onmouseover` gelesen (`overlib('…')`), **nicht** aus
  dem `title`-Attribut (gibt es nicht). Robust gegen Zeilenumbrüche:
  Regex auf `Classroom:\s*(.*?)(?:<br>|$)` und `Week:\s*week\s*([0-9,\-\s]+)`.
- Der Dump enthält die Seite **fünfmal hintereinander** (Safari-RTF-Artefakt).
  Der Parser muss über *eine* `table.kebiao_table` laufen (`querySelector`,
  nicht `querySelectorAll`) und der Test muss beides abdecken.

### 4.3 Zellen → Meetings: Zusammenfassen benachbarter Blöcke

Gruppierung nach `number + seq + day + weeks + room`; Blöcke sortieren; direkt
aufeinanderfolgende Blöcke (n, n+1) zu einem Meeting zusammenziehen:

```
{day:1, blocks:[1,2], start:"08:00", end:"12:15", room, weeks:"1-3,5"}
```

Der zusammengefasste Termin bekommt **kein** `block`-Feld (= „custom time" im
Formular), weil er keinem einzelnen Block entspricht. Ein einzelner Block
behält `block:n` und die Zeiten aus `BLOCKS`.

**Bekannte Unschärfe:** Blocks 1+2 ergeben 08:00–12:15, die MBA-Kurse laufen
laut PDF aber bis 11:25. Das Portal kennt nur Blöcke, die echte Endzeit steht
nirgends maschinenlesbar. → Import-Vorschau zeigt die Zeit **editierbar** und
warnt bei zusammengefassten Meetings („Portal kennt nur Blöcke — Endzeit ggf.
anpassen"). Ist der Kurs im Katalog mit `room`/Zeiten aus dem MBA-PDF
vorhanden, gewinnen die PDF-Zeiten (die sind handverifiziert).
Schalter in der Vorschau: „Benachbarte Blöcke zusammenfassen" (Default an).

### 4.4 Räume

- Neues **optionales** Feld `slot.room`; Anzeige-Fallback `slot.room ||
  course.room`. Kein Feld wird umbenannt, `course.room` bleibt wie es ist
  (Storage-Regel).
- Warum pro Slot: Kurse wechseln zwischen Terminen den Raum; der Schedule
  liefert den Raum pro Zelle.
- Anzeige: Raum in der Wochenansicht unter dem Titel (klein), in der
  Kursliste als eigene Spalte, in der `.ics` als `LOCATION` (das ist der
  eigentliche Gewinn — Apple Maps/Erinnerung „Zeit bis zum Ort" braucht das).
- Optional, klein: `data/buildings.json` mit einer Handvoll Gebäude
  (`建华/经管新楼` → „Jianhua / SEM New Building", `六教` → „6th Teaching
  Building"). Anzeige `Jianhua A201 (建华/经管新楼A201)`. **Nice-to-have**,
  nicht blockierend.

### 4.5 Akzeptanz Phase 1

- `parseSchedulePage` auf `tests/fixtures/schedule-page.html` (= der Dump)
  liefert **6 Kurse / 9 Zellen → 6 Meetings**: Digital Economy (Mo, Block 1+2,
  A201, W 1-3,5), Technology and Strategy (Di, Block 2, A307, W 1-12), Firm
  Valuation (Di, Block 3+4, A101, W 1-3,5-8), Frontiers (Mi, Block 3+4, A419,
  W 6-9), Leadership (Mi, Block 6, LG1-21, W 5-14), Machine Learning (Do,
  Block 2, 六教6A216, W 1-16).
- Chinesische Raumnamen kommen unverstümmelt an (kein Mojibake).
- Der fünffach duplizierte Dump ergibt trotzdem 6 Meetings.
- Ein echter Lauf im eingeloggten Portal produziert dieselbe Struktur.

**Aufwand:** ~120 Zeilen Scraper + Tests. **Risiko:** niedrig — die Seite ist
statisch und liegt als Dump vor; die einzige Unbekannte ist, ob das Live-DOM
identisch ist (Screenshot sagt ja).

---

## 5. Phase 2 — Schedule-Import in der App ✅ (umgesetzt 2026-09-28)

**Pop-up-Blockade gelöst (2026-09-28).** Safari blockte den Planer-Tab beim
*ersten* Lauf und lud stattdessen eine Datei herunter; ab dem zweiten Lauf ging
es. Ursache war nicht Safari, sondern die Reihenfolge: `window.open()` ist nur
erlaubt, **solange eine Nutzergeste läuft**, und die ist weg, sobald irgendetwas
awaited wird. Wir öffneten den Tab ganz am Ende — nach Script-Laden, Parsen und
sechs Detail-Fetches. Jetzt öffnet **das Bookmarklet selbst** den Planer als
allererste Anweisung, noch im Klick, und reicht das Fenster über
`window.__thuPlanner` weiter. `null` heißt „trotzdem blockiert" (dann Hinweis +
Download), ein fehlender Schlüssel heißt „aus der Konsole gestartet".
`tests/bookmarklet.test.mjs` pinnt die Reihenfolge fest — sie ist unsichtbar und
sonst leicht wieder kaputtzumachen.

**Folge davon:** Der Planer-Tab liegt jetzt sofort vorn, das Panel auf der
Portalseite also dahinter. Der Scraper spiegelt seinen Fortschritt deshalb per
`postMessage` in den Dialog („Course details 3 of 6 …"), wo der Blick ohnehin
ist. Der Planer meldet mit `thu-ready`, wann er empfangsbereit ist; nach 60 s
ohne Nachricht zeigt er den Datei-Weg statt ewig „warte…".

**Abbrechen:** Im Fortschrittskasten sitzt oben rechts ein kleines „Cancel".
Es schickt `thu-cancel` an den Portal-Tab (= unser `opener`); beide Scraper
prüfen das **innerhalb** ihrer Schleifen, nicht erst am Ende, und bestätigen
mit `thu-cancelled`. Ein geschlossener Planer-Tab zählt ebenfalls als Abbruch —
es gäbe nichts mehr, wohin das Ergebnis könnte. Beim Katalog wird der
Resume-Stand vorher in `sessionStorage` gesichert: vier Minuten Arbeit werden
durch einen Abbruch nicht weggeworfen, `thuScrape({resume:true})` macht weiter.

**Offen:** Ob Safari einen Bookmarklet-Klick als Nutzergeste wertet, ist nur am
echten Portal zu prüfen. Falls nicht, bleibt es bei „einmal Pop-ups erlauben" —
aber mit klarer Ansage statt stillem Download.

**UX-Runde 2026-09-28 (nach Oskars Rückmeldungen):** Fortschrittspanel auf
der Portalseite (`js/portalOverlay.js`, von beiden Scrapern geladen — ohne es
laufen sie weiter, nur mit Konsolenausgabe); Dialog 780 px breit, Fakten in
einer Zeile, jede zweite Zeile getönt; primäre Aktion neben „Close" statt
darüber; nach der Übergabe scrollt der Dialog direkt zu den Fundstücken;
`window.name = "thu-planner"`, damit ein bereits offener Planer-Tab
wiederverwendet wird statt einen neuen zu stapeln.

**Semester-Schutz:** Woche 1 dieses Planers ist ein festes Datum
(14.09.2026). Ein Stundenplan aus einem anderen Semester würde auf dieselben
Wochennummern gemappt — plausibel aussehend und um Monate daneben. `SEMESTER`
in `core.js` benennt den Bezug, der Import vergleicht ihn mit `p_xnxq` aus der
Portalseite und **lehnt einen fremden Stundenplan ab**, statt ihn falsch
einzusortieren.

**Katalog wird für den Import automatisch geladen:** Die Stundenplan-Seite
kennt weder Credits noch Dozent oder Department. `acceptPortalPayload()` wartet
deshalb auf `ensureCatalog()`, bevor es den Diff baut — sonst blieben diese
Felder leer, solange man den Katalog-Tab nie geöffnet hatte.

**Umgesetzt:** `js/scheduleImport.js` — `scheduleToCourses()` (Meetings →
Kurse mit Slots, Credits/Dozent/Titel-CN aus dem Katalog, Status `booked`),
`diffPlan()` (neu / abweichend / nicht registriert), `applyScheduleDiff()`
(baut ein neues Array, mutiert nie, nimmt nur Angehaktes). Dreiteilige
Vorschau im Import-Dialog mit Checkbox pro Feld und Vorher→Nachher; ein
`commit()` + `toastUndo`. `slot.room` landet als `LOCATION` in der `.ics`.
19 Tests in `tests/scheduleImport.test.mjs`.

**Zuordnung Plan ↔ Portal (beim Testen gelernt):** Erst `catalogRef`, dann
exakt `number+seq`, dann **`number` allein — aber nur, wenn genau ein
Plan-Kurs diese Nummer hat.** Grund: die Seed-Kurse tragen andere Sequences
als das Portal (Frontiers: Plan `0`, Portal `1`), und ein reiner
`number+seq`-Vergleich listete denselben Kurs gleichzeitig als „neu" und als
„nicht registriert". Die Sequence wird stattdessen als eigenes Diff-Feld
angeboten. Bei mehreren Sections desselben Kurses im Plan wird bewusst nicht
geraten.



### 5.1 Warum das mehr ist als „Kurse anlegen"

Der Schedule ist die **einzige verlässliche Antwort auf „wofür bin ich
tatsächlich eingeschrieben"**. Der Import ist deshalb ein *Abgleich*, kein
stumpfes Einfügen. Drei Fälle:

| Fall | Erkennung | Aktion (vorgeschlagen, abwählbar) |
|---|---|---|
| **Neu** | `number+seq` im Schedule, nicht im Plan | Kurs anlegen, Status `booked`, Credits/Dozent/Dept aus dem Katalog nachschlagen |
| **Abweichung** | im Plan *und* im Schedule, Felder unterschiedlich | Pro Feld anzeigen: „Portal: Di Block 3 · Plan: Di Block 4" mit Checkbox „Portal übernehmen". Raum wird immer vorgeschlagen (Plan hat meist keinen) |
| **Fehlt** | im Plan `booked`/`bid`, nicht im Schedule | Warnung „nicht im Portal registriert" + Vorschlag Status → `option`. **Nie automatisch löschen** |

Das ist der Punkt, an dem die App echte Planungsarbeit abnimmt: sie zeigt
still, dass ein Kurs, den man für gebucht hielt, gar nicht registriert ist.

### 5.2 Neues Modul `js/scheduleImport.js`

```js
parseSchedulePage(docOrHtml)        // identisch zum Scraper (eine Quelle!)
scheduleToCourses(meetings, catalog)// Meetings → Kurs-Objekte, Katalog-Anreicherung
diffPlan(state.courses, imported)   // -> {added:[], changed:[{id, field, mine, portal}], missing:[]}
applyScheduleImport(selection)      // baut neues courses-Array, EIN commit()
```

- Zwingend über `commit("Import portal schedule", {courses})` → undo-fähig,
  danach `toastUndo(...)` (Mutation Rule aus CLAUDE.md).
- IDs: bestehende Kurse behalten ihre ID. Neue Kurse aus dem Schedule bekommen
  `sch-<number>-<seq>`, analog zu `cat-<key>`, plus
  `catalogRef {source:"schedule", key:"<number>-<seq>"}`, damit spätere
  Re-Importe zuordnen können. Kurse, die schon `cat-…` sind, behalten ihre ID —
  Zuordnung läuft immer über `number+seq`, nie über die ID.
- Kein Feld wird still überschrieben: `applyScheduleImport` schreibt nur, was
  in der Vorschau angehakt ist.

### 5.3 UI

Ein Modal wie das bestehende `.xls`-Modal (gleiche `preview`-Tabelle
wiederverwenden), erreichbar aus **Add/Edit** (Phase 4) und aus **Data &
sharing**:

1. Drei Eingabewege nebeneinander (siehe Phase 5 für die Herkunft der Daten):
   - **JSON einfügen/Datei wählen** (Ausgabe des Scrapers),
   - **Quelltext der Schedule-Seite einfügen** (⌥⌘U → ⌘A → ⌘C) — braucht keine
     Konsole, keine Bookmarklets, funktioniert immer,
   - *bestehend:* `.xls`-Import bleibt als dritter Weg.
2. Vorschau mit drei Abschnitten (Neu / Abweichungen / Fehlt), Checkboxen,
   editierbaren Zeiten, Zähler „5 Kurse · 12 CP · 1 Warnung".
3. „Import" → ein `commit`, Toast mit Undo.

### 5.4 Akzeptanz Phase 2

- Dump importieren in einen leeren Plan → 6 Kurse, Status `booked`, Räume
  gesetzt, Credits aus dem Katalog, Wochenansicht zeigt sie korrekt.
- Zweiter Import derselben Datei → „0 neu, 0 Abweichungen" (idempotent).
- Plan mit Seed-Kursen importieren → Digital Economy/Frontiers/Leadership
  werden als Abweichung (Raum fehlt) erkannt, nicht dupliziert; Elementary
  Chinese B erscheint unter „fehlt im Portal".
- Undo stellt den Zustand vor dem Import exakt wieder her.
- Alte localStorage-Payload (ohne `slot.room`) lädt unverändert.

---

## 6. Phase 3 — Kursdetails zu *meinen* Kursen (Quelle C) ✅ (umgesetzt 2026-09-28)

**Umgesetzt:** `parseCourseDetail(doc)` in `js/scheduleParse.js`, Abruf im
Stundenplan-Scraper (`thuSchedule({details:false})` schaltet ihn ab), Feld
`course.detail`, Anzeige als aufklappbarer Block im Edit-Formular,
`detail` als eigenes Diff-Feld im Import, Ausschluss aus dem Share-Link
(bleibt im JSON-Export). 6 Tests in `tests/detail.test.mjs`.

**Am echten Portal verifiziert (2026-09-28).** Oskar hat einen HTML-Dump der
Detailseite geliefert (`tests/fixtures/course-detail-live.html`, Kurs
80511412). Der Parser liest **nach Label** („finde die Zelle mit dem Text
‚Credit hours', nimm die nächste") statt nach Position oder Klasse — und trifft
alle 13 Felder des echten Markups. Bestätigt hat der Dump außerdem: zwei
Label/Wert-Paare pro Zeile, hunderte Leerzeilen in der Department-Zelle,
„Credit" direkt neben „Credit hours", leere Zellen bei Instructor/Testing.
Alles abgedeckt. Schlägt der Abruf trotzdem fehl, wird der Kurs importiert,
nur ohne `detail`.

**Zwei Funde aus dem Dump:**
- Die Detailseite liefert `Course features` als **Code** (`01`), der Katalog
  denselben Sachverhalt als Text („Taught in foreign language"). Der Import
  legt deshalb `detail.featuresLabel` aus dem Katalog dazu; ein nackter Code
  wird nie angezeigt.
- `mergeCatalogSources()` warf bei Kursen, die in MBA-Liste *und* Portal
  stehen, das `features`-Feld des Portals weg — bei allen 15 MBA-Kursen ging
  damit die einzige Angabe zur Unterrichtssprache verloren. Gefixt.



### 6.1 Was die Detailseite liefert

Verifiziert am Screenshot `_Archive/Schedule-Info-Portal/click-details.png`
(Kurs 70511131): Course number, Course sequence, Course title, Course
department/school/college, Instructor name, **Credit hours** (16), Credit (1),
**Testing methods**, **Textbooks**, **Reference books**, **Chinese
description**, **English description** (≈1,5 KB Fließtext mit
Sitzungsgliederung), **Course features**.

### 6.2 Umfang: ~6 Seiten, nicht 692

Die Detailseite ist **nur aus dem eigenen Stundenplan heraus verlinkt** (siehe
Kasten in Abschnitt 1). Der Stundenplan-Scraper hat die fertigen URLs ohnehin
schon in der Hand — sie stehen als `href` in genau den Zellen, die er liest:

```
xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&p_kch=70511131&p_kxh=1&…&p_xnxq=2026-2027-1
```

Damit ist der „Detail-Scraper" kein eigenes Werkzeug mehr, sondern **ein
zweiter Schritt im Stundenplan-Scraper**: Gitter lesen → für die ~6 gefundenen
Kurse je eine Detailseite nachladen → alles zusammen zurückgeben.

| | vorher geplant | **jetzt** |
|---|---|---|
| Seiten | 692 (konstruierte URLs) | **~6** (verlinkte URLs) |
| Laufzeit | ~9 min | **~5 s** |
| Datenmenge | 1,7 MB | **~15 KB** |
| Drosselung/Resume | nötig | unnötig |
| Eigene Ablage (IndexedDB) | nötig | **unnötig** |

*Damit entfallen ersatzlos:* `tools/portal-details-scrape.js` als eigene Datei,
der `snapshots/details`-Record, das Scope-Problem, die Rate-Limit-Sorge und
`store.test.mjs`-Fälle für Details.

### 6.3 Ablage: am Kurs im Plan

Die Details gehören zu *deinen* Kursen, also in den Plan — nicht in einen
Snapshot-Store:

```js
// optionales Feld am Kurs, Default undefined:
detail: {
  creditHours: 16, testing: "", textbooks: "", references: "",
  descriptionEn: "1. Theoretical Background …",
  descriptionCn: "1. 理论背景 …",
  fetchedAt: "2026-09-28"
}
```

6 × ~2,5 KB ≈ 15 KB — unkritisch für `localStorage` (Budget ~5 MB).

**Zwei Regeln dazu:**
1. `detail` ist optional und wird in `load()` nicht vorausgesetzt (Storage-Regel).
2. **`detail` wird aus dem Share-Link ausgeschlossen.** `#plan=<base64>` würde
   sonst um ~20 KB wachsen und in manchen Messengern/Mailclients abgeschnitten.
   Im JSON-Export bleibt es drin (dort gibt es keine Längengrenze).

### 6.4 Anzeige

- **Kursdetail im Edit-Formular / in der Kursliste:** aufklappbarer Abschnitt
  „Course description" mit EN-Text, darunter klein Prüfungsform und Lehrbücher.
- **Katalog-Tab:** unverändert. Portal-Katalogeinträge haben weiterhin keine
  Beschreibung — die 15 MBA-Kurse behalten ihre aus den PDFs. Ist ein
  Katalogkurs bereits im Plan *und* hat `detail`, wird die Beschreibung dort
  mitgezeigt (kostet drei Zeilen).
- Kein Kurs ohne `detail` zeigt eine Lücke oder einen Fehler — der Abschnitt
  erscheint einfach nicht.

### 6.5 Akzeptanz Phase 3

- Stundenplan-Scrape auf dem echten Portal liefert für alle belegten Kurse
  zusätzlich `detail`; Kurs 70511131 exakt mit den Werten aus dem Screenshot
  (Credit hours 16, Credit 1, beide Beschreibungen vollständig, kein Mojibake).
- Fällt eine Detailseite aus (Timeout, 500), wird der Kurs trotzdem importiert —
  nur ohne `detail`, mit stiller Notiz im Ergebnis-Log.
- Zweiter Import überschreibt `detail` nur bei angehakter Zeile (Vorschau-Regel).
- Share-Link eines Plans mit Details bleibt unter 4 KB.
- Alter Plan ohne `detail` lädt und rendert unverändert.

**Risiko:** niedrig. Die URLs stammen aus der Seite selbst (keine geratenen
Parameter), es sind sechs GETs in derselben Session, und ein Fehlschlag kostet
nur ein optionales Feld.


## 7. Phase 4 — „Add / edit course" umbauen ✅ (umgesetzt 2026-09-28)

**Umgesetzt:** `js/addTab.js` (neu) — Katalogsuche direkt im Add-Tab (max. 8
Treffer aus `CATALOG.entries`, pro Treffer Nr-Seq · CP · Zeit · Wochen ·
Dozent, Clash-Hinweis, „Add" und **„Edit before adding"**: füllt das Formular,
speichert nichts) und das Band „Catalog says …" über Kursen mit `catalogRef`
mit „Use these values" (Slots/Wochen/Raum ins Formular, ohne zu speichern).
Das Handformular liegt jetzt eingeklappt unter „Enter a course by hand" und
öffnet sich automatisch beim Bearbeiten. Meetings-Editor: **Raum pro Zeile**
(4.4). Geteilte Suche: `catalogHaystack()` in `catalog.js`, von Katalog-Tab
und Add-Tab benutzt.

**Dabei gefundener Bug (der eigentliche Gewinn).** `readForm()` baute den Kurs
komplett neu aus den Formularfeldern und ersetzte damit den gespeicherten —
`detail` (die Portal-Beschreibung), `catalogRef` und `slot.room` hatten kein
Eingabefeld und waren nach *jeder* Bearbeitung weg, kommentarlos, mit „Course
updated"-Toast. Jetzt merged `mergeCourseEdit(existing, fields)` auf den
gespeicherten Kurs; ein aus dem Katalog vorbefülltes, noch nicht gespeichertes
Formular steht in `formSource`. 4 Tests in `tests/form.test.mjs`.

**Nicht gebaut:** der Katalog-Tab bleibt der Ort für Filter und Stöbern — die
Suche im Add-Tab ist bewusst nur ein Feld, kein zweiter Katalog.

### 7.1 Problem

Der Tab heißt heute „Add a course manually" und zeigt zuerst ein leeres
Formular mit ~12 Feldern. Das war richtig, als es 4 Seed-Kurse und keinen
Katalog gab. Mit 5.020 Katalogkursen und Schedule-Import ist Tippen der
**seltenste** Weg — und der fehleranfälligste (Kursnummern, Wochen, Blöcke).

### 7.2 Neue Struktur des Tabs (Reihenfolge = Häufigkeit)

```
┌ Add courses ─────────────────────────────────────────────┐
│ ① Import my portal schedule            [ Import… ]  ★neu │
│    „Holt alle Kurse, für die du registriert bist —       │
│     mit Raum. Empfohlener Weg."                          │
│                                                          │
│ ② Search the catalog                                     │
│    [ 🔍 number, title or instructor …            ]       │
│    → Live-Trefferliste (max. 8) aus dem Merged-Katalog,  │
│      pro Treffer: Titel, Nr-Seq, CP, Zeit, Clash-Hinweis,│
│      [ Add ] und [ Edit before adding ]                  │
│                                                          │
│ ③ Other ways ▾ (eingeklappt)                             │
│    [ .xls importieren ] [ Kurszeile einfügen ]           │
│                                                          │
│ ④ Enter manually ▾ (eingeklappt)                         │
│    das heutige Formular, unverändert                     │
└──────────────────────────────────────────────────────────┘
```

- **Der Edit-Fall bleibt wie er ist.** Klick auf eine Zeile in der Kursliste →
  Tab wechselt, Formular ist aufgeklappt und gefüllt, Überschrift „Edit
  course". Nur der *leere* Zustand wird umgebaut. `fillForm`/`readForm`/
  `editCourse` bleiben unangetastet → kein Regressionsrisiko für Edit.
- **② ist kein zweiter Katalog-Tab**, sondern nur ein Suchfeld auf
  `CATALOG.entries` (lazy `ensureCatalog()`), das „Edit before adding" kann:
  Katalogeintrag → `catalogEntryToCourse()` → `fillForm()` ohne zu speichern.
  Genau die Lücke, die der Katalog-Tab heute lässt (dort nur Ein-Klick-Add).
- **Im Edit-Formular neu:** hat der Kurs `catalogRef`, erscheint über dem
  Formular ein Band „Catalog: Tue Block 3, A101, weeks 1-3,5-8 —
  [Werte übernehmen]". Löst das alte Backlog-Item „Catalog says … your plan
  says …" mit ~20 Zeilen.
- **Meetings-Editor:** pro Zeile ein optionales `room`-Feld (Phase 1).

### 7.3 Akzeptanz Phase 4

- Tab ohne aktiven Edit zeigt Import + Suche zuerst; Formular ist eingeklappt.
- Suche „Firm Valuation" → Treffer mit Clash-Hinweis, „Add" legt den Kurs an
  (ein `commit`, Undo funktioniert).
- „Edit before adding" füllt das Formular, **ohne** zu speichern; Abbrechen
  hinterlässt keinen Kurs.
- Klick auf eine Kursliste-Zeile verhält sich exakt wie heute.
- Desktop-Layout der übrigen Tabs unverändert.

---

## 8. Phase 5 — Scraper von der Planner-Seite starten ✅ (umgesetzt 2026-09-28)

**Umgesetzt, nur anders platziert als geplant:** Die Bookmarklets stehen nicht
in einem eigenen Abschnitt „Portal tools", sondern im geführten Import-Dialog
selbst (`bookmarkletHref()` in `js/portalImport.js`, ein Link zum Ziehen pro
Werkzeug, Konsolen-Fallback daneben) — dort, wo der Weg ohnehin erklärt wird.
Einstiege: Add-Tab („Import my timetable from the Info portal"), Katalog-Tab
(Snapshot-Statuszeile) und *Data & sharing* → „Info portal" mit beiden
Knöpfen. Rückweg per `postMessage` mit Origin-Allowlist, `?import=` als
Fallback, Datei-Picker/Drag-&-Drop und „Quelltext einfügen" als Notweg.
**Offen bleibt nur, was ausschließlich am echten Portal prüfbar ist** — siehe
den Kasten in Abschnitt 5 (Nutzergeste in Safari) und Abschnitt 13.

### 8.1 Was **nicht** geht (und warum, damit es nicht nochmal diskutiert wird)

Die Planner-Seite kann das Portal **niemals selbst abfragen**: anderes Origin,
kein CORS-Header, Session-Cookie, und die Seite ist statisch (kein Backend, das
proxyen könnte). Jede Lösung muss den Code also **im Kontext der Portal-Seite**
ausführen. Es bleiben: Konsole (heute), Bookmarklet, Browser-Extension. Eine
Extension ist für einen Nutzer plus ein paar Kommiliton:innen absurd viel
Aufwand (Store-Review, Signierung, zwei Browser) → raus.

### 8.2 Empfehlung: Bookmarklet + Rückgabe per `postMessage`

Mit der Entscheidung aus Phase 0 ist dieser Abschnitt **keine Bequemlichkeit
mehr, sondern der einzige Weg, wie irgendjemand außer Oskar an einen Katalog
kommt.** Entsprechend gut muss er erklärt sein.

**Ein neuer Abschnitt „Portal tools" im Tab *Data & sharing*** mit:

1. **Zwei Bookmarklet-Links zum Ziehen in die Lesezeichenleiste:**
   „📅 THU Schedule" (holt Stundenplan **inklusive Kursdetails**, Phase 3) und
   „📚 THU Catalog". Inhalt:

   ```js
   javascript:(function(){var s=document.createElement('script');
   s.src='https://raksoo.github.io/TsinghuaCoursePlanner/tools/portal-schedule-scrape.js?'+Date.now();
   document.body.appendChild(s);})()
   ```

   Das Portal läuft über **http**, die Planner-Seite über **https** → ein
   https-Script in eine http-Seite zu laden ist erlaubt (blockiert wird nur die
   Gegenrichtung). Bleibt als Risiko eine CSP auf der Portal-Seite; der Dump
   zeigt keine, aber das ist erst am echten Portal sicher.
   **Fallback**, falls doch blockiert: „Code kopieren"-Button (Clipboard) +
   Konsolen-Anleitung — also der heutige Weg, nur bequemer.

2. **Rückgabe der Daten ohne Datei-Gefummel — `postMessage`.** Der Scraper
   öffnet am Ende die Planner-Seite und schiebt ihr das Ergebnis direkt zu:

   ```js
   const w = window.open("https://raksoo.github.io/TsinghuaCoursePlanner/?import=catalog");
   // nach dem "ready"-Ping der Planner-Seite:
   w.postMessage({ kind:"thu-import", what:"catalog", payload }, "https://raksoo.github.io");
   ```

   Das funktioniert **auch für die 1,7 MB des Katalogs** (structured clone,
   keine URL-Längengrenze) und ist damit der Weg für beide Scraper.
   Der Planner-seitige Empfänger:
   - akzeptiert nur `event.origin === "http://zhjwe.cic.tsinghua.edu.cn"`,
   - nur wenn die Seite per `window.opener` geöffnet wurde und `?import=` trägt,
   - validiert die Nutzdaten wie in 3.3,
   - **zeigt immer erst die Vorschau** und schreibt nichts ohne Klick.

   Für den *Schedule* (< 2 KB) bleibt zusätzlich der einfachere Weg
   `#import=<base64>` als Fallback, falls Popups blockiert sind; der
   Hash-Mechanismus existiert schon für `#plan=` und wird nach dem Lesen aus
   der Adresszeile entfernt.

3. **Immer vorhandener Notweg (ohne Bookmarklet, ohne Konsole):** Download der
   JSON-Datei + Datei-Picker in der App; für den Schedule zusätzlich
   „Quelltext der Seite einfügen" (Phase 2, 5.3).

### 8.3 Antwort auf „Katalog-Scraper oder Schedule-Scraper von der Seite aus?"

**Es gibt genau zwei Scraper** — der Detail-Abruf ist seit Abschnitt 6 kein
eigenes Werkzeug mehr, sondern Schritt 2 im Stundenplan-Scraper:

| | 📅 Schedule (B + C) | 📚 Katalog (A) |
|---|---|---|
| Was | meine belegten Kurse + Raum + Wochen, **danach ~6 Detailseiten** | alle 5.020 Kurse (Titel, Nr, CP, Dept, Dozent, Zeit, Sprache) |
| Wer führt aus | jede:r, oft (nach jeder Belegungsänderung) | jede:r, 1× pro Semester |
| Laufzeit | **~5 s** | ~4 min |
| Ergebnis landet | `localStorage` (der Plan, inkl. `course.detail`) | IndexedDB `snapshots/catalog` |
| Rückweg | `postMessage`, sonst `#import=`, sonst Quelltext einfügen | `postMessage`, sonst Datei-Picker |
| Platz in der UI | prominent im Add-Tab (①) | „Portal tools" + Hinweis-Panel im leeren Katalog-Tab |

**Reihenfolge für neue Nutzer:innen** (gehört als nummerierte Anleitung in den
Katalog-Tab): Katalog importieren (einmalig) → Stundenplan importieren
(regelmäßig). Mehr Schritte gibt es nicht.

### 8.4 Akzeptanz Phase 5

- Bookmarklet auf der eingeloggten Schedule-Seite geklickt → nach < 2 s öffnet
  sich der Planner mit gefüllter Import-Vorschau.
- Katalog-Bookmarklet: 5.020 Zeilen kommen per `postMessage` an, Vorschau
  zeigt Anzahl + Semester + Datum, nach „Import" liegen sie in IndexedDB.
- Bei blockiertem Script erscheint eine verständliche Meldung + Kopier-Button.
- Bei blockiertem Popup: Hinweis + Download-Fallback, keine Sackgasse.
- `#import=` mit kaputtem Base64 → Fehlermeldung, kein Datenverlust, kein
  kaputter State.
- `postMessage` von einem **fremden** Origin wird ignoriert (Test mit
  manipuliertem Sender).
- Die Portal-Seite wird durch das Bookmarklet nicht verändert (nur gelesen).

---

## 9. Phase 6 — Tests (ab Phase 1 mitlaufend) ✅ (Stand 2026-09-28: 128 Tests)

**Umgesetzt:** `npm test` (`node --test tests/`), Harness + linkedom +
fake-indexeddb wie unten beschrieben, 13 Testdateien: `schedule`, `detail`,
`store`, `catalog`, `scheduleImport`, `ics`, `storage`, `bookmarklet`,
`parser`, `weeks`, `timezone`, `dataShare`, `form`. Über den Plan hinaus
dazugekommen: Zeitzonensicherheit (`TZ=Europe/Berlin`), ICS-Faltung nach
Oktetts, Export/Import-Rundlauf, Feldübernahme beim Bearbeiten.
**Offen:** `import.test.mjs` — der `postMessage`-Empfänger (fremdes Origin
wird ignoriert) ist noch nicht unit-getestet, nur der Code dafür steht.
E2E (9.3) unverändert offen.

Bis heute wird nur ad hoc im Browser geklickt. Mit Scrapern, Merge-Logik und
einem Import, der bestehende Pläne anfasst, reicht das nicht mehr.

### 9.1 Setup — ohne npm, ohne Build

Die Module sind plain Scripts mit globalen Funktionen. Ein winziger Harness
lädt sie in einen `vm`-Context, ganz ohne die App anzufassen:

```
tests/
  harness.mjs            // liest js/*.js, evaluiert sie in einem vm-Context,
                         // stellt globals bereit (kein Umbau der App nötig)
  fixtures/
    schedule-page.html   // aus _Archive/Schedule-Info-Portal/ (RTF → HTML)
    course-detail.html   // Detailseite 70511131
    catalog-portal-20.json
    state-old-v1.json    // localStorage-Payload ohne slot.weeks/slot.room
  parser.test.mjs
  schedule.test.mjs
  catalog.test.mjs
  ics.test.mjs
  storage.test.mjs
```

Lauf: `node --test tests/` — Node ≥ 18.

DOM: `parseSchedulePage` nimmt ein `document`-Objekt entgegen (siehe 4.2), statt
sich `document` global zu greifen. Im Browser ist das das echte DOM, im Test
eins aus **linkedom**. Zusammen mit **fake-indexeddb** (für `store.test.mjs`)
sind das die *einzigen zwei* Dev-Dependencies
(`npm i -D linkedom fake-indexeddb`, `node_modules/` gitignored). Die App selbst
bleibt dependency-frei und ohne Build-Schritt; `package.json` enthält nur
`"test": "node --test tests/"`.

### 9.2 Was getestet wird (Reihenfolge = TDD, Test zuerst)

| Datei | Fälle |
|---|---|
| `parser.test.mjs` | `slotsFromCode` mit einem/mehreren Codes, gleichen/verschiedenen Wochen; `parseWeeks`/`compressWeekList` Roundtrip; kaputte Eingaben |
| `schedule.test.mjs` | `parseSchedulePage`: 6 Meetings aus dem Dump; fünffacher Dump → trotzdem 6; Block-Merge 1+2; chinesische Räume; Zelle mit zwei Kursen; leere Seite |
| | `diffPlan`: neu / geändert / fehlt; Idempotenz beim zweiten Import; nichts wird ohne Auswahl geschrieben |
| `catalog.test.mjs` | `mergeCatalogSources`: MBA gewinnt bei gleicher Nummer; mehrere Sequences erzeugen mehrere Einträge; `features` → Sprachfilter |
| `ics.test.mjs` | `icsOccurrences` überspringt Feiertage; Override landet am neuen Datum mit gleicher UID; Beijing→UTC; `LOCATION` aus `slot.room \|\| course.room` |
| `storage.test.mjs` | **alte Payload lädt unverändert** (kein `slot.weeks`, kein `slot.room`, kein `overrides`, kein `icsSeq`); `load()` schreibt nicht zurück |
| `store.test.mjs` | `snapshotPut`/`Get`/`Clear` (IndexedDB via `fake-indexeddb`); fehlende IndexedDB → `null` statt Exception; defekter Import lässt den alten Snapshot stehen; Quota-Fehler beim Katalog lässt den `localStorage`-Plan unberührt |
| `detail.test.mjs` | Detailseite → Felder (Fixture `course-detail.html`); fehlende Felder bleiben leer statt `undefined`; ausgefallene Detailseite → Kurs ohne `detail`, kein Abbruch; `detail` fehlt im Share-Link, ist aber im JSON-Export enthalten |
| `import.test.mjs` | `postMessage`-Empfänger: fremdes Origin wird ignoriert, fehlendes `?import=` wird ignoriert, gültige Nutzdaten erzeugen eine Vorschau **ohne** zu schreiben |


**Ziel 80 % Coverage auf den reinen Funktionen** (Parser, Merge, Diff, ICS,
Storage). UI-Rendering wird nicht unit-getestet.

### 9.3 E2E (optional, danach)

Playwright gegen den lokalen Server (`.claude/launch.json` → :8765), drei
Journeys: *Schedule importieren → Wochenansicht stimmt*, *Katalogkurs adden →
Clash-Box erscheint*, *ICS exportieren → Datei enthält N Events*. Erst bauen,
wenn Phasen 1–4 stehen.

---

## 10. Phase 7 — Alternative Sections (Rest aus alt-Phase 5)

Jetzt begründet: **427 Kursnummern haben mehrere Sequences.** In
`renderClashes()` pro Clash prüfen, ob eine andere Sequence desselben Kurses
kollisionsfrei liegt → Vorschlag + „Swap" (ersetzt Slots/Weeks/Seq/Raum, per
`commit()` undo-fähig). Setzt Phase 0 voraus (ohne importierten Katalog gibt es
nichts zu durchsuchen) — bei leerem Snapshot entfällt der Vorschlag still.
**Akzeptanz:** Bei einem konstruierten Clash mit einem Kurs, der eine zweite
Sequence hat, erscheint der Vorschlag; „Swap" löst den Clash; Undo stellt her.

---

## 11. Phase 8 — Mobile (unverändert aus alt-Phase 6)

Befund vom 22.09. (375 px): benutzbar, aber Header frisst ~40 % der Höhe, Tabs
brechen um, Wochengitter scrollt seitlich, Kurstabelle ist 1.320 px breit.
Vorgehen wie dort beschrieben, **Desktop muss pixelgleich bleiben**. Details
siehe `_Archive/PLANNING-v1-2026-09-22.md`, Abschnitt „Phase 6".
Dazu gehört auch der offene Test des iOS-Share-Sheets beim `.ics`-Export.

---

## 12. Querschnitt: Regeln, die für alle Phasen gelten

- **Keine Portaldaten im Repo.** `data/catalog-portal.json`, Detaildaten und
  jeder weitere Portal-Snapshot bleiben gitignored — dauerhaft, nicht
  „vorläufig". Wer das ändern will, muss vorher die Nutzungsbedingungen des
  Portals klären. Committet wird nur selbst Erstelltes (MBA-Katalog aus den
  PDFs, Feiertage, Department-Namen) und Code.
- **Storage, zweigeteilt.** `localStorage["tsinghua-planner-v1"]` = der Plan,
  unersetzlich, `STORE_KEY` bleibt. IndexedDB `thu-planner-data` = die
  Snapshots, jederzeit neu scrapbar. Die beiden dürfen sich nie gegenseitig
  beschädigen: kein Snapshot in `localStorage`, kein Plan in IndexedDB.
  Neue Plan-Felder (`slot.room`, ggf. `course.detailRef`) sind **optional mit
  Default in `load()`**; nichts wird umbenannt; `load()` schreibt nie zurück.
  Jede Phase wird gegen `tests/fixtures/state-old-v1.json` geprüft.
- **Nichts wird ohne Vorschau importiert.** Jeder Import (Schedule, Katalog,
  Details, JSON, `.xls`, `postMessage`) zeigt erst eine Vorschau und schreibt
  erst nach einem Klick.
- **Mutation.** Alles über `commit(label, {courses, overrides})` + `toastUndo`.
  Nie `state.courses` zuweisen, nie ein Kursobjekt in place ändern.
- **Cache-Busting.** Bei jedem Deploy mit JS/CSS-Änderung alle `?v=` in
  `index.html` in einem Rutsch hochzählen.
- **Scraper-Ethik.** Nur lesen, nur eigener Account, gedrosselt (≥ 800 ms),
  resumierbar, keine personenbezogenen Daten außer öffentlich gelisteten
  Dozentennamen; Dozenten-IDs (`p_jsh`) werden verworfen. Kein Live-Zugriff aus
  der App — Snapshots, immer.
- **Alles, was in die Portal-Seite injiziert wird, bleibt reines ASCII.**
  Die Portal-Seite ist `charset=gb2312`; ein `<script src>` ohne eigenes
  Charset wird in der Kodierung des *Dokuments* dekodiert. Ein UTF-8-Zeichen
  wird dann zu Mojibake — und ein zerschossenes Zeichen in einem Regex-Literal
  ist ein SyntaxError, der still gar nichts definiert. GitHub Pages sendet
  zufällig `charset=utf-8` und rettet uns; ein normaler Dev-Server nicht.
  Nicht-ASCII als `\uXXXX` schreiben. Gilt für `js/scheduleParse.js` und
  `tools/portal-*.js`; `tests/storage.test.mjs` erzwingt es.
  (Am 2026-09-28 die harte Tour gelernt.)
- **Ein Parser, zwei Aufrufer.** Scraper und App teilen sich
  `parseSchedulePage` und `parseCourseDetail` (Phase 1/2/3). Kein zweiter
  Parser.
- **Nur verlinkte URLs abrufen, keine konstruierten.** Der Detail-Abruf nutzt
  ausschließlich die `href`-Werte, die die Portalseite selbst ausliefert.
  URL-Parameter zu raten, um an Seiten zu kommen, die das Portal nicht
  verlinkt, ist keine Option — weder technisch verlässlich noch angemessen.
- **Dateigröße.** Module bleiben unter 400 Zeilen. `catalog.js` (470) wird bei
  der nächsten Berührung geteilt (`catalogData.js` / `catalogView.js`).

---

## 13. Backlog (nicht eingeplant, aber notiert)

- **Studienstufe im Katalog unterscheiden (Undergrad / Grad / MBA).** Die
  Stufe steckt offenbar in der ersten Ziffer der Kursnummer. **Oskar gibt die
  genauen Ranges noch durch** — vorher nicht bauen. Danach klein:
  `courseLevel(number)` in `catalog.js`, Badge in der Titelspalte, Filter-Chip
  neben „Taught in English".
  Randnotiz: Das Suchformular des Portals hat kein Stufen- oder Typfeld (am
  Dump geprüft) — die Kursnummer ist das einzige verfügbare Signal.
- **`showToXs` — mögliche Detailseite für *beliebige* Katalogkurse.** Jede
  Katalogzeile verlinkt auf dem chinesischen Titel
  `js.vjsKcbBs.do?m=showToXs&p_id=<dozentenid>;<kursnummer>`. Was diese Seite
  zeigt, ist **ungeprüft** — falls sie dieselben Beschreibungen liefert wie
  `showKcDetail`, wären Kursbeschreibungen doch für den ganzen Katalog
  erreichbar (dann wäre die 692er-Idee wiederbelebbar). **Nächster Schritt:
  eine solche Seite im Browser öffnen und als Dump ablegen** — erst dann
  planen. Hinweis: Die URL enthält eine Dozenten-ID; die wird wie bisher nicht
  gespeichert.
- Exam arrangement (`jxmh.do?m=jxs_ksSearch`) — vierte Portal-Quelle, würde
  Prüfungstermine liefern. Bewusst zurückgestellt: Prüfungsverwaltung wurde in
  Ausbaustufe 2 als „Kalender-Territorium" ausgeschlossen. Falls doch:
  als *Anzeige* im Kursdetail, nicht als eigene Terminverwaltung.
- „Check enrollment status" (`xsJxs.xsJxsXjb.do?m=show`) — vermutlich
  Anmeldestatus/Warteliste. Ungeprüft, könnte `bid` vs. `booked` automatisch
  unterscheiden. Erst einen Dump ansehen.
- **Katalogseite im Portal derzeit nicht erreichbar (28.09.2026).** „Query
  courses open this semester" war vormittags noch da und ist abends
  verschwunden — vermutlich mit dem Ende der Belegungsfrist abgeschaltet.
  Folge: Der **Katalog-Scraper ist am echten Portal gerade nicht testbar**.
  Testgrundlage bleibt der lokale Snapshot vom 22.09. (5.031 Zeilen) plus die
  Dumps unter `_Archive/`; die Parser-Tests laufen davon unabhängig weiter.
  Vor dem nächsten Umbau am Scraper prüfen, ob die Seite (oder der Direktlink
  aus Abschnitt 4) wieder antwortet — und ob sie in der nächsten
  Belegungsrunde dieselbe Struktur hat. Der Stundenplan-Scraper ist davon
  nicht betroffen, solange „My timetable" erreichbar bleibt.
- `data/buildings.json` (Gebäude-Glossar, Phase 1.4).
- Capacity/Enrollment-Zahlen: auf keiner der geprüften Seiten vorhanden.
  Vermutlich nur in der Registrierungsmaske. Ungeprüft.
- Kursliste: Raum-Spalte sortierbar; Filter „hat Raum".
- Katalog: Sprachfilter aus `features` (fällt in Phase 0 quasi gratis an —
  438 + 82 + 172 Kurse sind klassifizierbar).
