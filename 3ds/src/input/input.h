#pragma once
// Input 3DS: hid + touch (port de firmware/src/input/input.h)
#include <cstdint>

void inputInit();
void inputPoll(); // chama uiHandleTouch/uiHandleButton
