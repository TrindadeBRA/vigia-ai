# App desktop (Electron)

O Vigia AI roda como aplicativo em Linux, macOS e Windows. É o **mesmo produto**:
o app embarca o coletor FastAPI e a janela carrega `http://127.0.0.1:<porta>/display`,
o endereço que o navegador e a ESP32 já usavam.

Plano completo: [`PLANO_ELECTRON.md`](PLANO_ELECTRON.md). Decisões: [`DECISOES.md`](DECISOES.md).

## Instalar

Baixe da [página de releases](https://github.com/TrindadeBRA/vigia-ai/releases):

| SO | Arquivo |
| --- | --- |
| macOS | `Vigia AI-<versão>-arm64.dmg` (Apple Silicon) ou `Vigia AI-<versão>.dmg` (Intel) |
| Windows | `Vigia AI Setup <versão>.exe` — instala no usuário, sem pedir admin |
| Linux | `Vigia AI-<versão>.AppImage` (roda direto) ou `.deb` |

Não é preciso ter Python ou Node: o coletor vai dentro do pacote.

## O que muda em relação ao `./dev up`

Nada no produto. O que o app acrescenta:

- **Bandeja**: o coletor continua servindo a placa mesmo com a janela fechada.
- **Abrir junto com o sistema**: a ESP32 encontra o coletor sem você abrir nada.
- **Acesso pela rede local** (liga/desliga): desligado, o coletor só aceita
  conexões deste computador e a placa deixa de enxergar o painel.
- **Abrir no navegador**: continua sendo uma aba comum quando você preferir.
- **Diálogo nativo** ao baixar o `secrets.h` e ao exportar alarmes.

Tudo isso fica no card **Aplicativo** em `/display/config`, que só aparece
dentro do app.

## Onde ficam os arquivos

`backend/data/` só é usado quando você roda a partir do código. No app
instalado os dados vão para a pasta do usuário:

| SO | Pasta |
| --- | --- |
| macOS | `~/Library/Application Support/vigia-ai-desktop/data` |
| Windows | `%APPDATA%\vigia-ai-desktop\data` |
| Linux | `~/.config/vigia-ai-desktop/data` |

Na primeira execução o app **copia** o `backend/data/` do repositório, se
existir — quem já usava `./dev up` não abre o app com as contas em branco.
Logs ficam em `.../vigia-ai-desktop/logs/`. Os dois têm atalho no card Aplicativo.

## Porta e a placa

A porta padrão continua **8787**, e ela importa: a ESP32 guarda
`USAGE_URL` no `secrets.h`. Por isso o app **nunca** troca de porta sozinho.

- Se a porta estiver ocupada por **outro Vigia** (um `./dev up` aberto), o app
  se conecta a ele em vez de subir um segundo coletor.
- Se estiver ocupada por outro programa, o app avisa e propõe uma porta livre —
  deixando claro que trocar exige gerar e regravar o `secrets.h` pelo painel.

## Desenvolvimento

```bash
./dev app          # Electron usando o backend/.venv e o frontend/dist do repo
./dev app build    # instalador da plataforma atual, em dist/
./dev test         # inclui o typecheck do desktop e o handshake do sidecar
```

O sidecar é compilado **no SO de destino** — PyInstaller não faz cross-compile.
Por isso o release roda numa matriz de quatro runners
(`.github/workflows/release-desktop.yml`).

## Assinatura de código

| SO | Situação |
| --- | --- |
| **macOS** | Precisa de Developer ID + notarização. Sem os segredos `MAC_CERT_P12`, `APPLE_ID`, `APPLE_APP_PASSWORD` e `APPLE_TEAM_ID` no repositório, o build sai **sem assinar**: instala, mas o Gatekeeper reclama na primeira abertura (botão direito → Abrir). |
| **Windows** | Sem assinatura Authenticode o SmartScreen mostra um aviso na primeira execução. |
| **Linux** | Não se aplica. |

### Keychain no macOS

O provedor Claude lê o OAuth via `security find-generic-password`. Rodando pelo
Terminal isso funciona porque o Terminal já tem a autorização do item. Dentro de
um `.app` o macOS pode pedir confirmação na primeira leitura — e se não houver
janela em primeiro plano, o `security` devolve *"User interaction is not
allowed"*, tratado em `backend/app/local/claude_oauth.py`.

Se acontecer, os caminhos alternativos continuam valendo:
`~/.claude/.credentials.json` ou colar o token no painel.

## Solução de problemas

| Sintoma | O que fazer |
| --- | --- |
| "A porta 8787 está ocupada" | Feche o `./dev up` ou aceite a porta que o app propõe (e regrave o `secrets.h`) |
| "Coletor não encontrado" (em dev) | Rode `./dev up` uma vez para criar o `backend/.venv` |
| A placa parou de achar o coletor | Confira o toggle **Acesso pela rede local** no card Aplicativo |
| O app não abre depois de atualizar | Card Aplicativo → **Abrir a pasta de logs** e veja `main.log` |
