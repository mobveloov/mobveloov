# Veloov Totem — App Android Nativo

App Android nativo (Kotlin) que funciona como o aplicativo oficial do totem, substituindo a instalação via PWA.

## Como funciona

O app carrega a interface web (PWA) em um WebView em tela cheia, apontando para `https://mob.veloov.com/[slug]`. Ele adiciona:

- **Modo quiosque**: `startLockTask()` trava o app na tela, impedindo saída acidental (home/voltar desabilitados).
- **Auto-início**: inicia automaticamente ao ligar o dispositivo (`BOOT_COMPLETED`).
- **Tela de configuração inicial**: no primeiro uso, pede o caminho da empresa/totem (ex: `upcorridas/hospital`). Salvo em SharedPreferences.
- **Reconfiguração oculta**: toque longo no canto inferior esquerdo por 5 segundos para reconfigurar.
- **Identificador único persistente**: UUID v4 gerado pelo app (`native-xxxx...`), injetado no WebView via JavaScript interface. Reaproveita a mesma lógica de vínculo do PWA — bloqueia se o totem já estiver vinculado a outro identificador.
- **Reconexão automática**: monitora a conexão e exibe "Sem conexão, tentando reconectar..." com retry automático.

## Build

1. Abra o projeto no Android Studio (pasta `native-android/`).
2. Conecte o dispositivo totem.
3. Build & Run (Release ou Debug).
4. No primeiro uso, digite o slug da empresa (ex: `upcorridas/hospital`).
5. Conceda permissão de administrador do dispositivo para ativar o modo quiosque.

## Requisitos

- Android 7.0+ (minSdk 24)
- Android Studio Hedgehog+ com Kotlin 1.9
- Dispositivo com acesso à internet
