# WorkBadge – Premium-Webseite

Öffentliche Website: https://workbadge.de/ · Hosting: GitHub Pages

## Aktualisierung vom 12. November 2026

- Startseite klarer gegliedert: Auswahl „Welches WorkBadge suchst du?“ direkt nach dem Einstieg – WorkBadge (Namensschild, grün) und WorkBadge Rooms (für Firmen, Graphit/Blau).
- Entfernt: Hinweisleiste, Vergleichstabelle, Detailansichten, Einrichtungsschritte, doppelter Kontaktbereich, interaktive Rooms-Beispielanzeige.
- Rooms als eigener Abschnitt am Ende der Startseite mit direktem Weg zu Download und Browser-Version (`/rooms/`). Navigation und Fußzeile verlinken Rooms und den Download.

## Aktualisierung vom 2. November 2026

- WorkBadge Rooms als eigenständigen Ausblick vor den FAQ integriert, mit einer ausdrücklich gekennzeichneten KI-Konzeptvisualisierung, interaktiver Beispielanzeige und unverbindlicher E-Mail-Anfrage. Noch kein bestellbares Produkt; keine Zusage zu Starttermin oder fertigen Kalenderanbindungen.
- Neue Detailansichten des bestehenden WorkBadge: Vorderseite, Rückseite und schematischer Aufbau, aus den vorhandenen Original-STL-Renderings.
- Dezente einmalige Einblendungen, Hover-Details und Lesefortschritt. Inhalte bleiben ohne JavaScript sichtbar; reduzierte Bewegung wird berücksichtigt.
- Neue Bilder als kompakte WebP-Dateien, Rooms mit responsiven Bildgrößen. Die große PNG-Quelldatei wird von der Seite nicht geladen.
- Aktuelle Prüfung: `VERIFICATION-ROOMS-2026-11-02.md`. Die folgenden Angaben dokumentieren die frühere Überarbeitung.

Überarbeitet am 29. Oktober 2026. Der aktuelle GitHub-Stand einschließlich App-Vorschau und Spielen wurde in das neue Design übernommen.

## Inhalte

- Helles Produktdesign mit grünen Akzenten, großer Typografie und responsiver Navigation.
- Drei wechselbare Produktbilder aus den vorhandenen 3D-Renderings, als WebP optimiert (jeweils etwa 30 KB).
- Aktuelle App-Vorschau mit Startanimation, sechs Funktionsbeschreibungen und vier Spielen.
- Drei wechselbare Alltagsvisualisierungen und App-Store-Verknüpfung.
- Interaktives 3D-Modell mit fünf Anzeigen, drei Ansichten, optionaler Drehung und Tastaturbedienung. Wird erst in der Nähe des Abschnitts geladen.
- Produktfilm mit Abspielen/Pause und Rücksicht auf reduzierte Bewegung sowie inaktive Tabs.
- Einrichtung, FAQ, Produktanfrage, Impressum und Datenschutz.
- Lokale Schriftarten und Medien. Vorhandene Plausible-Integration bleibt bestehen.

## Vorschau und Veröffentlichung

Die Website benötigt keinen Build-Schritt. In diesem Ordner einen lokalen HTTP-Server starten und die Domainwurzel öffnen. Die Pfade zu Assets beginnen mit `/`.

GitHub Pages veröffentlicht den Inhalt des Hauptbranches. `CNAME`, `.nojekyll`, `robots.txt` und `sitemap.xml` gehören zur Website. Bestehende Dateien außerhalb der Überarbeitung bleiben erhalten.

## Produktanfrage und App

Der Shopify-Storefront-Token ist weiterhin leer. Bis zur Aktivierung zeigt die Website eine unverbindliche Produktanfrage per E-Mail und lädt kein Shopify-Skript. Die App-Store- und E-Mail-Ziele wurden beibehalten. Spielpreise wurden aus der aktuellen Repository-Version übernommen; maßgeblich sind die Angaben in der App und im App Store.

Der Wortlaut der vorhandenen rechtlichen Hauptinhalte wurde nicht verändert. Es erfolgte keine rechtliche Neubewertung.

## Prüfungen

Siehe `VERIFICATION.md` für die durchgeführten Prüfungen und deren Grenzen.
