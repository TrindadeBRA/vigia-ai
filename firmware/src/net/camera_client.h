#pragma once

#include <Arduino.h>

// Cameras IP no coletor (fora do /usage). Lista + MJPEG live + PTZ ONVIF.
// A placa nunca guarda senha RTSP.

constexpr int MAX_CAMERAS = 8;

struct CameraListItem
{
  String id;
  String label;
  String host;
  bool configured = false;
  bool ptzEnabled = false;
};

int cameraCount();
const CameraListItem *cameraAt(int i);
int cameraSelectedIndex();
void cameraSetSelected(int i);
String cameraDisplayName(const CameraListItem &c);
int cameraPtzCount();

void cameraClientFetchList();
void cameraClientPoll();
void cameraClientEnterLive();
void cameraClientExitLive();
bool cameraClientPtzHeld();
void cameraClientSetPtzHeld(bool held);
bool cameraClientSendPtz(const char *action);
// Desenha o frame MJPEG mais recente em tela cheia. true = desenhou.
bool cameraClientConsumeFrame();
const char *cameraClientLiveError();
bool cameraClientFitCover();
void cameraClientToggleFit();
// Retângulos da UI (voltar/PTZ) que o JPEG não deve pintar — senão os
// botões piscam a cada frame. Chame depois de desenhar o chrome.
void cameraClientClearOverlayHoles();
void cameraClientAddOverlayHole(int x, int y, int w, int h);
