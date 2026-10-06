import base64
import ctypes
import json
import re
import sys
import time


KEYEVENTF_KEYUP = 0x0002
USER32 = ctypes.WinDLL('user32', use_last_error=True)


STATIC_VK = {
    'VK_BACK': 0x08,
    'VK_TAB': 0x09,
    'VK_RETURN': 0x0D,
    'VK_SHIFT': 0x10,
    'VK_CONTROL': 0x11,
    'VK_MENU': 0x12,
    'VK_ESCAPE': 0x1B,
    'VK_SPACE': 0x20,
    'VK_PRIOR': 0x21,
    'VK_NEXT': 0x22,
    'VK_END': 0x23,
    'VK_HOME': 0x24,
    'VK_LEFT': 0x25,
    'VK_UP': 0x26,
    'VK_RIGHT': 0x27,
    'VK_DOWN': 0x28,
    'VK_INSERT': 0x2D,
    'VK_DELETE': 0x2E,
    'VK_LWIN': 0x5B,
    'VK_RWIN': 0x5C,
    'VK_NUMPAD0': 0x60,
    'VK_NUMPAD1': 0x61,
    'VK_NUMPAD2': 0x62,
    'VK_NUMPAD3': 0x63,
    'VK_NUMPAD4': 0x64,
    'VK_NUMPAD5': 0x65,
    'VK_NUMPAD6': 0x66,
    'VK_NUMPAD7': 0x67,
    'VK_NUMPAD8': 0x68,
    'VK_NUMPAD9': 0x69,
    'VK_MULTIPLY': 0x6A,
    'VK_ADD': 0x6B,
    'VK_SUBTRACT': 0x6D,
    'VK_DECIMAL': 0x6E,
    'VK_DIVIDE': 0x6F,
    'VK_LSHIFT': 0xA0,
    'VK_RSHIFT': 0xA1,
    'VK_LCONTROL': 0xA2,
    'VK_RCONTROL': 0xA3,
    'VK_LMENU': 0xA4,
    'VK_RMENU': 0xA5,
    'VK_OEM_1': 0xBA,
    'VK_OEM_PLUS': 0xBB,
    'VK_OEM_COMMA': 0xBC,
    'VK_OEM_MINUS': 0xBD,
    'VK_OEM_PERIOD': 0xBE,
    'VK_OEM_2': 0xBF,
    'VK_OEM_3': 0xC0,
    'VK_OEM_4': 0xDB,
    'VK_OEM_5': 0xDC,
    'VK_OEM_6': 0xDD,
    'VK_OEM_7': 0xDE,
}


def decode_spec(arg):
    raw = arg.strip()
    if not raw:
        raise ValueError('empty hotkey spec')
    padding = '=' * (-len(raw) % 4)
    try:
        data = base64.urlsafe_b64decode((raw + padding).encode('utf-8'))
        return json.loads(data.decode('utf-8'))
    except Exception as exc:
        raise ValueError(f'invalid hotkey spec: {exc}') from exc


def resolve_vk(code):
    value = str(code).strip().upper()
    if not value:
        raise KeyError('empty vk code')
    if value in STATIC_VK:
        return STATIC_VK[value]
    if re.fullmatch(r'VK_[A-Z]', value):
        return ord(value[-1])
    if re.fullmatch(r'VK_[0-9]', value):
        return ord(value[-1])
    func_match = re.fullmatch(r'VK_F([1-9]|1\d|2[0-4])', value)
    if func_match:
        return 0x6F + int(func_match.group(1))
    if re.fullmatch(r'0X[0-9A-F]+', value):
        return int(value, 16)
    raise KeyError(f'unsupported vk code: {code}')


def press_key(vk_code):
    USER32.keybd_event(vk_code, 0, 0, 0)


def release_key(vk_code):
    USER32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: press_hotkey.py <hotkeyBase64>')

    spec = decode_spec(sys.argv[1])
    pressed = spec.get('pressed') or []
    if not pressed:
        raise SystemExit('no pressed keys in hotkey spec')

    for token in pressed:
        if token.get('device') != 'keyboard':
            raise SystemExit('only keyboard hotkeys are supported by press_hotkey.py')

    vk_codes = []
    for token in pressed:
        vk_codes.append(resolve_vk(token.get('code')))

    for vk_code in vk_codes:
        press_key(vk_code)
        time.sleep(0.015)

    time.sleep(0.06)

    for vk_code in reversed(vk_codes):
        release_key(vk_code)
        time.sleep(0.015)


if __name__ == '__main__':
    main()
