"""Run with: python -m unittest discover -s tests -v"""
import copy
import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer

import server


class RoutingAndSafetyTests(unittest.TestCase):
    def setUp(self):
        server.load_campus_graph()
        server.active_hazards.clear()
        server.active_sos_alerts.clear()

    def test_default_route_uses_real_distances(self):
        route = server.calculate_shortest_path("N3", "N5")
        self.assertEqual(route["path_node_ids"], ["N3", "N4", "N5"])
        self.assertEqual(route["total_distance_m"], 46)
        self.assertEqual(sum(leg["distance_m"] for leg in route["legs"]), 46)

    def test_reroute_preserves_start_and_destination(self):
        for destination in ["N5", "N7", "N8", "N10"]:
            result = server.report_hazard({"node_from": "N3", "node_to": "N4", "label": "Demo obstacle",
                                           "current_student_node": "N1", "destination_node": destination})
            route = result["new_route"]
            self.assertEqual(route["path_node_ids"][0], "N1")
            self.assertEqual(route["path_node_ids"][-1], destination)
            self.assertNotIn({"N3", "N4"}, [{leg["from"], leg["to"]} for leg in route["legs"]])
        self.assertEqual(len(server.active_hazards), 1)

    def test_blocked_route_does_not_invent_fallback(self):
        route = server.calculate_shortest_path("N1", "N5", {"N1->N2"})
        self.assertFalse(route["success"])
        self.assertEqual(route["legs"], [])

    def test_reverse_direction_block_is_respected(self):
        route = server.calculate_shortest_path("N3", "N5", {"N4->N3"})
        self.assertEqual(route["path_node_ids"], ["N3", "N9", "N5"])
        self.assertEqual(route["total_distance_m"], 46)

    def test_inaccessible_edges_are_filtered(self):
        for edge in server.campus_graph["edges"]:
            if edge["from"] == "N1":
                edge["accessible"] = False
        self.assertFalse(server.calculate_shortest_path("N1", "N5")["success"])

    def test_already_at_destination(self):
        route = server.calculate_shortest_path("N5", "N5")
        self.assertTrue(route["success"])
        self.assertEqual(route["total_distance_m"], 0)
        self.assertEqual(route["legs"], [])

    def test_unknown_node_and_nonexistent_edge_rejected(self):
        with self.assertRaises(ValueError):
            server.calculate_shortest_path("unknown", "N5")
        with self.assertRaises(ValueError):
            server.report_hazard({"node_from": "N1", "node_to": "N5", "label": "Test",
                                  "current_student_node": "N1", "destination_node": "N5"})

    def test_safety_scenarios_stop(self):
        for scenario in ["blocked", "stairs", "wet_floor", "low_light"]:
            result = server.analyze_scenario({"scenario": scenario})
            self.assertFalse(result["can_advance"])
            self.assertIn(result["state"], ["STOPPED", "UNAVAILABLE"])
            self.assertIsNone(result["confidence_score"])
        self.assertEqual(set(server.analyze_scenario({"scenario": "blocked"})["sectors"].values()), {"obstacle"})

    def test_camera_never_certifies_clear_path(self):
        result = server.analyze_scenario({"source": "camera"})
        self.assertFalse(result["can_advance"])
        self.assertEqual(set(result["sectors"].values()), {"unknown"})

    def test_invalid_scenario_returns_validation_error(self):
        with self.assertRaises(ValueError):
            server.analyze_scenario({"scenario": []})

    def test_request_idempotency_and_operator_transitions(self):
        data = {"client_request_id": "stable-retry", "location_node": "N3", "reason": "Need assistance"}
        alert = server.create_assistance(data)["alert"]
        self.assertEqual(alert["status"], "RECEIVED")
        self.assertEqual(server.create_assistance(data)["alert"]["id"], alert["id"])
        self.assertEqual(len(server.active_sos_alerts), 1)
        with self.assertRaises(ValueError):
            server.update_assistance({"id": alert["id"], "status": "RESOLVED"})
        acknowledged = server.update_assistance({"id": alert["id"], "status": "ACKNOWLEDGED"})["alert"]
        self.assertIsNotNone(acknowledged["acknowledged_at"])
        resolved = server.update_assistance({"id": alert["id"], "status": "RESOLVED"})["alert"]
        self.assertIsNotNone(resolved["resolved_at"])


class HttpValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.load_campus_graph()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.VisionPathHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def test_malformed_json_and_array_return_json_400(self):
        for body in [b"[]", b"{", b'{"scenario":null}']:
            request = Request(self.base + "/api/analyze-frame", data=body, headers={"Content-Type": "application/json"})
            with self.assertRaises(HTTPError) as raised:
                urlopen(request, timeout=3)
            self.assertEqual(raised.exception.code, 400)
            self.assertIn("error", json.loads(raised.exception.read()))

    def test_cross_origin_write_is_rejected(self):
        request = Request(self.base + "/api/campus/clear-hazards", data=b"{}", headers={"Origin": "https://untrusted.example"})
        with self.assertRaises(HTTPError) as raised:
            urlopen(request, timeout=3)
        self.assertEqual(raised.exception.code, 403)

    def test_unknown_api_is_json_404(self):
        with self.assertRaises(HTTPError) as raised:
            urlopen(self.base + "/api/missing", timeout=3)
        self.assertEqual(raised.exception.code, 404)
        self.assertIn("error", json.loads(raised.exception.read()))


if __name__ == "__main__":
    unittest.main()
