import json, sys
from engine import AnalysisError, MAX_BYTES
from general import analyze_pdf
from ai_local import explain

try:
    explaining = len(sys.argv) > 1 and sys.argv[1] == "explain"
    limit = 8 * 1024 * 1024 if explaining else MAX_BYTES
    data = sys.stdin.buffer.read(limit + 1)
    if len(data) > limit:
        raise AnalysisError("Arquivo ou solicitação acima do limite.")
    result = explain(json.loads(data)) if explaining else analyze_pdf(data)
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
except (AnalysisError, ValueError) as exc:
    sys.stdout.buffer.write(json.dumps({"error": str(exc)}, ensure_ascii=False).encode("utf-8"))
    sys.exit(2)

