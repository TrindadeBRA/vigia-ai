"""IPs IPv4 da LAN para o painel e o secrets.h da placa."""

from __future__ import annotations

import socket


def lan_ipv4() -> list[str]:
    found: list[str] = []
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.3)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        if ip and not ip.startswith("127."):
            found.append(ip)
    except OSError:
        pass
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in found:
                found.append(ip)
    except OSError:
        pass
    return found


def panel_lan_url(port: int) -> str:
    """URL absoluta do painel na LAN — o QR da placa aponta para cá."""
    ips = lan_ipv4()
    if not ips:
        return ""
    return f"http://{ips[0]}:{int(port)}/"


def display_lan_url(port: int) -> str:
    """URL do mostrador web na LAN (atalho em notificações Telegram)."""
    ips = lan_ipv4()
    if not ips:
        return ""
    return f"http://{ips[0]}:{int(port)}/display"
