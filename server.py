#!/usr/bin/env python3
"""VisionPath: a local, synthetic-campus navigation demonstration, not a safety device."""

import heapq
import json
import os
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("PORT", "8000"))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
GRAPH_FILE = os.path.join(BASE_DIR, "campus_graph.json")
MAX_BODY_BYTES = 16384
MAX_RECORDS = 200
STATE_LOCK = threading.RLock()
active_hazards = []
active_sos_alerts = []
campus_graph = {"nodes": [], "edges": []}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_campus_graph():
    global campus_graph
    with open(GRAPH_FILE, encoding="utf-8") as file:
        campus_graph = json.load(file)


def node_by_id(node_id):
    return next((node for node in campus_graph["nodes"] if node["id"] == node_id), None)


def require_text(data, key, max_length=200):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip() or len(value) > max_length:
        raise ValueError(f"{key} must be non-empty text, at most {max_length} characters.")
    return value.strip()


def blocked_connections():
    # Only explicit, operator/demo-generated exclusions; no camera detections are inferred.
    return {f"{hazard['node_from']}->{hazard['node_to']}" for hazard in active_hazards}


def calculate_shortest_path(start_id, end_id, blocked_edges=None):
    """Dijkstra using graph metres, never schematic pixel distances."""
    if not isinstance(start_id, str) or not isinstance(end_id, str):
        raise ValueError("Route locations must be node IDs.")
    nodes = {node["id"]: node for node in campus_graph["nodes"]}
    if start_id not in nodes or end_id not in nodes:
        raise ValueError("Select valid campus locations.")
    blocked = blocked_edges or set()
    adjacency = {node_id: [] for node_id in nodes}
    for edge in campus_graph["edges"]:
        u, v = edge["from"], edge["to"]
        if not edge.get("accessible", False):
            continue
        if f"{u}->{v}" in blocked or f"{v}->{u}" in blocked:
            continue
        adjacency[u].append((v, edge["distance_m"], edge))
        adjacency[v].append((u, edge["distance_m"], edge))
    queue = [(0, start_id, [start_id], [])]
    visited = set()
    while queue:
        distance, current, path, legs = heapq.heappop(queue)
        if current in visited:
            continue
        visited.add(current)
        if current == end_id:
            return {
                "success": True,
                "path_node_ids": path,
                "path_nodes": [nodes[node_id] for node_id in path],
                "legs": legs,
                "total_distance_m": round(distance, 1),
                "excluded_connections_count": len(blocked),
                "source": "demo_graph",
            }
        for neighbor, weight, edge in adjacency[current]:
            if neighbor not in visited:
                leg = {"from": current, "to": neighbor, "distance_m": weight,
                       "type": edge["type"], "accessible": edge["accessible"]}
                heapq.heappush(queue, (distance + weight, neighbor, path + [neighbor], legs + [leg]))
    return {"success": False, "message": "No route available. Change locations or review excluded connections.",
            "path_node_ids": [], "path_nodes": [], "legs": [], "total_distance_m": 0}


def analyze_scenario(data):
    """Deterministic test inputs. This endpoint does NOT analyse images or measure depth."""
    source = data.get("source", "simulation")
    if source not in ("simulation", "camera"):
        raise ValueError("Unknown input source.")
    scenario = data.get("scenario", "clear")
    scenarios = {
        "clear": ("READY", "No obstacle in this simulation", "Simulation only. No obstacle was supplied.", ["clear", "clear", "clear"], 0, 1),
        "wet_floor": ("STOPPED", "Wet floor scenario", "Simulation paused. Review an alternative route around the reported connection.", ["clear", "obstacle", "clear"], 0.7, 2),
        "blocked": ("STOPPED", "Corridor blocked", "Simulation stopped. All three sectors are blocked. Review an alternative route.", ["obstacle", "obstacle", "obstacle"], 0, 3),
        "stairs": ("STOPPED", "Stairs scenario: stop", "Simulation stopped. Do not infer a safe direction around a staircase.", ["unknown", "stairs", "unknown"], 0, 3),
        "low_light": ("UNAVAILABLE", "Guidance unavailable", "Simulation stopped because visibility is insufficient. Request assistance if needed.", ["unknown", "unknown", "unknown"], 0, 0),
    }
    if source == "camera":
        state, title, message, values, pan, rate = ("UNAVAILABLE", "Camera preview only", "Obstacle detection is not available. No navigation guidance is generated from the camera.", ["unknown"] * 3, 0, 0)
    else:
        if not isinstance(scenario, str) or scenario not in scenarios:
            raise ValueError("Select a valid simulation scenario.")
        state, title, message, values, pan, rate = scenarios[scenario]
    return {"source": source, "scenario": scenario, "state": state, "title": title,
            "voice_prompt": message, "audio_pan": pan, "ping_rate_hz": rate,
            "sectors": dict(zip(("left", "center", "right"), values)),
            "confidence_score": None, "can_advance": state == "READY"}


def report_hazard(data):
    u = require_text(data, "node_from", 20)
    v = require_text(data, "node_to", 20)
    if not any({edge["from"], edge["to"]} == {u, v} for edge in campus_graph["edges"]):
        raise ValueError("The selected connection does not exist.")
    start = require_text(data, "current_student_node", 20)
    end = require_text(data, "destination_node", 20)
    if not node_by_id(start) or not node_by_id(end):
        raise ValueError("Select valid route locations.")
    label = require_text(data, "label", 120)
    with STATE_LOCK:
        existing = next((h for h in active_hazards if {h["node_from"], h["node_to"]} == {u, v}), None)
        if not existing:
            if len(active_hazards) >= MAX_RECORDS:
                raise ValueError("Demo hazard capacity reached. Clear exclusions first.")
            existing = {"id": "HAZ-" + uuid.uuid4().hex[:12], "node_from": u, "node_to": v,
                        "label": label, "source": "operator_simulation", "timestamp": now_iso()}
            active_hazards.append(existing)
        route = calculate_shortest_path(start, end, blocked_connections())
        return {"success": True, "hazard": existing, "new_route": route, "hazards": list(active_hazards)}


def create_assistance(data):
    client_id = require_text(data, "client_request_id", 100)
    location = require_text(data, "location_node", 20)
    reason = require_text(data, "reason", 400)
    if not node_by_id(location):
        raise ValueError("Select a valid assistance location.")
    with STATE_LOCK:
        # Repeated delivery attempts return the same received record.
        for alert in active_sos_alerts:
            if alert["client_request_id"] == client_id:
                return {"success": True, "alert": dict(alert)}
        if len(active_sos_alerts) >= MAX_RECORDS:
            raise ValueError("Demo request capacity reached. Restart the demo server to reset.")
        alert = {"id": "REQ-" + uuid.uuid4().hex[:8].upper(), "client_request_id": client_id,
                 "location_node": location, "location_name": node_by_id(location)["name"],
                 "reason": reason, "timestamp": now_iso(), "status": "RECEIVED",
                 "acknowledged_at": None, "resolved_at": None}
        active_sos_alerts.append(alert)
        return {"success": True, "alert": dict(alert)}


def update_assistance(data):
    request_id = require_text(data, "id", 100)
    status = require_text(data, "status", 30)
    if status not in ("ACKNOWLEDGED", "RESOLVED"):
        raise ValueError("Unknown assistance status.")
    with STATE_LOCK:
        alert = next((a for a in active_sos_alerts if a["id"] == request_id), None)
        if not alert:
            raise ValueError("Request not found; the demo server may have restarted.")
        if alert["status"] == status:
            return {"success": True, "alert": dict(alert)}
        allowed = {"RECEIVED": "ACKNOWLEDGED", "ACKNOWLEDGED": "RESOLVED"}
        if allowed.get(alert["status"]) != status:
            raise ValueError("Acknowledge a received request before resolving it.")
        alert["status"] = status
        alert["acknowledged_at" if status == "ACKNOWLEDGED" else "resolved_at"] = now_iso()
        return {"success": True, "alert": dict(alert)}


class VisionPathHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def send_json(self, data, status=200):
        payload = json.dumps(data, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            with STATE_LOCK:
                if parsed.path == "/api/status":
                    return self.send_json({"status": "online", "scope": "local_demo", "graph_nodes": len(campus_graph["nodes"])})
                if parsed.path == "/api/campus/graph":
                    return self.send_json(campus_graph)
                if parsed.path == "/api/campus/hazards":
                    return self.send_json({"hazards": active_hazards})
                if parsed.path == "/api/volunteer/alerts":
                    return self.send_json({"alerts": active_sos_alerts})
                if parsed.path == "/api/campus/route":
                    query = parse_qs(parsed.query)
                    route = calculate_shortest_path(query.get("start", ["N3"])[0], query.get("end", ["N5"])[0], blocked_connections())
                    return self.send_json(route)
            if parsed.path.startswith("/api/"):
                return self.send_json({"error": "Endpoint not found."}, 404)
            return super().do_GET()
        except ValueError as error:
            return self.send_json({"error": str(error)}, 400)

    def do_POST(self):
        # No wildcard CORS. Reject cross-site browser writes to the local prototype.
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != self.headers.get("Host"):
            return self.send_json({"error": "Cross-origin requests are not allowed."}, 403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 <= length <= MAX_BODY_BYTES:
                return self.send_json({"error": "Request body is too large."}, 413)
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8")) if body else {}
            if not isinstance(data, dict):
                raise ValueError("Request body must be a JSON object.")
            path = urlparse(self.path).path
            if path == "/api/analyze-frame":
                result = analyze_scenario(data)
            elif path == "/api/campus/report-hazard":
                result = report_hazard(data)
            elif path == "/api/campus/clear-hazards":
                with STATE_LOCK:
                    active_hazards.clear()
                result = {"success": True}
            elif path == "/api/volunteer/sos":
                result = create_assistance(data)
            elif path == "/api/volunteer/update":
                result = update_assistance(data)
            else:
                return self.send_json({"error": "Endpoint not found."}, 404)
            return self.send_json(result)
        except (ValueError, UnicodeDecodeError) as error:
            return self.send_json({"error": str(error)}, 400)


def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def run():
    load_campus_graph()
    httpd = ThreadingHTTPServer((os.environ.get("HOST", "127.0.0.1"), PORT), VisionPathHandler)
    print(f"VisionPath demo: http://localhost:{PORT}", flush=True)
    print("Camera requires localhost or HTTPS. No obstacle detection or emergency-service connection.", flush=True)
    print("For trusted LAN testing only, set HOST=0.0.0.0. No operator authentication is provided.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    run()
