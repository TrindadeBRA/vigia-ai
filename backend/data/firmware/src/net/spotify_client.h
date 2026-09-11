#pragma once

// Cliente Spotify para o tema: busca GET /api/spotify e preenche g_snap.spotify.
// Poll próprio a cada 5s quando VIEW_THEME tem widget Spotify, similar ao
// SpotifyCard do /display (que não usa o hub de /usage).
void spotifyClientPoll();
void spotifyClientTick();
bool spotifyVisible();
