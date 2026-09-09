Já inclusos: `icon.png` (48x48) + `banner.png` (256x128) + `banner.wav` (mono 32728Hz) — `make cia` funciona direto.

Para trocar a arte, regenere com:
```
bannertool makebanner -i banner.png -a banner.wav -o banner.bnr
bannertool makesmdh -s "Vigia AI" -l "Vigia AI" -p "TrindadeBRA" -i icon.png -o icon.icn
```
