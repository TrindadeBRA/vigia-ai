# Descobertas — PTZ em câmeras clone (Yoosee ✅ / V360 Pro ❌)

Investigação feita em 2026-09-07, em campo, contra as câmeras reais do usuário. Complementa [`.agents/PLANO_CAMERA.md`](../PLANO_CAMERA.md).

## Yoosee — funcional ✅

- **Rede**: `192.168.3.27`, RTSP em `onvif1:554`, Digest auth. Servidor se identifica como `RtspServer_0.0.0.2`, realm `HIipCamera`.
- **`USER_CMD_SET`** (método RTSP customizado, aparece no `OPTIONS`) — beco morto. Aceita qualquer corpo, sempre responde `200 OK`, não move nada. Confirmado também por terceiros ([victorbillyph/Yoosee-camera-documentation](https://github.com/victorbillyph/Yoosee-camera-documentation)).
- **ONVIF real existe, na porta 5000** (não 80/8000/8080 — todas recusam conexão nessa câmera). `GetCapabilities`/`GetProfiles` respondem sem exigir autenticação; `ContinuousMove`/`Stop` funcionam com WS-Security (usuário/senha da própria câmera). Token do perfil: `IPCProfilesToken0`.
- `GetStatus` não implementado (conexão fecha sem resposta, sem feedback de posição). Sem zoom motorizado — só pan/tilt.
- **Resultado**: PTZ funcionando de ponta a ponta na UI do vigia-ai. `onvifPort` default mudou de 80 → 5000; velocidade do `ContinuousMove` subiu de 0.5 → 1.5 (a câmera não valida o range -1..1 do ONVIF).

## V360 Pro / HapSee — não integrada ❌

Câmera etiqueta "JXL", chip **Fullhan FH8616**, serial `CFEOB-193925-XSCJR`, IP `192.168.3.63` (mantém esse IP entre reboots/reset). App "V360 Pro" = mesma linha do app "HapSee Mate" (confirmado por documentação de terceiros e pelo SSID de reset `HAP-<serial>`).

**Tudo que foi tentado, nessa ordem:**

1. **Toda porta TCP comum testada, sempre recusada**: 554, 8554, 80, 8080, 8000, 8899, 8800, 9800, 5000, 6688, 1300, 843, 32108. Confirmado antes e depois de múltiplos resets de fábrica.
2. **Truque do cartão SD** (`ceshi.ini` com `rtsp=1`/`rtsp_enable=1`/`rtsp_ctrl=1` na raiz de um SD FAT32) — documentado pra família **V380 Pro**, sem efeito nenhum nesse FH8616.
3. **Captura de tráfego de rede** (tcpdump) durante reset + pareamento via QR code revelou o protocolo real: **TUTK/ThroughTek Kalay (IOTC)** — mesmo SDK da vulnerabilidade [CVE-2021-28372](https://www.nozominetworks.com/blog/critical-vulnerability-in-throughtek-kalay-network-p2p-sdk-cve-2021-28372/). A câmera manda broadcast UDP na porta 8899 (`iotcare_lan:<serial>:iotcare_lan`), mas a sessão de vídeo/controle real sempre passa por um **relay criptografado na nuvem** (TLS/443) — nunca direto na LAN. Captura passiva não revela nada utilizável.
4. **Conexão TUTK direta** (via `pkg/tutk` do [go2rtc](https://github.com/AlexxIT/go2rtc), compilado localmente do código-fonte): o pacote de busca simples (`f1 30 00 00` → porta 32108) sempre recebe resposta da câmera (confirma que ela está viva e escuta UDP), mas o handshake de conexão real (`ConnectByUID`) nunca teve resposta — nem na porta fixa 32108, nem na porta efêmera de resposta da busca. Parece bloqueio deliberado de firmware, não erro de protocolo da nossa parte.
5. **RCE não autenticada documentada** ([pingumacpenguin/FH86XX_Cameras](https://github.com/pingumacpenguin/FH86XX_Cameras) — wiki confirma esse mesmo chip FH8616 e a marca HapSee): mandar `<SYSTEM>comando</SYSTEM>` via TCP puro pra porta 1300 executa comando sem autenticação, mas **só funciona enquanto a câmera está em modo de configuração recém-resetada** (gateway `192.168.55.1`), antes do pareamento oficial via app. Tentamos reproduzir isso — o Mac precisava ficar conectado no WiFi de configuração da câmera (`HAP-<serial>`, sem senha) tempo suficiente pra rodar os comandos, mas o macOS insistia em voltar sozinho pra rede de casa (por ela ter internet e a da câmera não), impedindo terminar o teste. **Abandonado nesse ponto** — não chegamos a confirmar se a RCE funciona ou não nesse chip específico; só não conseguimos manter a conexão de rede estável tempo suficiente pra testar.

**Conclusão**: câmera continua funcionando normal só pelo app V360 Pro; não foi integrada ao board do vigia-ai. Se algum dia quiser retomar o item 5 (o caminho mais promissor, já com root exploit e comandos documentados), o bloqueio foi puramente de infraestrutura (manter o Mac conectado numa rede sem internet sem ele trocar de volta sozinho) — resolver isso primeiro via **Ajustes → Wi-Fi → ⓘ na rede de casa → desligar "Entrar automaticamente"** antes de tentar de novo.
