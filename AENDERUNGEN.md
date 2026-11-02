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
