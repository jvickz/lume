import unittest
from io import BytesIO
from pypdf import PdfWriter
from engine import read_pdf_pages, AnalysisError

def pdf(pages=1, encrypted=False):
    writer=PdfWriter()
    for _ in range(pages): writer.add_blank_page(width=200,height=200)
    if encrypted: writer.encrypt("senha-de-teste")
    stream=BytesIO();writer.write(stream);return stream.getvalue()

class PDFBoundaryTests(unittest.TestCase):
    def test_invalid_and_empty_input(self):
        for value in [b"", b"not a PDF", b"%PDF-broken"]:
            with self.assertRaises(AnalysisError): read_pdf_pages(value)
    def test_encrypted_pdf_is_rejected(self):
        with self.assertRaisesRegex(AnalysisError,"senha"): read_pdf_pages(pdf(encrypted=True))
    def test_page_limit(self):
        with self.assertRaisesRegex(AnalysisError,"300"): read_pdf_pages(pdf(pages=301))
    def test_blank_pdf_retains_page_position(self):
        self.assertEqual(read_pdf_pages(pdf(2)),["",""])
