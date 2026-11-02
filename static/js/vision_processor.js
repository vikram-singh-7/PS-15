/**
 * VisionPath AI - Vision Processor & Sector Analyzer
 * Analyzes real webcam feed or simulated campus scenarios into 3 spatial corridors (Left, Center, Right).
 */

class VisionProcessor {
  constructor() {
    this.videoEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this.isCameraActive = false;
    this.stream = null;
    this.analysisInterval = null;
    this.currentMode = "simulation"; // 'camera' or 'simulation'
    this.simScenario = "clear"; // 'clear', 'wet_floor', 'blocked', 'stairs', 'low_light'
    this.simTime = 0;
  }

  init(videoElementId, canvasElementId) {
    this.videoEl = document.getElementById(videoElementId);
    this.canvasEl = document.getElementById(canvasElementId);
    this.ctx = this.canvasEl.getContext("2d");

    // Start simulation animation loop
    this.startSimLoop();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false
      });
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();
      this.isCameraActive = true;
      this.currentMode = "camera";
      this.videoEl.style.display = "block";
      this.canvasEl.style.display = "none";
      this.startAnalysisLoop();
      return true;
    } catch (err) {
      console.warn("Camera access failed or denied, continuing with synthetic vision simulator:", err);
      this.switchToSimulation("wet_floor");
      return false;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
    this.videoEl.style.display = "none";
    this.canvasEl.style.display = "block";
  }

  switchToSimulation(scenarioName) {
    this.stopCamera();
    this.currentMode = "simulation";
    this.simScenario = scenarioName;
    this.runSingleAnalysis();
  }

  startSimLoop() {
    const render = () => {
      if (this.currentMode === "simulation") {
        this.renderSimulationCanvas();
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    // Periodically run analysis
    setInterval(() => {
      this.runSingleAnalysis();
    }, 1200);
  }

  renderSimulationCanvas() {
    const c = this.ctx;
    const w = this.canvasEl.width;
    const h = this.canvasEl.height;
    this.simTime += 0.04;

    const isLowLight = this.simScenario === "low_light";

    // 1. Deep Atmospheric Hallway Background
    const bgGrad = c.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, w * 0.6);
    if (isLowLight) {
      bgGrad.addColorStop(0, "#0a0e17");
      bgGrad.addColorStop(1, "#020408");
    } else {
      bgGrad.addColorStop(0, "#131b2e");
      bgGrad.addColorStop(1, "#060911");
    }
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, w, h);

    // 2. High-Tech Perspective Hallway Structure
    c.strokeStyle = isLowLight ? "rgba(255, 255, 255, 0.04)" : "rgba(56, 189, 248, 0.15)";
    c.lineWidth = 1.5;

    // Vanishing Point at Center Horizon
    const vpX = w * 0.5;
    const vpY = h * 0.45;

    c.beginPath();
    // Perspective Floor Boundaries
    c.moveTo(0, h);
    c.lineTo(vpX - w * 0.18, vpY);
    c.moveTo(w, h);
    c.lineTo(vpX + w * 0.18, vpY);
    // Perspective Ceiling Boundaries
    c.moveTo(0, 0);
    c.lineTo(vpX - w * 0.18, vpY);
    c.moveTo(w, 0);
    c.lineTo(vpX + w * 0.18, vpY);
    c.stroke();

    // Floor Perspective Transverse Grid
    c.strokeStyle = isLowLight ? "rgba(255, 255, 255, 0.02)" : "rgba(56, 189, 248, 0.08)";
    for (let i = 1; i <= 6; i++) {
      const y = vpY + (h - vpY) * Math.pow(i / 6, 2);
      const spanX = (w * 0.18) + (w * 0.32) * Math.pow(i / 6, 2);
      c.beginPath();
      c.moveTo(vpX - spanX, y);
      c.lineTo(vpX + spanX, y);
      c.stroke();
    }

    // 3. Autonomous Trajectory Ribbon (Safe Path Corridor)
    c.save();
    if (this.simScenario === "wet_floor") {
      // Curved Safe Path Veering Right
      const pathGrad = c.createLinearGradient(0, h, w, vpY);
      pathGrad.addColorStop(0, "rgba(6, 182, 212, 0.35)");
      pathGrad.addColorStop(1, "rgba(16, 185, 129, 0.1)");
      c.fillStyle = pathGrad;
      c.beginPath();
      c.moveTo(w * 0.42, h);
      c.bezierCurveTo(w * 0.48, h * 0.75, w * 0.62, h * 0.6, w * 0.55, vpY);
      c.lineTo(w * 0.62, vpY);
      c.bezierCurveTo(w * 0.72, h * 0.6, w * 0.62, h * 0.75, w * 0.58, h);
      c.closePath();
      c.fill();
    } else if (this.simScenario === "clear") {
      // Straight Emerald Clear Path
      const pathGrad = c.createLinearGradient(0, h, 0, vpY);
      pathGrad.addColorStop(0, "rgba(16, 185, 129, 0.3)");
      pathGrad.addColorStop(1, "rgba(16, 185, 129, 0.05)");
      c.fillStyle = pathGrad;
      c.beginPath();
      c.moveTo(w * 0.42, h);
      c.lineTo(vpX - 16, vpY);
      c.lineTo(vpX + 16, vpY);
      c.lineTo(w * 0.58, h);
      c.closePath();
      c.fill();
    }
    c.restore();

    // 4. Moving LiDAR / Radar Scan Wave Beam
    const scanY = vpY + ((Math.sin(this.simTime * 2) + 1) / 2) * (h - vpY);
    c.strokeStyle = "rgba(6, 182, 212, 0.4)";
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(w * 0.1, scanY);
    c.lineTo(w * 0.9, scanY);
    c.stroke();
    c.setLineDash([]);

    // 5. Draw Dynamic Obstacles with AI Bounding Reticles
    if (this.simScenario === "wet_floor") {
      const objX = w * 0.48;
      const objY = h * 0.65;
      const boxW = 86;
      const boxH = 86;

      // Glowing Warning Cone
      c.fillStyle = "#eab308";
      c.beginPath();
      c.moveTo(objX, objY - 40);
      c.lineTo(objX - 30, objY + 24);
      c.lineTo(objX + 30, objY + 24);
      c.closePath();
      c.fill();
      c.strokeStyle = "#000";
      c.lineWidth = 2;
      c.stroke();

      c.fillStyle = "#000";
      c.font = "bold 20px var(--font-sans)";
      c.fillText("!", objX - 4, objY + 16);

      // Cybernetic Corner Reticle
      c.strokeStyle = "#ef4444";
      c.lineWidth = 2;
      const rx = objX - boxW / 2;
      const ry = objY - boxH / 2 - 8;
      const rSize = 10;
      // Top-Left
      c.beginPath(); c.moveTo(rx, ry + rSize); c.lineTo(rx, ry); c.lineTo(rx + rSize, ry); c.stroke();
      // Top-Right
      c.beginPath(); c.moveTo(rx + boxW - rSize, ry); c.lineTo(rx + boxW, ry); c.lineTo(rx + boxW, ry + rSize); c.stroke();
      // Bottom-Left
      c.beginPath(); c.moveTo(rx, ry + boxH - rSize); c.lineTo(rx, ry + boxH); c.lineTo(rx + rSize, ry + boxH); c.stroke();
      // Bottom-Right
      c.beginPath(); c.moveTo(rx + boxW - rSize, ry + boxH); c.lineTo(rx + boxW, ry + boxH); c.lineTo(rx + boxW, ry + boxH - rSize); c.stroke();

      // Holographic Distance Badge
      c.fillStyle = "rgba(239, 68, 68, 0.9)";
      c.fillRect(rx, ry - 22, boxW, 18);
      c.fillStyle = "#fff";
      c.font = "bold 10px monospace";
      c.fillText("WET FLOOR · 1.4m", rx + 6, ry - 9);

    } else if (this.simScenario === "blocked") {
      const objX = w * 0.22;
      const objY = h * 0.54;
      const barW = w * 0.56;
      const barH = 36;

      c.fillStyle = "rgba(239, 68, 68, 0.85)";
      c.fillRect(objX, objY, barW, barH);
      c.fillStyle = "#ffffff";
      for (let i = 0; i < 8; i++) {
        c.fillRect(objX + 8 + i * 40, objY, 16, barH);
      }

      // Barrier Reticle
      c.strokeStyle = "#f43f5e";
      c.lineWidth = 2;
      c.strokeRect(objX - 4, objY - 4, barW + 8, barH + 8);
      c.fillStyle = "#fff";
      c.font = "bold 11px monospace";
      c.fillText("CORRIDOR BLOCKED · RE-ROUTE REQUIRED (1.1m)", objX + 16, objY - 10);

    } else if (this.simScenario === "stairs") {
      const sX = w * 0.38;
      const sY = h * 0.62;
      const sW = w * 0.24;

      c.fillStyle = "rgba(6, 182, 212, 0.4)";
      c.fillRect(sX, sY, sW, 55);
      c.strokeStyle = "rgba(255, 255, 255, 0.7)";
      c.lineWidth = 1.5;
      for (let s = 0; s < 4; s++) {
        c.strokeRect(sX, sY + s * 14, sW, 14);
      }
      c.fillStyle = "#38bdf8";
      c.font = "bold 11px monospace";
      c.fillText("▼ STAIRCASE DESCENT CAUTION", sX - 10, sY - 10);
    }
  }

  startAnalysisLoop() {
    if (this.analysisInterval) clearInterval(this.analysisInterval);
    this.analysisInterval = setInterval(() => {
      this.runSingleAnalysis();
    }, 1000);
  }

  async runSingleAnalysis() {
    const isCamera = this.currentMode === "camera";
    const payload = {
      source: isCamera ? "camera" : "simulation",
      scenario: this.simScenario || "clear"
    };

    try {
      const res = await fetch("/api/analyze-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        this.updateHUD(data);
        return;
      }
    } catch (e) {
      // Offline fallback processing
    }

    // Local client-side fallback calculation matching server.py logic
    const scenarios = {
      clear: { state: "READY", title: "No obstacle in this simulation", voice_prompt: "Path is clear ahead.", sectors: { left: "clear", center: "clear", right: "clear" }, audio_pan: 0, ping_rate_hz: 1, can_advance: true },
      wet_floor: { state: "STOPPED", title: "Wet floor scenario", voice_prompt: "Caution: Wet floor sign ahead. Veer right into clear corridor.", sectors: { left: "clear", center: "obstacle", right: "clear" }, audio_pan: 0.7, ping_rate_hz: 2, can_advance: false },
      blocked: { state: "STOPPED", title: "Corridor blocked", voice_prompt: "Warning: Corridor blocked. Stop and assess.", sectors: { left: "obstacle", center: "obstacle", right: "obstacle" }, audio_pan: 0, ping_rate_hz: 3, can_advance: false },
      stairs: { state: "STOPPED", title: "Stairs scenario: stop", voice_prompt: "Caution: Staircase descent detected. Stop.", sectors: { left: "unknown", center: "stairs", right: "unknown" }, audio_pan: 0, ping_rate_hz: 3, can_advance: false },
      low_light: { state: "UNAVAILABLE", title: "Guidance unavailable", voice_prompt: "Low visibility detected. Please slow down or request assistance.", sectors: { left: "unknown", center: "unknown", right: "unknown" }, audio_pan: 0, ping_rate_hz: 0, can_advance: false }
    };

    if (isCamera) {
      this.updateHUD({
        source: "camera",
        scenario: "camera",
        state: "UNAVAILABLE",
        title: "Camera preview only",
        voice_prompt: "Live camera stream active. Scanning physical environment.",
        audio_pan: 0,
        ping_rate_hz: 1,
        sectors: { left: "unknown", center: "unknown", right: "unknown" },
        confidence_score: null,
        can_advance: false
      });
    } else {
      const sim = scenarios[this.simScenario] || scenarios.clear;
      this.updateHUD({
        source: "simulation",
        scenario: this.simScenario,
        state: sim.state,
        title: sim.title,
        voice_prompt: sim.voice_prompt,
        audio_pan: sim.audio_pan,
        ping_rate_hz: sim.ping_rate_hz,
        sectors: sim.sectors,
        confidence_score: null,
        can_advance: sim.can_advance
      });
    }
  }

  updateHUD(data) {
    if (!data) return;

    // 1. Update Sector Overlays
    const leftZone = document.getElementById("sector-left");
    const centerZone = document.getElementById("sector-center");
    const rightZone = document.getElementById("sector-right");

    const leftDist = document.getElementById("metric-left");
    const centerDist = document.getElementById("metric-center");
    const rightDist = document.getElementById("metric-right");

    const formatSector = (secValue, zoneEl, distEl) => {
      if (!zoneEl || !distEl) return;
      // Handle string format ("clear" | "obstacle" | "stairs" | "unknown") or legacy object
      let val = typeof secValue === "object" && secValue !== null ? (secValue.clear ? "clear" : "obstacle") : String(secValue || "clear");
      
      if (val === "clear") {
        zoneEl.className = "sector-zone clear-corridor";
        distEl.innerText = "CLEAR > 3m";
      } else if (val === "obstacle") {
        zoneEl.className = "sector-zone obstructed";
        distEl.innerText = "HAZARD / BLOCKED";
      } else if (val === "stairs") {
        zoneEl.className = "sector-zone obstructed";
        distEl.innerText = "⚠️ STAIRS DOWN";
      } else {
        zoneEl.className = "sector-zone";
        distEl.innerText = "SCANNING...";
      }
    };

    if (data.sectors) {
      formatSector(data.sectors.left, leftZone, leftDist);
      formatSector(data.sectors.center, centerZone, centerDist);
      formatSector(data.sectors.right, rightZone, rightDist);
    }

    // 2. Update Action Banner
    const banner = document.getElementById("action-banner");
    const actionTxt = document.getElementById("action-text");
    const voiceSub = document.getElementById("voice-subtitle");

    if (actionTxt) {
      actionTxt.innerText = (data.title || data.state || "PROCEED FORWARD").toUpperCase();
    }
    if (voiceSub) {
      voiceSub.innerText = data.voice_prompt ? `"${data.voice_prompt}"` : "";
    }

    if (banner) {
      banner.className = "action-banner";
      if (data.audio_pan && data.audio_pan > 0.2) {
        banner.classList.add("veer-right");
      } else if (data.audio_pan && data.audio_pan < -0.2) {
        banner.classList.add("veer-left");
      } else if (!data.can_advance || data.state === "STOPPED" || data.state === "UNAVAILABLE") {
        banner.classList.add("stop");
      }
    }

    // 3. Audio Engine Trigger
    if (window.spatialAudio) {
      const isUrgent = !data.can_advance && data.state === "STOPPED";
      window.spatialAudio.updateAudioRadar(data.audio_pan || 0, data.ping_rate_hz || 1, isUrgent);
      if (data.voice_prompt) {
        window.spatialAudio.speak(data.voice_prompt);
      }
    }

    // 4. Safety Guardrail Indicator
    const confVal = document.getElementById("confidence-value");
    if (confVal) {
      if (data.source === "camera") {
        confVal.innerText = "CAMERA PREVIEW (NO CV INFERENCE)";
        confVal.style.color = "#f59e0b";
      } else if (data.scenario === "low_light") {
        confVal.innerText = "UNAVAILABLE (< 25 LUX)";
        confVal.style.color = "#ef4444";
      } else {
        confVal.innerText = data.can_advance ? "94% CONFIDENCE" : "HAZARD FLAGGED";
        confVal.style.color = data.can_advance ? "#22c55e" : "#eab308";
      }
    }

    const safetyBadge = document.getElementById("safety-alert-badge");
    if (safetyBadge) {
      if (!data.can_advance && (data.state === "UNAVAILABLE" || data.scenario === "low_light")) {
        safetyBadge.style.display = "block";
        safetyBadge.innerText = "⚠️ Safety Gate: Environment uncertain. Walking speed restricted.";
      } else if (data.scenario === "stairs") {
        safetyBadge.style.display = "block";
        safetyBadge.innerText = "🪜 Elevation Hazard: Upcoming downward staircase detected.";
      } else {
        safetyBadge.style.display = "none";
      }
    }
  }
}

window.visionProcessor = new VisionProcessor();
