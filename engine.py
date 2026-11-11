"""PDF text extraction for the standalone Lume reader."""
from io import BytesIO
import unicodedata
from pypdf import PdfReader

MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 300
MAX_TEXT = 2_000_000

class AnalysisError(ValueError):
    pass

def norm(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))

def read_pdf_pages(data):
    if not isinstance(data, bytes) or not data or len(data) > MAX_BYTES:
        raise AnalysisError("Envie um PDF de até 20 MiB.")
    if not data.startswith(b"%PDF-"):
        raise AnalysisError("O arquivo enviado não é um PDF válido.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise AnalysisError("PDF protegido por senha. Envie uma cópia sem proteção.")
        if not 1 <= len(reader.pages) <= MAX_PAGES:
            raise AnalysisError("O PDF deve ter entre 1 e 300 páginas.")
        pages, total = [], 0
        for page in reader.pages:
            value = page.extract_text() or ""
            total += len(value)
            if total > MAX_TEXT:
                raise AnalysisError("Texto extenso demais. Divida o documento.")
            pages.append(value)
        return pages
    except AnalysisError:
        raise
    except Exception as exc:
        raise AnalysisError("Não foi possível ler este PDF. Verifique se o arquivo está íntegro.") from exc
