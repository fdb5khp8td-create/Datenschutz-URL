# Prüfung der Premium-Webseite

Datum: 29. Oktober 2026

## Ergebnisse vor Veröffentlichung

- Startseite, Impressum und Datenschutz bei 320, 360, 390, 768, 1024 und 1440 Pixeln: 18 Kombinationen ohne horizontalen Überlauf und mit genau einer Hauptüberschrift.
- axe-core: keine automatisch erkannten Verstöße gegen die geprüften Regeln aus WCAG 2 A/AA und WCAG 2.1 AA in diesen 18 Kombinationen. Dies ersetzt keine vollständige manuelle Barrierefreiheitsprüfung.
- Ohne JavaScript: mobile Navigation sichtbar, alle drei Alltagsvisualisierungen lesbar, native Videosteuerung verfügbar; kein horizontaler Überlauf.
- Produktvorschau: Status, Name und Fokus wechseln Bild, Alternativtext und Auswahlzustand.
- Mobiles Menü: Öffnen, Schließen mit Escape und Schließen nach Navigation geprüft.
- Drei Alltagsvisualisierungen: Auswahl und sichtbarer Inhalt stimmen überein.
- 3D-Modell lädt; drei Ansichten und fünf Displayinhalte lassen sich auswählen. Automatische Drehung lässt sich ein- und ausschalten.
- App-Vorschau: Startanimation und erneuter Start geprüft; Scrollen per Pfeiltaste funktioniert.
- Produktfilm: Wiedergabe ohne Medienfehler sowie Pause geprüft.
- FAQ lässt sich öffnen.
- Interne Links und lokale Medienverweise geprüft; JavaScript-Syntaxprüfung erfolgreich.
- Impressum- und Datenschutz-Hauptinhalte sowie CNAME und Hosting-Hilfsdateien entsprechen dem übernommenen Stand.

## Grenzen

Die Browserprüfung erfolgte in einer Chromium-Umgebung mit verschiedenen Ansichtsbreiten, nicht auf physischen Endgeräten. Nicht getestet wurden eine echte Bluetooth-Verbindung, App-Käufe oder Bestellungen; diese werden nicht von der Website ausgeführt. Der Shop bleibt bis zur Konfiguration inaktiv.
