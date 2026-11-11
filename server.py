"""Loopback HTTP API for the standalone Lume reader."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import threading
from urllib.parse import urlsplit
from engine import MAX_BYTES
from general import analyze_pages
from ai_local import configured_model, AIError

ROOT = Path(__file__).resolve().parent
SLOTS = threading.BoundedSemaphore(2)
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
ASSETS = {"/": ("web/home.html", "text/html"), "/lume.css": ("web/lume.css", "text/css"), "/lume.js": ("web/lume.js", "text/javascript"), "/leia-me": ("README.md", "text/plain")}

class Handler(BaseHTTPRequestHandler):
    server_version = "Lume/0.4.1"
    def setup(self):
        super().setup()
        self.connection.settimeout(75)
    def log_message(self, format, *args):
        # Do not log filenames, questions or extracted document content.
        pass
    def reply(self, status, body, mime="application/json"):
        if mime == "application/json":
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass
    def trusted(self):
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host", "")
        if host not in hosts:
            self.reply(403, {"error": "Host não permitido."})
            return False
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + host:
            self.reply(403, {"error": "Origem não permitida."})
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.reply(403, {"error": "Origem não permitida."})
            return False
        return True
    def do_GET(self):
        if not self.trusted():
            return
        path = urlsplit(self.path).path
        if path == "/api/v1/health":
            return self.reply(200, {"status": "ok", "version": "0.4.1"})
        if path == "/api/v1/documents/capabilities":
            try:
                model = configured_model()
                return self.reply(200, {"ai_configured": bool(model), "model": model, "ocr": False})
            except AIError as exc:
                return self.reply(200, {"ai_configured": False, "model": "", "ocr": False, "message": str(exc)})
        if path == "/api/v1/documents/demo":
            from document_demo import PAGES
            result = analyze_pages(PAGES, "guia-de-projeto-ficticio.pdf")
            result["demo"] = True
            return self.reply(200, result)
        if path in ASSETS:
            file, mime = ASSETS[path]
            return self.reply(200, (ROOT / file).read_bytes(), mime)
        self.reply(404, {"error": "Página não encontrada."})
    def do_POST(self):
        if not self.trusted():
            return
        path = urlsplit(self.path).path
        if path not in {"/api/v1/documents/analyze", "/api/v1/documents/explain"}:
            return self.reply(404, {"error": "Rota não encontrada."})
        explaining = path.endswith("/explain")
        content_type = "application/json" if explaining else "application/pdf"
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != content_type:
            return self.reply(415, {"error": "Tipo de conteúdo não aceito."})
        if self.headers.get("Transfer-Encoding") or len(self.headers.get_all("Content-Length", [])) != 1:
            return self.reply(400, {"error": "Informe um único Content-Length."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return self.reply(400, {"error": "Envie um conteúdo válido."})
        limit = 8 * 1024 * 1024 if explaining else MAX_BYTES
        if length > limit:
            return self.reply(413, {"error": "Conteúdo acima do limite."})
        if not SLOTS.acquire(blocking=False):
            return self.reply(429, {"error": "Há outras leituras em andamento. Tente novamente."})
        try:
            data = self.rfile.read(length)
            if len(data) != length:
                return self.reply(400, {"error": "Envio incompleto."})
            command = [sys.executable, str(ROOT / "document_worker.py")]
            if explaining:
                command.append("explain")
            result = subprocess.run(command, input=data, capture_output=True, timeout=60 if explaining else 30)
            if result.returncode not in (0, 2):
                return self.reply(422, {"error": "Não foi possível processar o documento."})
            payload = json.loads(result.stdout.decode("utf-8"))
            return self.reply(200 if result.returncode == 0 else 422, payload)
        except subprocess.TimeoutExpired:
            self.reply(422, {"error": "O processamento excedeu o tempo disponível. Tente um documento menor."})
        except (ValueError, OSError):
            self.reply(422, {"error": "Não foi possível concluir a leitura."})
        finally:
            SLOTS.release()

def make_server(port=8765):
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with make_server(args.port) as server:
        print(f"Lume: http://127.0.0.1:{server.server_port} — Ctrl+C para encerrar.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
