# Placeholder - substitua antes de `make cia`

- `icon.png` 48x48 PNG (SMDH)
- `banner.png` 256x128 PNG (banner superior do HOME Menu)
- `banner.wav` mono 16-bit 32728Hz CWAV (bannertool converte)

Gere com:
```
bannertool makebanner -i banner.png -a banner.wav -o banner.bnr
bannertool makesmdh -s "Vigia AI" -l "Vigia AI" -p "TrindadeBRA" -i icon.png -o icon.icn
```

Sem esses arquivos `make` ainda gera `.3dsx`; `make cia` falha até eles existirem.
