import json
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import AnalysisError
from general import analyze_pages, analyze_pdf, select_context
from ai_local import explain, validate_answer, AIError

class GeneralTests(unittest.TestCase):
    def test_multiple_domains_keep_exact_sources(self):
        docs = [
            ["O estudo compara métodos de ensino e apresenta uma discussão sobre aprendizagem."],
            ["O relatório registra receita de R$ 2.400,00 e despesas operacionais da loja."],
            ["O manual orienta desligar a alimentação antes de limpar o equipamento."],
            ["This guide explains how to prepare a community workshop and evaluate the results."],
        ]
        for pages in docs:
            result = analyze_pages(pages)
            self.assertTrue(result["summary"]["short"])
            for item in result["summary"]["detailed"]:
                self.assertIn(item["quote"], pages[item["page"]-1])
        self.assertIn("R$ 2.400,00", analyze_pages(docs[1])["summary"]["short"][0]["quote"])

    def test_empty_pages_never_invent_summary(self):
        result = analyze_pages(["", "  "])
        self.assertEqual(result["summary"]["short"], [])
        self.assertEqual(result["unreadable_pages"], [1, 2])
        self.assertEqual(result["coverage"]["readable_pages"], 0)

    def test_negation_is_preserved_in_action_candidate(self):
        text = "Não é obrigatório comprar equipamentos novos para participar do projeto."
        self.assertEqual(analyze_pages([text])["signals"]["actions"][0]["quote"], text)

    def test_question_selects_relevant_source_and_no_match_is_empty(self):
        pages = ["A pesquisa utiliza entrevistas para avaliar a aprendizagem dos participantes.",
                 "O relatório financeiro registra as despesas de manutenção do laboratório."]
        selected = select_context(pages, "Quais despesas de manutenção?")
        self.assertEqual(selected[0]["page"], 2)
        self.assertEqual(select_context(pages, "astronomia"), [])

    def test_long_passages_bounded_and_duplicates_removed(self):
        text = ("planejamento comunitário e oficinas práticas " * 300)
        result = analyze_pages([text, text])
        self.assertTrue(all(len(i["quote"]) <= 1200 for i in result["summary"]["detailed"]))
        self.assertEqual(len({i["quote"] for i in result["summary"]["detailed"]}),len(result["summary"]["detailed"]))

    def test_limits(self):
        for pages in [[], ["x"] * 301, [7], ["x" * 2000001]]:
            with self.assertRaises(AnalysisError):
                analyze_pages(pages)

    def test_reads_pdf_sample(self):
        raw = (Path(__file__).parents[1] / "exemplo-ficticio.pdf").read_bytes()
        self.assertEqual(analyze_pdf(raw)["schema_version"], "lume/1.0")

class AITests(unittest.TestCase):
    def test_missing_model_is_explicit(self):
        with patch.dict("os.environ", {"LUME_MODEL": ""}):
            with self.assertRaises(AIError):
                explain({"pages":["Texto de um projeto educativo comunitário."]})

    def test_bad_citations_are_rejected(self):
        with self.assertRaises(AIError):
            validate_answer({"items":[{"category":"answer","text":"Resposta", "sources":["inventada"]}],"limitation":""},
                            [{"id":"p1-0","page":1,"quote":"Trecho verdadeiro."}])

    def test_mock_provider_returns_server_resolved_quotes(self):
        pages = ["O projeto promove oficinas de leitura para estudantes da comunidade."]
        def fake(path, data, timeout=45):
            if path == "/api/show": return {"model_info":{"architecture":"test"}}
            self.assertFalse(data["stream"])
            self.assertEqual(data["format"]["type"], "object")
            context = json.loads(data["messages"][1]["content"])
            return {"message":{"content":json.dumps({"items":[{"category":"overview","text":"O projeto oferece oficinas de leitura.","sources":[context["sources"][0]["id"]]}],"limitation":"Seleção parcial."})}}
        with patch.dict("os.environ", {"LUME_MODEL":"local-test"}), patch("ai_local.local_request",side_effect=fake):
            result = explain({"pages":pages, "mode":"quick"})
        self.assertEqual(result["items"][0]["sources"][0]["quote"],pages[0])

    def test_remote_model_is_rejected_before_chat(self):
        with patch.dict("os.environ", {"LUME_MODEL":"alias"}), patch("ai_local.local_request",return_value={"remote_model":"cloud-model"}) as request:
            with self.assertRaises(AIError):
                explain({"pages":["Um documento com texto suficiente para gerar uma seleção."]})
            self.assertEqual(request.call_count,1)

    def test_no_matching_question_does_not_call_model(self):
        with patch.dict("os.environ", {"LUME_MODEL":"local-test"}), patch("ai_local.local_request") as request:
            result=explain({"pages":["Este manual descreve a manutenção das máquinas da oficina."],"mode":"question","question":"astronomia"})
            self.assertFalse(result["items"])
            request.assert_not_called()

    def test_cloud_model_name_rejected(self):
        with patch.dict("os.environ", {"LUME_MODEL":"example-cloud"}):
            with self.assertRaises(AIError):explain({"pages":["Texto de demonstração."]})

