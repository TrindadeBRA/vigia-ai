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

`./dev release x.y.z` (em `./dev`, `bump_all_versions()`) já bumpa os 3
`package.json` + `version.ts` e comita — é o caminho recomendado. O que
segue é o passo a passo manual, pra quando precisar bumpar sem o script
ou entender o que ele faz por baixo.

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

# 7. depois que a matriz de 4 runners terminar, atualiza a Homebrew tap
./dev cask
```

`git push` da tag dispara `.github/workflows/release-desktop.yml` (matriz
macOS arm64/x64, Windows, Linux) automaticamente. `./dev release x.y.z`
faz os passos 1, 4 e 6 (com as travas de `release_guards`); `./dev cask`
faz o 7.

## Por que a versão do desktop manda

O `electron-builder` decide o nome do release do GitHub pela **versão do
`desktop/package.json`**, não pela tag que disparou o build. Se o desktop
ficar pra trás (ex.: só backend e frontend foram bumpados — ou vice-versa),
o CI builda com a versão errada e tenta sobrescrever assets de um release
que já existe → `422 Unprocessable Entity (already_exists)` no upload do
`.blockmap`. Foi exatamente o que aconteceu subindo a v2.2.0: backend e
frontend foram pra 2.2.0 à mão, desktop ficou esquecido em 2.1.1, e o CI
tentou regravar o release da v2.1.1. `./dev release` (`bump_all_versions()`)
existe pra isso não voltar a acontecer — bumpa os três juntos, sempre.

## Se precisar apagar e refazer uma tag

Apagar a tag (`git tag -d` local + `git push origin :refs/tags/vX.Y.Z`)
**não cancela** um run do Actions que ela já disparou — o run continua
rodando contra o commit que tinha no momento do push. Cancele o run antes
de subir a tag nova:

```bash
gh run list --workflow=release-desktop.yml --limit 3
gh run cancel <id-do-run-preso>
```

## O release publica direto (não é mais rascunho)

Por padrão o `electron-builder` cria o release do GitHub como **draft**
(some do `gh release view` / `gh api repos/.../releases/tags/vX.Y.Z` — dá
404, a API de "get by tag" não enxerga draft; só aparece listando tudo com
`gh api --paginate repos/.../releases --jq '.[] | "\(.tag_name) draft=\(.draft)"'`).
Isso já causou confusão (v2.2.1 ficou um draft esquecido, ninguém clicou em
"Publish release"). Corrigido com `releaseType: release` em
`desktop/electron-builder.yml` → `publish:` — o release fica público assim
que os 4 jobs da matriz (macOS arm64, macOS x64, Windows, Linux) terminam
de subir os assets, sem clique manual. Único efeito colateral: durante os
~2-3min em que os jobs ainda estão rodando, o release já existe publicamente
mas pode estar com assets incompletos — aceitável pro tamanho do projeto.

## Corrida entre os dois jobs macOS (mesmo release, mesmo nome de arquivo)

`desktop/electron-builder.yml` tinha `arch: [arm64, x64]` fixo nos targets
`dmg`/`zip` — cada job da matriz (arm64 e x64) buildava os **dois** archs e
tentava subir os mesmos nomes de asset pro mesmo release. Antes passava
despercebido porque o job x64 rodava em `macos-13` (ver seção seguinte) e
ficava preso em fila muito depois do arm64 terminar — sem sobreposição, sem
corrida. Ao mover x64 pra `macos-14`, os dois passaram a rodar em paralelo
e colidir (`422 already_exists` no upload, arm64 falhando na v2.2.2).
Corrigido removendo o `arch:` fixo do `mac.target` — cada job builda só o
arch que a CLI pede (`--arm64`/`--x64`, já configurado no workflow). Local
`npm run dist:mac` ganhou `--x64 --arm64` explícitos pra continuar gerando
os dois de uma vez.

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
silenciosamente). O script roda `xattr -cr` no app — mas o **próprio
script** também vem quarentenado dentro do `.dmg` baixado, então o
Gatekeeper pode bloquear ele também ("Não Foi Aberto", sem botão de abrir
mesmo assim). Nesse caso o caminho é direto no Terminal, sem passar pelo
Finder: `xattr -cr "/Applications/Vigia AI.app"` (rodar um binário já
confiável do sistema com o caminho como argumento não passa pela mesma
checagem de LaunchServices que bloqueia abrir/executar um app ou script
não assinado). Correção de verdade exige conta paga da Apple Developer
Program (US$99/ano) pra assinar e notarizar — sem isso, todo download
direto do `.dmg` vai continuar caindo nesse aviso. **A distribuição via
Homebrew (seção abaixo) evita o problema por completo**, sem custo.

## Distribuição via Homebrew Cask (evita o Gatekeeper de vez, de graça)

Tap própria: [`TrindadeBRA/homebrew-vigia-ai`](https://github.com/TrindadeBRA/homebrew-vigia-ai)
(repo separado — padrão do Homebrew, precisa do prefixo `homebrew-`).
Instalação do usuário final:

```bash
brew tap TrindadeBRA/vigia-ai
brew install --cask vigia-ai
```

**Por que isso funciona sem certificado**: o Gatekeeper só bloqueia código
não assinado no momento em que é **executado via Finder/LaunchServices**
(duplo clique). `brew install --cask` baixa o `.dmg` via `curl` — que
*também* grava `com.apple.quarantine` (confirmado inspecionando o `.dmg`
em cache do brew) — mas o cask declara um `postflight_steps` que roda
`xattr -cr` no app **como parte do próprio fluxo de instalação do brew**,
não como um "abrir" separado pelo Finder. Por isso funciona onde o
`fix-gatekeeper.command` (que É aberto pelo Finder) esbarra na mesma trava
que ele deveria resolver.

`Casks/vigia-ai.rb`:

```ruby
postflight_steps do
  run "/usr/bin/xattr", args: ["-cr", "{{appdir}}/Vigia AI.app"]
end
```

Use `postflight_steps` (não o antigo `postflight do...end`, que gera
`Warning: Calling 'postflight' is deprecated`). Dentro desse bloco não
existe interpolação Ruby (`#{appdir}` dá `NoMethodError` — a classe do DSL
undefine quase todo método padrão); o caminho é resolvido depois, no
processo sandboxed que executa o step, via template literal `{{appdir}}`
na própria string (mecanismo genérico do Homebrew, funciona em qualquer
campo `args`/`command`/etc., não só nos dedicados a path).

**Atualizar a fórmula a cada release**: `./dev cask` (depois que a matriz
de 4 runners do `./dev release` terminar) — baixa os `.dmg` arm64/intel do
release, recalcula os `sha256`, e dá push na tap usando o `gh`/git já
autenticados nesta máquina. Não depende de secret novo no CI porque roda
localmente, não dentro do GitHub Actions (empurrar pra um repo diferente
de dentro de uma Action exigiria um PAT com permissão cross-repo — o
`GITHUB_TOKEN` automático só enxerga o repo onde a Action roda).

**Homebrew recente exige "trust" pra taps de terceiros** — na primeira vez
(e depois de mudanças na fórmula), pode aparecer:

```
Error: Refusing to load cask trindadebra/vigia-ai/vigia-ai from untrusted tap trindadebra/vigia-ai.
Run `brew trust --cask trindadebra/vigia-ai/vigia-ai` or `brew trust trindadebra/vigia-ai` to trust it.
```

É esperado — não é um erro do cask. O usuário roda o `brew trust` sugerido
uma vez.
