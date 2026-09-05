# Release (versão + tag)

Checklist pra subir uma versão nova. Backend, frontend e desktop têm
versão própria em `package.json`, mas **têm que andar juntas** — o
electron-builder usa `desktop/package.json`, não a tag do git, pra decidir
em qual GitHub Release publicar (ver "Por que a versão do desktop manda").

## Arquivos que mudam a cada versão

| Arquivo | O que tem |
| --- | --- |
| `backend/package.json` | campo `version` |
| `backend/src/version.ts` | `export const VERSION = "x.y.z"` — aparece em `/health`, no Swagger (`/docs`), no `User-Agent` de saída e no status do desktop |
| `frontend/package.json` | campo `version` — `vite.config.ts` injeta como `__APP_VERSION__` em build time, `frontend/src/version.ts` exporta `APP_VERSION`, mostrado no rodapé de `SettingsDrawer.tsx` (Aparência → Versões) |
| `desktop/package.json` | campo `version` — é o que o `electron-builder` usa pro nome dos instaladores **e** pra decidir a release do GitHub |
| `desktop/package-lock.json` | roda `npm install --package-lock-only` dentro de `desktop/` depois de editar o `package.json`, senão o lockfile fica com a versão velha |

Não existe script que faça isso automaticamente — é find-and-replace manual
nos 5 arquivos (ou `sed`), sempre pro mesmo `x.y.z`.

## Passo a passo

```bash
# 1. edita os 3 package.json + version.ts pra mesma versão nova
# 2. sincroniza o lockfile do desktop
cd desktop && npm install --package-lock-only && cd ..

# 3. confere que nada quebrou
(cd backend && npx tsc -p tsconfig.json --noEmit)
(cd frontend && npx tsc --noEmit)
(cd desktop && npx tsc -p tsconfig.json --noEmit)

# 4. commit + push em develop
git add backend/package.json backend/src/version.ts frontend/package.json \
        desktop/package.json desktop/package-lock.json
git commit -m "chore: versão x.y.z"
git push origin develop

# 5. main é sempre fast-forward de develop (nunca tem commit próprio)
git checkout main && git merge --ff-only develop && git push origin main

# 6. tag anotada no padrão "Vigia AI x.y.z", só depois do push da main
git tag -a vx.y.z -m "Vigia AI x.y.z"
git push origin vx.y.z

git checkout develop
```

`git push` da tag dispara `.github/workflows/release-desktop.yml` (matriz
macOS arm64/x64, Windows, Linux) automaticamente.

## Por que a versão do desktop manda

O workflow builda com `--publish onTagOrDraft`. O `electron-builder` decide
o nome do release do GitHub pela **versão do `desktop/package.json`**, não
pela tag que disparou o build. Se o desktop ficar pra trás (ex.: só backend
e frontend foram bumpados), o CI builda com a versão antiga e tenta
sobrescrever assets de um release que já existe → `422 Unprocessable Entity
(already_exists)` no upload do `.blockmap`. Foi exatamente o que aconteceu
subindo a v2.2.0: backend/frontend foram pra 2.2.0, desktop ficou em 2.1.1,
e o CI tentou regravar o release da v2.1.1.

## Se precisar apagar e refazer uma tag

Apagar a tag (`git tag -d` local + `git push origin :refs/tags/vX.Y.Z`)
**não cancela** um run do Actions que ela já disparou — o run continua
rodando contra o commit que tinha no momento do push. Cancele o run antes
de subir a tag nova:

```bash
gh run list --workflow=release-desktop.yml --limit 3
gh run cancel <id-do-run-preso>
```

## O release nasce como rascunho (draft)

`onTagOrDraft` publica como **draft** — não aparece em `gh release view` /
`gh api repos/.../releases/tags/vX.Y.Z` (dá 404, a API de "get by tag" não
enxerga draft). Pra ver, listar com drafts incluídos:

```bash
gh api --paginate repos/TrindadeBRA/vigia-ai/releases \
  --jq '.[] | "\(.tag_name) draft=\(.draft) assets=\(.assets|length)"'
```

Cada job da matriz sobe os assets da própria plataforma pro mesmo draft —
só fica "pronto" quando os 4 jobs (macOS arm64, macOS x64, Windows, Linux)
terminarem. Alguém ainda precisa entrar no GitHub e clicar em **Publish
release** pra tirar do rascunho.

## macOS x64 sempre trava a fila

O job `macOS (x64)` usava o runner `macos-13` (Intel) — a GitHub vem
reduzindo essa frota e a fila pode passar de 20-30min (já aconteceu do job
nunca sair de `queued`, `runner_id: 0`, até eu cancelar o run inteiro).
Corrigido usando `macos-14` (Apple Silicon) pra cross-buildar o x64 também
(`--mac --x64` roda numa máquina arm64 sem problema — é o padrão
recomendado pelo próprio electron-builder desde que a Apple/GitHub reduziu
os runners Intel).

## macOS sem certificado: "app está danificado"

Sem `MAC_CERT_P12` / `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` /
`APPLE_TEAM_ID` configurados como secrets do repo, o build sai só com
assinatura *ad-hoc* (`codesign -dv` mostra `flags=0x20002(adhoc,linker-signed)`,
sem Team ID). Baixado pelo navegador, o macOS grava a flag de quarentena
(`com.apple.quarantine`) e o Gatekeeper — principalmente em Apple Silicon —
mostra **"está danificado e não pode ser aberto"** em vez do aviso mais
brando de "desenvolvedor não identificado". O app não está corrompido.

Mitigado (sem certificado pago) com `desktop/build/fix-gatekeeper.command`,
incluído dentro do `.dmg` (`desktop/electron-builder.yml` → `dmg.contents`,
precisa de `type: file` explícito ou o electron-builder ignora o item
silenciosamente). O script roda `xattr -cr` no app. Correção de verdade
exige conta paga da Apple Developer Program (US$99/ano) pra assinar e
notarizar de verdade — sem isso, todo download vai continuar caindo nesse
aviso.
