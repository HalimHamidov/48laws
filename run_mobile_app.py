from __future__ import annotations

import http.server
import socket
import socketserver
from pathlib import Path


PORT = 8000
ROOT = Path(__file__).resolve().parent


def get_local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        sock.close()


def main() -> None:
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
        ip = get_local_ip()
        print(f"Serving from: {ROOT}")
        print(f"Open on this PC: http://localhost:{PORT}/mobile_app/")
        print(f"Open on Android (same Wi-Fi): http://{ip}:{PORT}/mobile_app/")
        print("Press Ctrl+C to stop.")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

