"""Simple helper script to press F10 once."""

import ctypes
import time


USER32 = ctypes.WinDLL('user32', use_last_error=True)
VK_F10 = 0x79
KEYEVENTF_KEYUP = 0x0002


def press_f10():
    USER32.keybd_event(VK_F10, 0, 0, 0)
    time.sleep(0.05)
    USER32.keybd_event(VK_F10, 0, KEYEVENTF_KEYUP, 0)


if __name__ == '__main__':
    press_f10()
