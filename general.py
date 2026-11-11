"""Domain-independent extractive reading: quotes, never invented paraphrases."""
import math
import re
from collections import Counter
from datetime import datetime, timezone
from engine import AnalysisError, MAX_PAGES, MAX_TEXT, norm, read_pdf_pages

STOP = set("a o e de da do dos das um uma os as em no na nos nas para por com que se ao aos sua seu suas seus é são foi ser como mais ou não este esta esse essa isso isto entre sobre pela pelo the and of to in is are for with this that from it an on at by be or as not".split())
ACTION = re.compile(r"\b(?:dever[aá]|dever[aã]o|precisa|necess[aá]rio|obrigat[oó]rio|enviar|entregar|apresentar|submit|required|must|shall|deadline)\b", re.I)
DATE = re.compile(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4})\b", re.I)

def tokens(text):
    return [w for w in re.findall(r"\w+", norm(text)) if len(w) > 2 and not w.isdigit() and w not in STOP]

def validate_pages(pages):
    if not isinstance(pages, list) or not 1 <= len(pages) <= MAX_PAGES:
        raise AnalysisError("O documento deve ter entre 1 e 300 páginas.")
    if any(not isinstance(p, str) for p in pages) or sum(map(len, pages)) > MAX_TEXT:
        raise AnalysisError("Texto inválido ou extenso demais. Divida o documento.")
    return pages

def passages(pages):
    result = []
    for number, text in enumerate(validate_pages(pages), 1):
        # Preserve exact source substrings and physical page numbers.
        for match in re.finditer(r"[^\n]+", text):
            start, stop = match.span()
            while start < stop:
                end = min(start + 1200, stop)
                if end < stop:
                    boundary = text.rfind(" ", start + 300, end)
                    if boundary > start:
                        end = boundary
                quote = text[start:end].strip()
                if len(quote) >= 25:
                    result.append({"id": f"p{number}-{start}", "page": number, "quote": quote})
                start = end
    return result

def rank(items, question=""):
    bag = Counter(word for item in items for word in set(tokens(item["quote"])))
    query = set(tokens(question))
    scored = []
    for index, item in enumerate(items):
        words = set(tokens(item["quote"]))
        score = sum(math.log1p(bag[w]) for w in words) / math.sqrt(max(1, len(words)))
        if query:
            overlap = query & words
            if not overlap:
                continue
            score += 30 * len(overlap) / len(query)
        scored.append((score, index, item))
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [item for _, _, item in scored]

def select_context(pages, question="", limit=24, budget=16000):
    ranked = rank(passages(pages), question)
    picked, used, seen, page_counts = [], 0, set(), Counter()
    for per_page in (2, 999):
        for item in ranked:
            signature = " ".join(item["quote"].split()).casefold()
            if signature in seen or page_counts[item["page"]] >= per_page:
                continue
            if len(picked) >= limit or used + len(item["quote"]) > budget:
                continue
            picked.append(item)
            seen.add(signature)
            used += len(item["quote"])
            page_counts[item["page"]] += 1
    return picked

def analyze_pages(pages, filename="documento.pdf"):
    validate_pages(pages)
    items = passages(pages)
    selected = select_context(pages, limit=12, budget=10000)
    unreadable = [i for i, text in enumerate(pages, 1) if len(text.strip()) < 20]
    frequencies = Counter(w for item in items for w in tokens(item["quote"]))
    warnings = [
        "Resumo por seleção de trechos originais. Não é uma explicação gerada por IA nem uma leitura exaustiva.",
        "Tabelas, gráficos, fórmulas e a ordem de colunas podem não ser preservados. Confira o PDF original.",
    ]
    if unreadable:
        warnings.append("Páginas com pouco ou nenhum texto: " + ", ".join(map(str, unreadable)) + ". OCR não incluído.")
    if not selected:
        warnings.append("Não há texto suficiente para montar um resumo. Nenhuma conclusão foi gerada.")
    return {
        "schema_version": "lume/1.0", "filename": str(filename)[:512],
        "created_at": datetime.now(timezone.utc).isoformat(), "method": "extractive-v1",
        "page_count": len(pages), "pages": [{"number": i, "text": t} for i, t in enumerate(pages, 1)],
        "summary": {"short": selected[:5], "detailed": selected},
        "signals": {
            "actions": [i for i in items if ACTION.search(i["quote"])][:12],
            "dates": [i for i in items if DATE.search(i["quote"])][:12],
        },
        "keywords": [w for w, _ in frequencies.most_common(10)],
        "coverage": {"readable_pages": len(pages)-len(unreadable), "total_pages": len(pages),
                     "total_passages": len(items), "selected_passages": len(selected),
                     "selected_pages": sorted({i["page"] for i in selected})},
        "warnings": warnings, "unreadable_pages": unreadable,
    }

def analyze_pdf(data, filename="documento.pdf"):
    return analyze_pages(read_pdf_pages(data), filename)

