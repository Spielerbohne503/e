#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ordner-zu-txt.py
================
Liest alle Ordner und Dateien in einem ausgewaehlten Ordner und speichert
die Baumstruktur als .txt-Datei.

Laeuft auf Linux UND Windows, ohne Installation – es wird nur Python 3
benoetigt (auf den meisten Linux-Systemen vorinstalliert; fuer Windows von
python.org).

Beispiel-Ausgabe:

    MeinOrdner/
       |_> video.mp4
       |_> bilder/
          |_> foto1.jpg
          |_> foto2.jpg
       |_> notizen.txt

Verwendung
----------
  Doppelklick (Windows) oder einfach starten -> fragt nach dem Ordner:
      python ordner-zu-txt.py

  Mit Ordner als Argument:
      python ordner-zu-txt.py "C:\\Users\\Ich\\Videos"
      python ordner-zu-txt.py /home/ich/videos

  Mit eigener Ausgabedatei und nur Ordnern:
      python ordner-zu-txt.py /pfad/zum/ordner -o struktur.txt --nur-ordner
"""

import argparse
import datetime
import os
import re
import sys


def liste_eintraege(pfad):
    """Eintraege eines Ordners holen, alphabetisch, Ordner zuerst.
    Gibt eine Liste von (name, ist_ordner) zurueck."""
    try:
        eintraege = list(os.scandir(pfad))
    except (PermissionError, OSError):
        return []

    def schluessel(e):
        try:
            ist_ordner = e.is_dir(follow_symlinks=False)
        except OSError:
            ist_ordner = False
        # Ordner (0) vor Dateien (1), dann nach Name (klein geschrieben)
        return (0 if ist_ordner else 1, e.name.lower())

    eintraege.sort(key=schluessel)
    ergebnis = []
    for e in eintraege:
        try:
            ist_ordner = e.is_dir(follow_symlinks=False)
        except OSError:
            ist_ordner = False
        ergebnis.append((e.name, e.path, ist_ordner))
    return ergebnis


def baue_baum(wurzel, nur_ordner=False):
    """Erzeugt die Textzeilen des Baums und zaehlt Ordner/Dateien."""
    zeilen = []
    zaehler = {"ordner": 0, "dateien": 0}

    name = os.path.basename(os.path.normpath(wurzel)) or wurzel
    zeilen.append(name + "/")

    def rekursion(pfad, tiefe):
        for eintrag_name, eintrag_pfad, ist_ordner in liste_eintraege(pfad):
            if nur_ordner and not ist_ordner:
                continue
            if ist_ordner:
                zaehler["ordner"] += 1
            else:
                zaehler["dateien"] += 1
            label = eintrag_name + "/" if ist_ordner else eintrag_name
            zeilen.append("   " * tiefe + "|_> " + label)
            if ist_ordner:
                rekursion(eintrag_pfad, tiefe + 1)

    rekursion(wurzel, 1)
    return zeilen, zaehler


def erzeuge_text(wurzel, nur_ordner=False):
    baum, zaehler = baue_baum(wurzel, nur_ordner)
    jetzt = datetime.datetime.now().strftime("%d.%m.%Y, %H:%M:%S")
    name = os.path.basename(os.path.normpath(wurzel)) or wurzel
    kopf = [
        "Ordnerstruktur von: " + name,
        "Erstellt am: " + jetzt,
        "Ordner: {}   |   Dateien: {}".format(zaehler["ordner"], zaehler["dateien"]),
        "=" * 60,
        "",
    ]
    return "\n".join(kopf + baum) + "\n", zaehler


def sicherer_dateiname(name):
    name = re.sub(r"[^\w.\-]+", "_", name)
    return name or "ordner"


def main():
    parser = argparse.ArgumentParser(
        description="Liest alle Ordner und Dateien und speichert sie als .txt-Baum."
    )
    parser.add_argument("ordner", nargs="?", help="Pfad zum Ordner")
    parser.add_argument("-o", "--ausgabe", help="Pfad der Ausgabe-.txt-Datei")
    parser.add_argument(
        "--nur-ordner", action="store_true", help="nur Ordner auflisten, keine Dateien"
    )
    args = parser.parse_args()

    ordner = args.ordner
    if not ordner:
        try:
            ordner = input("Pfad zum Ordner eingeben: ").strip().strip('"')
        except (EOFError, KeyboardInterrupt):
            print("\nAbgebrochen.")
            return 1

    if not ordner:
        print("Kein Ordner angegeben.")
        return 1

    ordner = os.path.expanduser(ordner)
    if not os.path.isdir(ordner):
        print("Fehler: '{}' ist kein gueltiger Ordner.".format(ordner))
        return 1

    text, zaehler = erzeuge_text(ordner, nur_ordner=args.nur_ordner)

    if args.ausgabe:
        ausgabe = args.ausgabe
    else:
        basis = sicherer_dateiname(os.path.basename(os.path.normpath(ordner)))
        ausgabe = basis + "_struktur.txt"

    try:
        with open(ausgabe, "w", encoding="utf-8") as f:
            f.write(text)
    except OSError as e:
        print("Fehler beim Schreiben: {}".format(e))
        return 1

    print(text)
    print("-" * 60)
    print("Gespeichert in: {}".format(os.path.abspath(ausgabe)))
    print("Ordner: {}  |  Dateien: {}".format(zaehler["ordner"], zaehler["dateien"]))

    # Bei Doppelklick (Windows) Fenster offen halten
    if not args.ordner and os.name == "nt":
        try:
            input("\nMit Enter beenden …")
        except (EOFError, KeyboardInterrupt):
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
