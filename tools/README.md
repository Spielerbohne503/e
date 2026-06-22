# Ordner & Dateien als TXT speichern

Zwei kleine Werkzeuge, die alle Ordner und Dateien in einem ausgewählten Ordner
einlesen und die Baumstruktur als `.txt`-Datei speichern. Sie laufen auf
**Linux und Windows ohne Installation**.

Beispiel-Ausgabe:

```
MeinOrdner/
   |_> video.mp4
   |_> bilder/
      |_> foto1.jpg
      |_> foto2.jpg
   |_> notizen.txt
```

---

## 1) Browser-Version (empfohlen, gar keine Installation)

**Datei:** `ordner-zu-txt.html`

1. Datei `ordner-zu-txt.html` per Doppelklick öffnen (läuft in jedem Browser:
   Chrome, Edge, Firefox, Safari, Opera).
2. Auf **„Ordner auswählen"** klicken und den gewünschten Ordner wählen.
3. Die Baumstruktur wird angezeigt.
4. Auf **„Als .txt speichern"** klicken — fertig.

Optionen:
- **„nur Ordner"** blendet die Dateien aus und zeigt nur die Ordnerstruktur.
- **„Kopieren"** legt den Text in die Zwischenablage.

Hinweise:
- Es werden **keine Daten hochgeladen** — alles passiert lokal auf deinem Gerät.
- In **Chrome / Edge / Opera** werden auch komplett leere Unterordner erfasst.
- In **Firefox / Safari** werden Ordner anhand der enthaltenen Dateien erkannt;
  völlig leere Unterordner können dort fehlen.

---

## 2) Kommandozeilen-Version (Python)

**Datei:** `ordner-zu-txt.py` — benötigt nur Python 3
(auf Linux meist vorinstalliert; für Windows von [python.org](https://www.python.org/)).

Einfach starten, dann nach dem Ordner fragen lassen:

```bash
python ordner-zu-txt.py
```

Mit Ordner direkt als Argument:

```bash
# Linux
python ordner-zu-txt.py /home/ich/videos

# Windows
python ordner-zu-txt.py "C:\Users\Ich\Videos"
```

Weitere Optionen:

```bash
# eigene Ausgabedatei festlegen
python ordner-zu-txt.py /pfad/zum/ordner -o struktur.txt

# nur Ordner auflisten (ohne Dateien)
python ordner-zu-txt.py /pfad/zum/ordner --nur-ordner
```

Wird kein `-o`/`--ausgabe` angegeben, heißt die Datei automatisch
`<Ordnername>_struktur.txt`.

Unter Windows kann die `.py`-Datei auch per **Doppelklick** gestartet werden;
das Programm fragt dann nach dem Ordner und hält das Fenster am Ende offen.
