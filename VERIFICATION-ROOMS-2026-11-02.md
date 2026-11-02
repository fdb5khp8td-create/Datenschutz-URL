# Prüfung der Rooms-Erweiterung

Datum: 2. November 2026.

## Darstellung und Bedienung

- Startseite bei 320, 390, 768, 1024, 1440 und 1920 Pixeln geprüft: kein horizontaler Überlauf, jeweils eine Hauptüberschrift, keine fehlenden sofort geladenen Bilder.
- Rooms und Produktdetails bei 390 und 1440 Pixeln als Bildschirmbilder visuell geprüft.
- Mobiles Menü und Navigation zum Rooms-Ausblick geprüft; das Menü schließt nach der Auswahl.
- Rooms-Beispielanzeige wechselt zwischen Frei und Belegt. Sichtbare Texte, ausgewählte Schaltfläche und zugängliche Beschreibung stimmen überein.
- E-Mail-Ziel und Betreff der unverbindlichen Rooms-Anfrage geprüft. Es wurde keine Nachricht versandt.
- Vorderseite, Rückseite und schematischer Aufbau laden korrekt. Bei verzögertem Bildladen gilt die letzte Auswahl, auch bei Rückkehr zur noch sichtbaren Ansicht.
- Rooms-FAQ und strukturierte FAQ-Daten enthalten die gleichen neun Fragen.
- Alle internen Fragmentlinks zeigen auf vorhandene Ziele; der unkonfigurierte Shop lädt kein Shopify-Skript.
- Ohne JavaScript bleiben Navigation, Rooms, Beispielanzeige und Produktbilder lesbar. Schaltflächen für die nicht verfügbaren Bild-/Statuswechsel werden ausgeblendet.
- Animationen mit normaler Bewegung und beim Wechsel zu reduzierter Bewegung geprüft. Die neuen Bild- und Statusanimationen werden dabei beendet.

## Automatische Prüfungen

- axe-core für WCAG 2 A/AA und WCAG 2.1 AA auf Startseite, Impressum und Datenschutz bei jeweils 390 und 1440 Pixeln: nach der Korrektur keine automatisch erkannten Verstöße gegen die geprüften Regeln.
- Ein bereits vorhandener zu heller Hinweis unter dem Produktfilm wurde korrigiert. Die Startseite wurde danach in beiden Größen erneut geprüft.
- Keine JavaScript-Laufzeitfehler und keine lokalen HTTP-Fehler im Browserlauf.
- 47 lokale Medien-, Script- und Stylesheet-Verweise auf 33 eindeutige Dateien geprüft: alle vorhanden.
- 54 IDs ohne Duplikate; 32 statische Fragmentverweise mit gültigem Ziel.
- JSON-LD parsebar; neue JavaScript-Dateien mit `node --check` geprüft; `git diff --check` erfolgreich.
- Impressum, Datenschutz und CNAME gegenüber dem übernommenen Stand unverändert.

## Bildherkunft und Ladezeiten

- WorkBadge-Detailansichten aus vorhandenen STL-basierten 3D-Produktvisualisierungen: zusammen rund 54 KB als WebP.
- Rooms-Szene mit dem eingebauten Imagegen-Werkzeug anhand der vorhandenen Konzeptreferenz erzeugt. Direkt am Bild ausdrücklich als KI-Konzeptvisualisierung gekennzeichnet.
- Responsive Rooms-Bilder: rund 40 KB bei 800 Pixeln und 113 KB bei 1440 Pixeln Breite. Die 2,2-MB-PNG-Quelle wird von der Website nicht angefordert.
- Herkunft und finaler Bildprompt unter `assets/details/IMAGE-SOURCE.md` und `assets/rooms/IMAGE-SOURCE.md` dokumentiert.

## Grenzen

Browserprüfung in Chromium mit verschiedenen Fenstergrößen, keine Prüfung auf physischen Endgeräten und kein vollständiger manueller Barrierefreiheitsnachweis. Keine echte Rooms-Hardware, Kalenderintegration, App-Käufe oder Bestellungen getestet. Rooms bleibt ein Konzept ohne zugesagten Starttermin.
