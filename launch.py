import threading
import webbrowser
from server import make_server
if __name__ == "__main__":
    try:
        server = make_server(8765)
    except OSError:
        raise SystemExit("A porta 8765 está ocupada. Feche outra instância ou use: python server.py --port 8766")
    threading.Timer(1, lambda: webbrowser.open("http://127.0.0.1:8765")).start()
    print("Lume: http://127.0.0.1:8765 — Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
