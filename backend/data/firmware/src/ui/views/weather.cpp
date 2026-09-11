#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_weather.h"

void paintWeather()
{
  const UiStrings &t = uiTr();
  if (!weatherVisible())
  {
    return;
  }
  const WeatherData &w = g_snap.weather;
  if (!paintDetailChrome(t.weather, w.locationName, ICON_WEATHER, w.ok, w.error))
  {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dKv(t.weatherTemp, weatherTempText(w));
  dKv(t.weatherSky, weatherConditionText(w));
  String feels = weatherFeelsText(w);
  if (feels.length())
  {
    dKv(t.weatherFeels, feels);
  }
  String hum = weatherHumidityText(w);
  if (hum.length())
  {
    dKv(t.weatherHumidity, hum);
  }
  String wind = weatherWindText(w);
  if (wind.length())
  {
    dKv(t.weatherWind, wind);
  }
  String precip = weatherPrecipText(w);
  if (precip.length())
  {
    dKv(t.weatherPrecip, precip);
  }
  String hi = weatherHighText(w);
  if (hi.length())
  {
    dKv(t.weatherHigh, hi);
  }
  String lo = weatherLowText(w);
  if (lo.length())
  {
    dKv(t.weatherLow, lo);
  }
  paintDetailFinish();
}
