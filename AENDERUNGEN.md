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
