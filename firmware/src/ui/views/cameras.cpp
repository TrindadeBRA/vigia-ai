#include "ui/internal.h"

#include "assets/icons/icon_camera.h"
#include "net/camera_client.h"
#include "ui/i18n.h"

constexpr int MAX_PICK_CARDS = MAX_CAMERAS;

static int g_pickX[MAX_PICK_CARDS];
static int g_pickY[MAX_PICK_CARDS];
static int g_pickW[MAX_PICK_CARDS];
static int g_pickH[MAX_PICK_CARDS];
static int g_pickIdx[MAX_PICK_CARDS];
static int g_pickCount = 0;

static int g_ptzX[6];
static int g_ptzY[6];
static int g_ptzS = 0;
static const char *g_ptzAction[6] = {"up", "left", "right", "down", "zoom_in", "zoom_out"};
static bool g_ptzVisible = false;
static String g_liveErr;
static bool g_liveHasFrame = false;
static int g_backX0 = 0;
static int g_backY0 = 0;
static int g_backS = 36;
static int g_fitX0 = 0;
static int g_fitY0 = 0;
static int g_fitS = 36;

static void drawCameraPtzPad();

static void drawLiveBack()
{
  g_backS = 36;
  g_backX0 = 6;
  g_backY0 = 6;
  tft.fillRoundRect(g_backX0, g_backY0, g_backS, g_backS, 8, COL_CARD);
  tft.drawRoundRect(g_backX0, g_backY0, g_backS, g_backS, 8, COL_CARD_BORDER);
  drawBackChevron(g_backX0 + g_backS / 2, g_backY0 + g_backS / 2, COL_TEXT);
}

static void drawLiveFit()
{
  g_fitS = 36;
  g_fitX0 = g_backX0 + g_backS + 6;
  g_fitY0 = g_backY0;
  tft.fillRoundRect(g_fitX0, g_fitY0, g_fitS, g_fitS, 8, COL_CARD);
  tft.drawRoundRect(g_fitX0, g_fitY0, g_fitS, g_fitS, 8, COL_CARD_BORDER);
  const int x = g_fitX0;
  const int y = g_fitY0;
  const int s = g_fitS;
  // Cover: retangulo preenchido (preenche a tela). Contain: moldura +
  // retangulo menor (encaixa com barras).
  if (cameraClientFitCover())
  {
    tft.fillRoundRect(x + 8, y + 10, s - 16, s - 20, 2, COL_TEXT);
  }
  else
  {
    tft.drawRoundRect(x + 7, y + 7, s - 14, s - 14, 3, COL_TEXT);
    tft.fillRoundRect(x + 12, y + 13, s - 24, s - 26, 2, COL_TEXT_MUTED);
  }
}

static void addBtnHole(int x, int y, int s)
{
  const int pad = 2;
  cameraClientAddOverlayHole(x - pad, y - pad, s + pad * 2, s + pad * 2);
}

static void drawLiveChrome()
{
  drawLiveBack();
  drawLiveFit();
  drawCameraPtzPad();
  cameraClientClearOverlayHoles();
  addBtnHole(g_backX0, g_backY0, g_backS);
  addBtnHole(g_fitX0, g_fitY0, g_fitS);
  if (g_ptzVisible)
  {
    for (int i = 0; i < 6; i++)
    {
      addBtnHole(g_ptzX[i], g_ptzY[i], g_ptzS);
    }
  }
}

static void drawPtzBtn(int x, int y, int s, const char *glyph)
{
  tft.fillRoundRect(x, y, s, s, 6, COL_CARD);
  tft.drawRoundRect(x, y, s, s, 6, COL_CARD_BORDER);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(glyph, x + s / 2, y + s / 2, 2);
}

static void drawCameraPtzPad()
{
  const CameraListItem *c = cameraAt(cameraSelectedIndex());
  g_ptzVisible = c && c->ptzEnabled;
  if (!g_ptzVisible)
  {
    return;
  }
  g_ptzS = 32;
  const int s = g_ptzS;
  const int gap = 4;
  int ox = 8;
  int oy = tft.height() - 8 - (s * 3 + gap * 2);
  g_ptzX[0] = ox + s + gap;
  g_ptzY[0] = oy;
  g_ptzX[1] = ox;
  g_ptzY[1] = oy + s + gap;
  g_ptzX[2] = ox + 2 * (s + gap);
  g_ptzY[2] = oy + s + gap;
  g_ptzX[3] = ox + s + gap;
  g_ptzY[3] = oy + 2 * (s + gap);
  drawPtzBtn(g_ptzX[0], g_ptzY[0], s, "^");
  drawPtzBtn(g_ptzX[1], g_ptzY[1], s, "<");
  drawPtzBtn(g_ptzX[2], g_ptzY[2], s, ">");
  drawPtzBtn(g_ptzX[3], g_ptzY[3], s, "v");
  int zx = tft.width() - 8 - s;
  int zy = oy + s + gap;
  g_ptzX[4] = zx;
  g_ptzY[4] = zy - s - gap;
  g_ptzX[5] = zx;
  g_ptzY[5] = zy + s + gap;
  drawPtzBtn(g_ptzX[4], g_ptzY[4], s, "+");
  drawPtzBtn(g_ptzX[5], g_ptzY[5], s, "-");
}

void paintCameras()
{
  const UiStrings &t = uiTr();
  g_pickCount = 0;
  g_ptzVisible = false;
  layoutContent();

  const int n = cameraCount();
  if (n <= 0)
  {
    if (!paintDetailChrome(t.cameras, "", ICON_CAMERA, true, "", 0, 0))
    {
      return;
    }
    dNote(t.camerasEmpty);
    dGap();
    dNote(t.camerasHint);
    paintDetailFinish();
    return;
  }

  const int pad = g_contentX + 8;
  const int bodyTop = g_contentY + 8;
  const int bodyH = g_contentH - 16;
  const int gap = 6;
  const int rowH = 44;
  int cardW = g_contentW - 16;

  int totalH = n * rowH + (n - 1) * gap;
  g_detailMaxScroll = totalH - bodyH;
  if (g_detailMaxScroll < 0)
  {
    g_detailMaxScroll = 0;
  }
  if (g_detailScroll > g_detailMaxScroll)
  {
    g_detailScroll = g_detailMaxScroll;
  }
  g_detailCanScroll = g_detailMaxScroll > 0;
  g_detailClipTop = bodyTop;
  g_detailClipH = bodyH;
  if (g_detailCanScroll)
  {
    g_arrowS = 26;
    g_arrowX = g_contentX + g_contentW - 8 - g_arrowS;
    g_arrowUpY = bodyTop;
    g_arrowDownY = bodyTop + bodyH - 8 - g_arrowS;
    cardW = g_arrowX - pad - 6;
  }

  tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
  tft.setViewport(pad, bodyTop, cardW, bodyH, false);

  for (int i = 0; i < n; i++)
  {
    const CameraListItem *c = cameraAt(i);
    if (!c)
    {
      continue;
    }
    int top = bodyTop - g_detailScroll + i * (rowH + gap);
    if (top + rowH <= bodyTop || top >= bodyTop + bodyH)
    {
      continue;
    }
    tft.fillRoundRect(pad, top, cardW, rowH, 8, COL_CARD);
    tft.drawRoundRect(pad, top, cardW, rowH, 8, COL_CARD_BORDER);
    drawIcon(pad + 10, top + (rowH - ICON_CAMERA_H) / 2, ICON_CAMERA_W, ICON_CAMERA_H, ICON_CAMERA);
    String name = cameraDisplayName(*c);
    const int textX = pad + 10 + ICON_CAMERA_W + 8;
    const int chevX = pad + cardW - 16;
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    String title = name;
    while (title.length() && tft.textWidth(title, 2) > chevX - 12 - textX)
    {
      title.remove(title.length() - 1);
    }
    tft.drawString(title, textX, top + 8, 2);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    String sub = c->ptzEnabled ? String(t.cameraPtz) : (c->host.length() ? c->host : String(t.camerasEmpty));
    while (sub.length() && tft.textWidth(sub, 1) > chevX - 12 - textX)
    {
      sub.remove(sub.length() - 1);
    }
    tft.drawString(sub, textX, top + 26, 1);
    drawFwdChevron(chevX, top + rowH / 2, COL_TEXT_DIM);

    if (g_pickCount < MAX_PICK_CARDS)
    {
      g_pickX[g_pickCount] = pad;
      g_pickY[g_pickCount] = top;
      g_pickW[g_pickCount] = cardW;
      g_pickH[g_pickCount] = rowH;
      g_pickIdx[g_pickCount] = i;
      g_pickCount++;
    }
  }

  tft.resetViewport();
  if (g_detailCanScroll)
  {
    int cx = g_arrowX + g_arrowS / 2;
    drawScrollChevron(cx, g_arrowUpY + g_arrowS / 2, true, g_detailScroll > 0);
    drawScrollChevron(cx, g_arrowDownY + g_arrowS / 2, false, g_detailScroll < g_detailMaxScroll);
  }
}

void paintCameraLive()
{
  const UiStrings &t = uiTr();
  g_ptzVisible = false;
  tft.fillScreen(COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_BG);
  const char *msg = g_liveErr.length() ? g_liveErr.c_str() : t.cameraLoading;
  tft.drawString(msg, tft.width() / 2, tft.height() / 2, 2);
  drawLiveChrome();
}

bool cameraPickerHandleTap(int16_t x, int16_t y)
{
  for (int i = 0; i < g_pickCount; i++)
  {
    if (x >= g_pickX[i] && x < g_pickX[i] + g_pickW[i] && y >= g_pickY[i] && y < g_pickY[i] + g_pickH[i])
    {
      if (g_detailCanScroll && (y < g_detailClipTop || y >= g_detailClipTop + g_detailClipH))
      {
        return true;
      }
      cameraSetSelected(g_pickIdx[i]);
      uiSetView(VIEW_CAMERA);
      return true;
    }
  }
  return false;
}

static const char *ptzHit(int16_t x, int16_t y)
{
  if (!g_ptzVisible)
  {
    return nullptr;
  }
  const int s = g_ptzS;
  for (int i = 0; i < 6; i++)
  {
    if (x >= g_ptzX[i] && x < g_ptzX[i] + s && y >= g_ptzY[i] && y < g_ptzY[i] + s)
    {
      return g_ptzAction[i];
    }
  }
  return nullptr;
}

bool cameraLiveHandlePointer(bool down, int16_t x, int16_t y)
{
  if (g_view != VIEW_CAMERA)
  {
    return false;
  }
  if (down)
  {
    if (x >= g_backX0 && x < g_backX0 + g_backS && y >= g_backY0 && y < g_backY0 + g_backS)
    {
      uiSetView(VIEW_CAMERAS);
      return true;
    }
    if (x >= g_fitX0 && x < g_fitX0 + g_fitS && y >= g_fitY0 && y < g_fitY0 + g_fitS)
    {
      cameraClientToggleFit();
      g_liveHasFrame = false;
      g_liveErr = "";
      tft.fillScreen(COL_BG);
      const UiStrings &t = uiTr();
      tft.setTextDatum(MC_DATUM);
      tft.setTextColor(COL_TEXT_MUTED, COL_BG);
      tft.drawString(t.cameraLoading, tft.width() / 2, tft.height() / 2, 2);
      drawLiveChrome();
      return true;
    }
    const char *a = ptzHit(x, y);
    if (!a)
    {
      return false;
    }
    cameraClientSetPtzHeld(true);
    cameraClientSendPtz(a);
    return true;
  }
  if (cameraClientPtzHeld())
  {
    cameraClientSendPtz("stop");
    cameraClientSetPtzHeld(false);
    return true;
  }
  return false;
}

void cameraLiveOnEnter()
{
  g_liveHasFrame = false;
  g_liveErr = "";
}

void uiTickCamera()
{
  if (g_view != VIEW_CAMERA)
  {
    return;
  }
  if (cameraClientConsumeFrame())
  {
    g_liveHasFrame = true;
    g_liveErr = "";
    return;
  }
  if (g_liveHasFrame)
  {
    return;
  }
  const char *e = cameraClientLiveError();
  if (e && e[0] && g_liveErr != e)
  {
    g_liveErr = e;
    paintCameraLive();
  }
}
