# Webseite entschlackt, neue Seite WorkBadge Home (04.11.2026)

- **Startseite** deutlich kürzer: Überschrift plus höchstens ein Satz je Abschnitt, mehr Bilder. Vorteile 7 → 4 Kacheln, App-Funktionen und Spiele nur noch Stichworte, „Ohne Schild“ mit vier Anzeigebildern, Vergleich 4 Zeilen, FAQ 9 → 6 (FAQ-JSON-LD wortgleich angepasst), Rooms ohne Ideenliste. Der alte Abschnitt `#home-funktionen` ist durch einen großen Teaser mit Bild ersetzt (`#home`, Button nach `/home/`). Nav: Vorteile · Home · Die App · Fragen · Dein WorkBadge. Texte im Detail-Umschalter (`assets/rooms.js`) gekürzt.
- **Neue Seite `home/index.html`** „WorkBadge Home“ nach Orten: Flur/Haustür (Losgeh-Wecker, Alles zu?, Wetter & Warnungen), Küche (Familien-Pinnwand, Abfallkalender, Haushaltsplan), Wohnzimmer (Strompreis-Ampel, Smart-Home-Werte), Gäste (WLAN per QR), Abschluss (kostenlose App, Familie ohne Schild, wenig Strom). Losgeh-Wecker und Pinnwand mit „Kommt mit dem nächsten Update“.
- **Bilder:** neun selbst gezeichnete SVG-Schildanzeigen (`assets/home/*.svg`, 250×122, nur Schwarz/Weiß, Herkunft in `assets/home/IMAGE-SOURCE.md`), Szenen/Schildrahmen per CSS (`assets/home.css`). Alle Inhalte sind Beispiele, der QR-Code ist ein nicht scanbares Muster. Die KI-Rooms-Szene wird auf der Home-Seite bewusst nicht verwendet (Büro-Tür, anderes Gerät).
- Sitemap um `/home/` ergänzt. Keine neuen Skripte, keine neuen externen Dienste.
- **Zur Prüfung durch Marcel:** (1) Smart-Home-Werte und „Alles zu?“ sind allgemein formuliert – stimmen Namen/Voraussetzungen (Home-Station, HomeKit/Matter)? (2) Beispielwerte (Strompreis 24 ct, Namen Lea/Ben/Max) sind erfunden und als Beispiel gekennzeichnet. (3) Seite erst zusammen mit dem App-Update veröffentlichen, wenn der Hinweis „Kommt mit dem nächsten Update“ entfallen soll.
- Hochzuladen: `index.html`, `home/index.html`, `sitemap.xml`, `assets/home.css`, `assets/home/` (9 SVG + IMAGE-SOURCE.md), `assets/rooms.js`.

# WorkBadge Home auf der Webseite (04.11.2026)

- Neuer Abschnitt `#home-funktionen` (zwischen „Ohne Schild ausprobieren“ und „Vergleich“), gleicher Stil wie „Ohne Schild“: **Losgeh-Wecker** und **Familien-Pinnwand** mit NEU-Kennzeichnung, dazu eine Zeile mit den Home-Kacheln (Gäste-WLAN, Haushaltsplan, Abfallkalender, Strompreis-Ampel, Warnungen & Pollen, „Alles zu?“). Nur vorhandenes Stylesheet (`usp.css`), keine neuen Dateien, Skripte oder Dienste.
- Datenschutz: neuer Abschnitt 9 „Familien-Pinnwand und Losgeh-Wecker“ (iCloud/CloudKit des Einrichtenden, Teilen nur mit Eingeladenen, Ablauf 4 Std. bis 1 Woche, Transitous-Abfrage). Danach Nummerierung um eins verschoben (Rechte = 10, Änderungen = 11). Stand-Datum der Erklärung nicht geändert.
- **Zur Prüfung durch Marcel (offen, nicht erfunden):**
  - Datenschutz Abschnitt 9: Die Transitous-Angaben stammen aus dem App-Code (`Transit.swift`): direkter Abruf von api.transitous.org, übertragen werden Suchtext, Haltestellenkennungen, Zeit, Sprache und App-Kennung sowie technisch bedingt die IP-Adresse; kein GPS, kein Termininhalt. Rechtsgrundlage (Art. 6 DSGVO) fehlt bewusst. Ein Link auf die Datenschutzhinweise von Transitous fehlt, weil die URL nicht bestätigt ist.
  - Die Texte beschreiben Funktionen der App-Version 1.64. Die Seite sollte erst zusammen mit dieser Version online gehen.
  - Ob die Home-Kacheln auf der Seite auch in der App-Version 1.62 so heißen, bitte prüfen.
- Hochzuladen: `index.html`, `datenschutz/index.html`, `AENDERUNGEN.md` (nur Doku).

# Statusbereich und Nachrichten (02.11.2026)

- `assets/status-config.js` (Token **leer**: kein Statusbereich, kein Netzwerkaufruf), `assets/status.js`, `assets/status.css`. Liest nach VERTRAG-STATUSSEITE.md `WorkBadgeGameSwitch/games` und `WorkBadgeAnnouncement` (website = show) per CloudKit JS, Zeitlimit 5 s, bei Fehler still ausgeblendet, Neuladen alle 5 Min bei sichtbarer Seite. Texte nur per textContent, Links nur https.
- Startseite: Nachrichten-Banner oben (schließbar, sessionStorage), Statusleiste unter der Kopfzeile mit Link auf `/status/`; Footer-Link „Status“.
- Neue Seite `status/index.html` (alle Spiele mit Status, Hinweis, „Stand“, Nachrichten), in `sitemap.xml`.
- Demo: `?statusdemo=1` (Startseite und Statusseite) mit Beispieldaten, ohne Token.
- **Zur Prüfung durch Marcel:** Datenschutz neuer Abschnitt 8 „Statusanzeige und Nachrichten (Apple CloudKit)“ (Folgeabschnitte neu nummeriert, Stand-Datum der Erklärung nicht geändert). Der Absatz ist neutral formuliert und nicht rechtlich geprüft.
- Offen: Web-API-Token eintragen (nur lesen, Domain workbadge.de); Feld `website` in CloudKit indizieren. Die Spieleliste enthält auch „Halbe Sachen“ (laut Vertrag), obwohl `GameAvailabilityPolicy.knownIDs` es noch nicht kennt.
- Nicht geprüft: echter CloudKit-Abruf (kein Token).

# Änderungen an der Webseite (02.11.2026)

- Rooms-Ausblick vor den FAQ: klarer Konzeptstatus, Türszene, umschaltbare Frei-/Belegt-Beispielanzeige und unverbindliche Interessentenanfrage per E-Mail.
- Navigation und Footer verlinken den Ausblick; die sichtbare Rooms-FAQ und die strukturierten FAQ-Daten stimmen überein.
- Realistische KI-Konzeptszene auf Grundlage der vorhandenen Rooms-Referenz; deutlich direkt am Bild gekennzeichnet. Zwei WebP-Größen für Desktop und Mobilgeräte.
- WorkBadge-Detailbereich mit Vorderseite, Rückseite und Explosionsansicht aus den vorhandenen STL-basierten Produktvisualisierungen. Bildherkunft unter `assets/details/IMAGE-SOURCE.md` und `assets/rooms/IMAGE-SOURCE.md`.
- Ruhige einmalige Einblendungen, Hover-Details, Lesefortschritt und weiche Bildwechsel. Keine neue Bibliothek. Betrieb ohne JavaScript und mit reduzierter Bewegung berücksichtigt.
- Impressum, Datenschutz, Domain und bestehende App-/Shop-Konfiguration beibehalten.

## Vorheriger Stand (30.10.2026)

Grundlage: `KONZEPT-USP-UND-BINDUNG.md`, aufgesetzt auf den Stand von origin/main (3D-Modell im Kopfbereich, aktueller App-Look, keine Abo-Preise). Geändert: `index.html`, neu `assets/usp.css`. Impressum und Datenschutz unverändert.

## Neu
- **Vorteile (`#vorteile`)**: die 7 Alleinstellungsmerkmale, die ersten vier hervorgehoben (Autopilot, Begegnungen ohne Internet, E-Ink ohne Strom, auch ohne Schild nutzbar).
- **Ohne Schild ausprobieren (`#ohne-schild`)**: App laden, Handy-Schild, BadgeBuddy kennenlernen, Bingo per Code, danach sanfter Hinweis auf das Schild.
- **Vergleich (`#vergleich`)**: WorkBadge, Papier-Namensschild, LCD-/LED-Schild. Nur allgemeine Eigenschaften, als echte Tabelle, mobil horizontal scrollbar.
- **FAQ** auf 8 Fragen (ohne Schild, Akku, Datenschutz, Abo neu; iPhone-Frage nennt den Autopilot). Keine Preise, Verweis auf App Store und App.
- **Navigation**: Vorteile, Ohne Schild, Vergleich ergänzt.

## Technik
- Titel, Description, Open Graph und Twitter-Tags angepasst.
- JSON-LD `Product` (ohne Preis) und `FAQPage` (deckungsgleich mit der sichtbaren FAQ).
- Fokusrahmen, Schrift mindestens 13 px, Tabelle mit `caption`/`scope`, 16 px Seitenrand mobil, keine neuen Skripte.

## Bewusst nicht versprochen
Keine Akku-Laufzeitzahl („wochenlang“), keine Tages-Serie, kein StandBy, keine NFC-Kontaktkarte, keine Preise, kein „Gemacht in Deutschland“.

## Nicht geprüft
Echte Geräte, vollständiger axe-core-Lauf. `VERIFICATION.md` ist der Stand vom 29.10.

## 2026-11-07 – Feinschliff nach apple-design
- `assets/experience.css`: Druck-Feedback auf `:active` (scale .97, 80–120 ms ease-out) für Knöpfe, Store-Button, Navigation, Karten; weiche Schatten statt harter Kartenrahmen; Navigation als `backdrop-filter`-Material mit Fallback (`@supports`, `prefers-reduced-transparency`, `prefers-contrast`); Überschriften enger (`-0.035em`), `text-wrap: balance`, Fließtext mobil mindestens 16 px; Reduced Motion ohne Bewegung.
- `assets/experience.js`: Einblenden kürzer (400 ms statt 620 ms, 10 px statt 18 px, Staffelung max. 90 ms).
- Cache-Busting `experience.css/js` auf `20261107-apple1`. Keine neuen Skripte, Texte unverändert.
