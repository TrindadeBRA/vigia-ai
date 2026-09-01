#pragma once

// Servidor HTTP (porta 80) que recebe o tema montado no painel web. Ver
// docs/CONTRATO_TEMA.md pras rotas e ui/customtheme.h pra persistência/render.

void themeServerBegin();
// Chamado a cada volta do loop() em main.cpp, ao lado de usageClientPoll().
void themeServerHandle();
