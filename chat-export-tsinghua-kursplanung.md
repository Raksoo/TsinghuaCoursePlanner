# Chat-Export: Tsinghua Kursplanung & Kursplaner-App

Exportiert am: 2026-09-15

---

## 1. Tsinghua Class-Time-Notation entschlüsselt

Frage: Was bedeuten Class-Time-Codes im Tsinghua-System wie `4-2` oder `1-1`?

**Ergebnis:**
- Format: `Wochentag-Block`
- Erste Ziffer = Wochentag (1 = Montag, 2 = Dienstag, 3 = Mittwoch, 4 = Donnerstag, 5 = Freitag …)
- Zweite Ziffer = einer von 6 "großen Blöcken" (大节) pro Tag

| Block | Uhrzeit (ca.) |
|---|---|
| 1 | 08:00–09:35 |
| 2 | 09:50–12:15 |
| 3 | 13:30–15:05 |
| 4 | 15:20–16:55 |
| 5 | 17:05–18:40 |
| 6 | 19:20–21:45 |

Beispiele aus den Screenshots (Elementary Chinese B, Kursnr. 64203022):
- `1-1` → Montag, Block 1
- `1-2` → Montag, Block 2
- `3-2` → Mittwoch, Block 2
- `4-2` → Donnerstag, Block 2

Hinweis: exakte Minutenangaben können je nach offizieller Zeittabelle leicht variieren — im Zweifel gegen die offizielle "上课节次时间表" prüfen.

---

## 2. Bau des Kursplaners (HTML-App)

### Ausgangslage
- Bild: Elective Course List mit 4 bereits gewählten Kursen (Leadership in A New Era, Digital Economy, Elementary Chinese B, Frontiers of Chinese Contemporary Issues Research)
- PDF: MBA Course Schedule for Fall Semester 2026 (Exchange Students), Woche 1 (14. Sep 2026) – Woche 18 (17. Jan 2027), mit Raum- und Zeitangaben je Kurs

### Anforderungen (final abgestimmt)
1. Bisherige Kurse vorbefüllt
2. Zwei Eingabewege: Copy-Paste-Parser für das Blockcode-Format (`2-6(week 1-16)`) **und** manuelles Formular mit Einzelfeldern
3. Übersichtliche Wochenansicht mit Blöcken
4. Dynamisches Ein-/Ausblenden über Status-Dropdown (Fest gebucht / Im Bidding / Option / Verworfen), nicht nur eine einfache Checkbox
5. Laufende Kredit-Summe pro Status
6. Kalenderwochenauswahl (1–18, mit echten Datumsangaben ab 14. Sep 2026)
7. Automatische Konfliktprüfung bei zeitlicher Überschneidung
8. Weitergabefähig: eigenständige HTML-Datei ohne Serverabhängigkeit, per Mail/WhatsApp teilbar; Datenaustausch über JSON-Export/Import

### Tool-Entscheidung
Lokale HTML-App statt Notion, da Notions Kalenderansicht datumsbasiert ist und kein echtes Wochentag-×-Block-Raster mit mehreren Kursen pro Zelle unterstützt. Chat statt CoWork, da einzelnes, in sich geschlossenes Artifact-Build ohne Multi-File-/Langzeit-Charakter.

### Umsetzung — Kernfunktionen
- **Wochenplan-Tab:** Zeitraster 08:00–22:00 mit Blockbändern, Wochenauswahl mit echten Kalenderdaten, parallele Kurse nebeneinander, Konflikte rot umrandet, Klick auf Kurs öffnet Bearbeitung
- **Kursliste-Tab:** Such-/Filterbare Tabelle, Status per Dropdown direkt änderbar, Zusammenfassungszeile mit CP je Status
- **Kurse hinzufügen-Tab:** Copy-Paste-Feld mit Parser (erkennt EN-/CN-Titel, Kursnummer, Sequenz, Credits, Fachbereich, Dozent, Blockcode `X-Y(week …)`) inkl. Vorschau mit Einzelauswahl vor Übernahme, Duplikaterkennung; daneben manuelles Formular mit freien Uhrzeiten für Kurse wie die SEM-Wahlkurse (feste Uhrzeiten statt Blockcode)
- **Daten & Teilen-Tab:** Automatische Speicherung im Browser (localStorage), JSON-Export/-Import, Druckfunktion für den Wochenplan, Reset auf Startkurse

### Überarbeitungen nach Feedback
1. Vollständig auf Englisch umgestellt (UI, Wochentage, Status-Labels, Meldungen)
2. Layout schmaler (max. 1240px Inhaltsbreite statt volle Bildschirmbreite)
3. Doppelte CP-Anzeige aufgelöst: Zähler jetzt direkt in den Status-Toggles ("Booked · 4 · 6 CP") plus kompakte Gesamtsumme im Header ("6 CP · booked · 4 courses · X CP pending"); in der Kursliste eine schlanke Textzeile statt der alten Chip-Reihe
4. Wochenraster-Bänder (Block 1/3/5-Hintergrund) laufen jetzt durchgehend bis zum Start des nächsten Blocks, keine weiße Lücke mehr in der Pause
5. Neue Ansicht **"All weeks · combined (max load)"** im Wochen-Dropdown: überlagert alle sichtbaren Kurse unabhängig von ihren tatsächlichen Wochen, um die maximal mögliche Wochenbelastung auf einen Blick zu sehen

### Startkurse (Stand des Exports)
| Kurs | Dozent | Zeit | Wochen | CP | Status |
|---|---|---|---|---|---|
| Digital Economy: Global versus Chinese Perspectives | CHEN Yubo | Mo 08:00–11:25 | 1-3,5 | 1 | Booked |
| Frontiers of Chinese Contemporary Issues Research | HE Ping | Mi 13:30–16:55 | 6-9 | 1 | Booked |
| Leadership in A New Era | HU Jia | Mi 19:00–22:00 | 5-14 (Diskrepanz zur MBA-PDF: dort 1-3,5-16) | 2 | Booked |
| Elementary Chinese B | ZHU Wentao | Fr 13:30–16:05 | 1-12 | 2 | Booked |

Ergebnis-Datei: `Tsinghua-Course-Planner.html` (eigenständig, offline lauffähig, Weitergabe per Dateiversand).

---

## 3. Offene Punkte / Prüfhinweise

- Wochenangabe für *Leadership in A New Era* zwischen Elective-Liste (Week 5-14) und MBA-Stundenplan (Week 1-3,5-16) widersprüchlich — vor Semesterstart klären und im Planer korrigieren.
