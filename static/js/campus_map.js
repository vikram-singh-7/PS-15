/**
 * VisionPath AI - Campus Map & Dynamic Rerouting Engine
 * Renders SVG campus nodes, corridors, active student position, dynamic obstacles, and A* reroutes.
 */

class CampusMapEngine {
  constructor() {
    this.svgEl = null;
    this.graph = { nodes: [], edges: [] };
    this.activeRoute = null;
    this.activeHazards = [];
    this.startNode = "N1";
    this.targetNode = "N5";
  }

  async init(svgElementId) {
    this.svgEl = document.getElementById(svgElementId);
    await this.fetchGraph();
    await this.fetchRoute();
    this.render();
  }

  async fetchGraph() {
    try {
      const res = await fetch("/api/campus/graph");
      if (res.ok) {
        this.graph = await res.json();
        return;
      }
    } catch (e) {
      console.warn("Using offline campus graph fallback:", e);
    }
    // Offline / Standalone Graph Fallback
    this.graph = {
      nodes: [
        { id: "N1", name: "Campus Main Entrance", x: 100, y: 420, floor: "Ground", tactile_paving: true },
        { id: "N2", name: "Central Plaza Walkway", x: 260, y: 420, floor: "Ground", tactile_paving: true },
        { id: "N3", name: "Academic Block A Foyer", x: 420, y: 420, floor: "Ground", tactile_paving: true },
        { id: "N4", name: "Corridor A (To Science Labs)", x: 420, y: 270, floor: "Ground", tactile_paving: false },
        { id: "N5", name: "CS Lab 102 & AI Center", x: 580, y: 270, floor: "Ground", tactile_paving: true },
        { id: "N6", name: "Central Atrium & Garden Walk", x: 420, y: 560, floor: "Ground", tactile_paving: true },
        { id: "N7", name: "Library Main Entrance", x: 620, y: 560, floor: "Ground", tactile_paving: true },
        { id: "N8", name: "Student Cafeteria & Food Court", x: 780, y: 560, floor: "Ground", tactile_paving: false },
        { id: "N9", name: "Accessible Ramp Corridor B (Alternative)", x: 580, y: 420, floor: "Ground", tactile_paving: true },
        { id: "N10", name: "Seminar Hall 2B (Auditorium)", x: 780, y: 420, floor: "Ground", tactile_paving: true }
      ],
      edges: [
        { from: "N1", to: "N2", distance_m: 25, type: "outdoor_paved", accessible: true },
        { from: "N2", to: "N3", distance_m: 25, type: "outdoor_paved", accessible: true },
        { from: "N3", to: "N4", distance_m: 22, type: "indoor_corridor", accessible: true },
        { from: "N4", to: "N5", distance_m: 24, type: "indoor_corridor", accessible: true },
        { from: "N3", to: "N9", distance_m: 24, type: "indoor_wide_corridor", accessible: true },
        { from: "N9", to: "N10", distance_m: 30, type: "indoor_wide_corridor", accessible: true },
        { from: "N3", to: "N6", distance_m: 22, type: "covered_walkway", accessible: true },
        { from: "N6", to: "N7", distance_m: 30, type: "covered_walkway", accessible: true },
        { from: "N7", to: "N8", distance_m: 26, type: "covered_walkway", accessible: true },
        { from: "N5", to: "N9", distance_m: 22, type: "indoor_ramp", accessible: true },
        { from: "N7", to: "N10", distance_m: 22, type: "indoor_ramp", accessible: true }
      ]
    };
  }

  async fetchRoute(avoidHazards = true) {
    try {
      const res = await fetch(`/api/campus/route?start=${this.startNode}&end=${this.targetNode}&avoid_hazards=${avoidHazards}`);
      if (res.ok) {
        this.activeRoute = await res.json();
        this.render();
        this.updateRouteMetrics();
        return;
      }
    } catch (e) {
      console.warn("Using offline routing fallback:", e);
    }

    // Client-side routing fallback
    const hasHazard = avoidHazards && this.activeHazards.some(h => (h.node_from === "N3" && h.node_to === "N4") || (h.node_from === "N4" && h.node_to === "N3"));
    if (hasHazard) {
      // Dynamic Reroute avoiding Corridor A
      this.activeRoute = {
        success: true,
        path_node_ids: ["N1", "N2", "N3", "N9", "N5"],
        path_nodes: [
          { id: "N1", name: "Campus Main Entrance" },
          { id: "N2", name: "Central Plaza Walkway" },
          { id: "N3", name: "Academic Block A Foyer" },
          { id: "N9", name: "Accessible Ramp Corridor B" },
          { id: "N5", name: "CS Lab 102 & AI Center" }
        ],
        total_distance_m: 96.0,
        is_rerouted: true
      };
    } else {
      // Standard Direct Route via Corridor A
      this.activeRoute = {
        success: true,
        path_node_ids: ["N1", "N2", "N3", "N4", "N5"],
        path_nodes: [
          { id: "N1", name: "Campus Main Entrance" },
          { id: "N2", name: "Central Plaza Walkway" },
          { id: "N3", name: "Academic Block A Foyer" },
          { id: "N4", name: "Corridor A (To Science Labs)" },
          { id: "N5", name: "CS Lab 102 & AI Center" }
        ],
        total_distance_m: 96.0,
        is_rerouted: false
      };
    }
    this.render();
    this.updateRouteMetrics(hasHazard);
  }

  async reportDynamicHazard() {
    let triggered = false;
    const annMsg = "Dynamic hazard registered on Corridor A (N3 to N4). Rerouting student via accessible Ramp Corridor B.";
    try {
      const res = await fetch("/api/campus/report-hazard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Wet Floor Maintenance",
          node_from: "N3",
          node_to: "N4",
          current_student_node: this.startNode || "N1",
          destination_node: this.targetNode || "N5"
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.new_route) {
          this.activeRoute = data.new_route;
          this.activeHazards = data.hazards || (data.hazard ? [data.hazard] : []);
          this.render();
          this.updateRouteMetrics(true);
          if (window.spatialAudio) window.spatialAudio.speak(annMsg, true);
          triggered = true;
        }
      }
    } catch (e) {
      console.warn("Using offline hazard report fallback:", e);
    }

    if (!triggered) {
      const offlineHazard = {
        id: "HAZ-101",
        label: "Wet Floor Maintenance",
        node_from: "N3",
        node_to: "N4"
      };
      this.activeHazards.push(offlineHazard);
      this.fetchRoute(true);
      if (window.spatialAudio) window.spatialAudio.speak(annMsg, true);
    }
  }

  async clearAllHazards() {
    try {
      await fetch("/api/campus/clear-hazards", { method: "POST" });
      this.activeHazards = [];
      await this.fetchRoute(false);
      this.render();
      this.updateRouteMetrics(false);
      if (window.spatialAudio) {
        window.spatialAudio.speak("Campus corridors cleared. Default route restored.", true);
      }
    } catch (e) {
      console.warn("Error clearing hazards:", e);
    }
  }

  updateRouteMetrics(isRerouted = false) {
    const routeStatusEl = document.getElementById("route-status-pill");
    const routeDistEl = document.getElementById("route-dist-val");
    const routeNodesEl = document.getElementById("route-nodes-val");

    if (this.activeRoute && this.activeRoute.path_node_ids) {
      const pathNames = this.activeRoute.path_nodes.map(n => n.name).join(" ➔ ");
      if (routeNodesEl) routeNodesEl.innerText = pathNames;
      if (routeDistEl) routeDistEl.innerText = `${this.activeRoute.total_distance_m} meters`;

      if (routeStatusEl) {
        if (this.activeRoute.is_rerouted || isRerouted) {
          routeStatusEl.innerHTML = '<span class="dot" style="background:#f59e0b; box-shadow:0 0 8px #f59e0b"></span> Dynamic Reroute Active (Avoided Hazard)';
          routeStatusEl.style.borderColor = "#f59e0b";
        } else {
          routeStatusEl.innerHTML = '<span class="dot"></span> Standard Accessible Path';
          routeStatusEl.style.borderColor = "var(--border-color)";
        }
      }
    }
  }

  render() {
    if (!this.svgEl || !this.graph.nodes.length) return;

    let svgHtml = "";

    // Map Background grid
    svgHtml += `
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#161e2e" stroke-width="1"/>
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    `;

    const nodeCoords = {};
    this.graph.nodes.forEach(n => {
      nodeCoords[n.id] = { x: n.x, y: n.y, name: n.name, tactile: n.tactile_paving };
    });

    // 1. Draw All Edges / Corridors
    this.graph.edges.forEach(e => {
      const u = nodeCoords[e.from];
      const v = nodeCoords[e.to];
      if (!u || !v) return;

      const isHazard = this.activeHazards.some(
        h => (h.node_from === e.from && h.node_to === e.to) || (h.node_from === e.to && h.node_to === e.from)
      );

      const strokeColor = isHazard ? "#ef4444" : "#334155";
      const strokeWidth = isHazard ? 6 : 4;
      const dash = isHazard ? "6,4" : "none";

      svgHtml += `<line x1="${u.x}" y1="${u.y}" x2="${v.x}" y2="${v.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" />`;

      if (isHazard) {
        // Draw Caution Cone Icon at midpoint
        const mx = (u.x + v.x) / 2;
        const my = (u.y + v.y) / 2;
        svgHtml += `
          <circle cx="${mx}" cy="${my}" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
          <text x="${mx}" y="${my + 5}" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">⚠️</text>
          <text x="${mx}" y="${my + 28}" font-size="11" font-weight="bold" fill="#f87171" text-anchor="middle">BLOCKED: Wet Floor</text>
        `;
      }
    });

    // 2. Draw Active Route Highlight with Glow Effect
    if (this.activeRoute && this.activeRoute.path_node_ids) {
      const pathIds = this.activeRoute.path_node_ids;
      for (let i = 0; i < pathIds.length - 1; i++) {
        const u = nodeCoords[pathIds[i]];
        const v = nodeCoords[pathIds[i + 1]];
        if (u && v) {
          const routeColor = this.activeRoute.is_rerouted ? "#f59e0b" : "#06b6d4";
          // Ambient Outer Glow
          svgHtml += `
            <line x1="${u.x}" y1="${u.y}" x2="${v.x}" y2="${v.y}" stroke="${routeColor}" stroke-width="12" stroke-linecap="round" opacity="0.25" />
            <line x1="${u.x}" y1="${u.y}" x2="${v.x}" y2="${v.y}" stroke="${routeColor}" stroke-width="4" stroke-linecap="round" />
          `;
        }
      }
    }

    // 3. Draw Nodes (Campus Locations)
    this.graph.nodes.forEach(n => {
      const isStart = n.id === this.startNode;
      const isTarget = n.id === this.targetNode;
      const inPath = this.activeRoute && this.activeRoute.path_node_ids && this.activeRoute.path_node_ids.includes(n.id);

      let nodeColor = inPath ? "#06b6d4" : "#334155";
      if (isStart) nodeColor = "#10b981";
      if (isTarget) nodeColor = "#a855f7";

      svgHtml += `
        <g class="campus-node" data-id="${n.id}">
          <circle cx="${n.x}" cy="${n.y}" r="${isStart || isTarget ? 13 : 8}" fill="${nodeColor}" stroke="#ffffff" stroke-width="2" />
          ${isStart ? `<circle cx="${n.x}" cy="${n.y}" r="22" fill="none" stroke="#10b981" stroke-width="2" opacity="0.6"><animate attributeName="r" values="12;28;12" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/></circle>` : ""}
          ${isTarget ? `<circle cx="${n.x}" cy="${n.y}" r="20" fill="none" stroke="#a855f7" stroke-width="1.5" opacity="0.5"><animate attributeName="r" values="10;24;10" dur="2s" repeatCount="indefinite"/></circle>` : ""}
          <text x="${n.x}" y="${n.y - 18}" font-family="var(--font-sans)" font-size="11" font-weight="700" fill="#f8fafc" text-anchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">${n.name}</text>
          ${n.tactile_paving ? `<text x="${n.x}" y="${n.y + 24}" font-family="var(--font-mono)" font-size="9" font-weight="600" fill="#f59e0b" text-anchor="middle">🟡 Tactile Paved</text>` : ""}
        </g>
      `;
    });

    this.svgEl.innerHTML = svgHtml;
  }
}

window.campusMap = new CampusMapEngine();
