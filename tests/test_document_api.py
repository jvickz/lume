import http.client
import json
import os
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from server import make_server

class DocumentAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=make_server(0)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def request(self,method,path,body=None,headers=None):
        c=http.client.HTTPConnection("127.0.0.1",self.server.server_port,timeout=70)
        c.request(method,path,body,headers or {});r=c.getresponse();result=(r.status,r.read());c.close();return result
    def test_general_demo(self):
        status,raw=self.request("GET","/api/v1/documents/demo")
        self.assertEqual(status,200);data=json.loads(raw)
        self.assertEqual(data["schema_version"],"lume/1.0")
        self.assertTrue(data["demo"]);self.assertTrue(data["summary"]["short"])
    def test_general_upload(self):
        raw=(Path(__file__).parents[1]/"exemplo-ficticio.pdf").read_bytes()
        for route,schema in [("/api/v1/documents/analyze","lume/1.0")]:
            status,body=self.request("POST",route,raw,{"Content-Type":"application/pdf"})
            self.assertEqual(status,200);self.assertEqual(json.loads(body)["schema_version"],schema)
    def test_general_request_validation(self):
        self.assertEqual(self.request("POST","/api/v1/documents/analyze",b"x",{"Content-Type":"text/plain"})[0],415)
        self.assertEqual(self.request("POST","/api/v1/documents/analyze",b"x",{"Content-Type":"application/pdf","Origin":"https://invalid.example"})[0],403)
        self.assertEqual(self.request("POST","/api/v1/documents/analyze",b"bad",{"Content-Type":"application/pdf"})[0],422)
    def test_ai_unconfigured_does_not_break_basic_reading(self):
        with patch.dict(os.environ,{"LUME_MODEL":""}):
            status,raw=self.request("GET","/api/v1/documents/capabilities")
            self.assertFalse(json.loads(raw)["ai_configured"])
            status,raw=self.request("POST","/api/v1/documents/explain",json.dumps({"pages":["Um texto de exemplo para a leitura geral."]}),{"Content-Type":"application/json"})
            self.assertEqual(status,422)
    def test_assets_and_guide(self):
        for route in ["/","/lume.js","/lume.css"]:
            self.assertEqual(self.request("GET",route)[0],200)

