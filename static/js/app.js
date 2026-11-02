/**
 * VisionPath AI - Application Controller & Accessibility Dispatcher
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Core Engines
  window.visionProcessor.init("camera-video", "demo-canvas");
  window.campusMap.init("campus-svg");

  // Tab Navigation
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");

      if (targetId === "tab-map") {
        window.campusMap.render();
      }
    });
  });

  // Pitch Scenario Segmented Chips
  const scenarioBtns = document.querySelectorAll(".chip-scenario, .scenario-btn");
  scenarioBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      scenarioBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const scenario = btn.getAttribute("data-scenario");
      if (scenario === "camera") {
        window.visionProcessor.startCamera();
        window.spatialAudio.speak("Camera activated. Scanning physical corridor.", true);
      } else {
        window.visionProcessor.switchToSimulation(scenario);
      }
    });
  });

  // Audio / Voice Toggle Controls
  const toggleMuteBtn = document.getElementById("toggle-audio-btn");
  if (toggleMuteBtn) {
    toggleMuteBtn.addEventListener("click", () => {
      const isMuted = window.spatialAudio.toggleMute();
      toggleMuteBtn.classList.toggle("active", !isMuted);
      toggleMuteBtn.innerHTML = isMuted 
        ? `<img src="icons/volume-2.svg" class="icon icon-sm icon-white" alt="" /><span>Spatial Audio OFF</span>`
        : `<img src="icons/volume-2.svg" class="icon icon-sm icon-cyan" alt="" /><span>Spatial Audio ON</span>`;
    });
  }

  const toggleVoiceBtn = document.getElementById("toggle-voice-btn");
  if (toggleVoiceBtn) {
    toggleVoiceBtn.addEventListener("click", () => {
      const isVoiceOn = window.spatialAudio.toggleVoice();
      toggleVoiceBtn.classList.toggle("active", isVoiceOn);
      toggleVoiceBtn.innerHTML = isVoiceOn 
        ? `<img src="icons/headphones.svg" class="icon icon-sm icon-white" alt="" /><span>Voice Guide ON</span>`
        : `<img src="icons/headphones.svg" class="icon icon-sm icon-white" alt="" /><span>Voice Guide OFF</span>`;
    });
  }

  // Voice Input (SpeechRecognition) Engine
  let recognition = null;
  let isListening = false;
  const micBtn = document.getElementById("mic-btn");
  const recognizedBanner = document.getElementById("voice-recognized-banner");
  const recognizedTextEl = document.getElementById("voice-recognized-text");

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
      console.log("Voice Command Detected:", transcript);

      if (recognizedBanner && recognizedTextEl) {
        recognizedBanner.style.display = "block";
        recognizedTextEl.innerText = `"${transcript}"`;
        setTimeout(() => { recognizedBanner.style.display = "none"; }, 4000);
      }

      handleVoiceCommand(transcript);
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e);
    };

    recognition.onend = () => {
      if (isListening) {
        try { recognition.start(); } catch (_) {}
      }
    };
  }

  if (micBtn) {
    micBtn.addEventListener("click", () => {
      if (!recognition) {
        alert("Speech Recognition not supported in this browser. Please use Google Chrome or Edge.");
        return;
      }
      if (!isListening) {
        try {
          recognition.start();
          isListening = true;
          micBtn.classList.add("listening");
          micBtn.innerHTML = `<img src="icons/mic.svg" class="icon icon-sm icon-white" alt="" /><span>Listening... (Say Command)</span>`;
          window.spatialAudio.speak("Voice assistant active. Say: navigate to library, scan ahead, or emergency.", true);
        } catch (e) {
          console.warn("Failed to start speech recognition:", e);
        }
      } else {
        isListening = false;
        try { recognition.stop(); } catch (_) {}
        micBtn.classList.remove("listening");
        micBtn.innerHTML = `<img src="icons/mic.svg" class="icon icon-sm" alt="" /><span>Voice Commands: OFF</span>`;
      }
    });
  }

  function handleVoiceCommand(cmd) {
    // 1. Navigation Destinations
    if (cmd.includes("cs lab") || cmd.includes("computer science") || cmd.includes("ai center")) {
      window.campusMap.targetNode = "N5";
      window.campusMap.fetchRoute();
      window.spatialAudio.speak("Route set to CS Lab 102. Proceed forward.", true);
    } else if (cmd.includes("library")) {
      window.campusMap.targetNode = "N7";
      window.campusMap.fetchRoute();
      window.spatialAudio.speak("Route updated to Library Main Entrance. Follow tactile paving.", true);
    } else if (cmd.includes("cafeteria") || cmd.includes("food") || cmd.includes("canteen")) {
      window.campusMap.targetNode = "N8";
      window.campusMap.fetchRoute();
      window.spatialAudio.speak("Route updated to Student Cafeteria.", true);
    } else if (cmd.includes("seminar") || cmd.includes("auditorium")) {
      window.campusMap.targetNode = "N10";
      window.campusMap.fetchRoute();
      window.spatialAudio.speak("Route updated to Seminar Hall 2B.", true);
    }
    // 2. Scan Ahead / Status
    else if (cmd.includes("scan") || cmd.includes("ahead") || cmd.includes("what is ahead")) {
      const actTxt = document.getElementById("action-text").innerText;
      const vSub = document.getElementById("voice-subtitle").innerText;
      window.spatialAudio.speak(`Current scan: ${actTxt}. ${vSub}`, true);
    }
    // 3. Repeat
    else if (cmd.includes("repeat") || cmd.includes("again")) {
      window.spatialAudio.speak(window.spatialAudio.lastSpokenText || "Path is clear ahead.", true);
    }
    // 4. Emergency / SOS
    else if (cmd.includes("emergency") || cmd.includes("sos") || cmd.includes("help")) {
      if (sosBtn) sosBtn.click();
    }
    // 5. Mute
    else if (cmd.includes("mute")) {
      if (toggleMuteBtn) toggleMuteBtn.click();
    }
  }

  // Emergency Volunteer SOS Dispatch
  let localAlerts = [];
  const sosBtn = document.getElementById("sos-btn");
  if (sosBtn) {
    sosBtn.addEventListener("click", async () => {
      let confMsg = "Emergency signal sent to campus volunteer center. Live telemetry shared. Help is on the way.";
      const clientReqId = "REQ-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
      const locNode = window.campusMap ? (window.campusMap.startNode || "N3") : "N3";
      
      try {
        const res = await fetch("/api/volunteer/sos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_request_id: clientReqId,
            location_node: locNode,
            reason: "User Emergency Assistance Request / Obstacle Disorientation"
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.alert) {
            confMsg = `Emergency request registered (#${data.alert.id}). Dispatcher notified at ${data.alert.location_name}.`;
          }
        }
      } catch (e) {
        console.warn("Using offline SOS fallback:", e);
      }

      localAlerts.unshift({
        id: "REQ-" + Math.floor(1000 + Math.random() * 9000),
        client_request_id: clientReqId,
        location_node: locNode,
        location_name: "Academic Block A Foyer",
        timestamp: new Date().toLocaleTimeString(),
        reason: "User Emergency Assistance Request / Obstacle Disorientation",
        status: "RECEIVED",
        acknowledged_at: null,
        resolved_at: null
      });

      alert("🚨 EMERGENCY VOLUNTEER DISPATCHED!\n" + confMsg);
      if (window.spatialAudio) window.spatialAudio.speak(confMsg, true);
      loadVolunteerAlerts();
    });
  }

  // Dynamic Hazard Simulation Button on Campus Map
  const reportHazardBtn = document.getElementById("btn-trigger-hazard");
  if (reportHazardBtn) {
    reportHazardBtn.addEventListener("click", () => {
      window.campusMap.reportDynamicHazard();
    });
  }

  const clearHazardBtn = document.getElementById("btn-clear-hazards");
  if (clearHazardBtn) {
    clearHazardBtn.addEventListener("click", () => {
      window.campusMap.clearAllHazards();
    });
  }

  // Keyboard Accessibility Shortcuts
  window.addEventListener("keydown", (e) => {
    // Space: repeat last speech instruction
    if (e.code === "Space") {
      e.preventDefault();
      window.spatialAudio.speak(window.spatialAudio.lastSpokenText || "Path is clear ahead.", true);
    }
    // Key 'S': Trigger Emergency SOS
    if (e.key === "s" || e.key === "S") {
      if (sosBtn) sosBtn.click();
    }
    // Key 'M': Toggle Mute
    if (e.key === "m" || e.key === "M") {
      if (toggleMuteBtn) toggleMuteBtn.click();
    }
  });

  // Initial load
  loadVolunteerAlerts();
});

async function loadVolunteerAlerts() {
  try {
    const res = await fetch("/api/volunteer/alerts");
    if (res.ok) {
      const data = await res.json();
      if (data.alerts && data.alerts.length > 0) {
        renderAlertsList(data.alerts);
        return;
      }
    }
  } catch (e) {
    // Offline mode
  }
  renderAlertsList(localAlerts);
}

window.updateAlertStatus = async function(alertId, newStatus) {
  try {
    const res = await fetch("/api/volunteer/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alertId, status: newStatus })
    });
    if (res.ok) {
      loadVolunteerAlerts();
      return;
    }
  } catch (e) {
    console.warn("Offline alert update:", e);
  }

  // Local fallback update
  const local = localAlerts.find(a => a.id === alertId);
  if (local) {
    local.status = newStatus;
    if (newStatus === "ACKNOWLEDGED") local.acknowledged_at = new Date().toLocaleTimeString();
    if (newStatus === "RESOLVED") local.resolved_at = new Date().toLocaleTimeString();
  }
  renderAlertsList(localAlerts);
};

function renderAlertsList(alerts) {
  const listEl = document.getElementById("volunteer-alerts-list");
  if (!listEl) return;

  if (!alerts || alerts.length === 0) {
    listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No active SOS emergency requests. All student routes normal.</p>`;
    return;
  }

  listEl.innerHTML = alerts.map(a => {
    const loc = a.location_name || a.location_node || "Campus Hallway";
    const status = a.status || "RECEIVED";
    const isReceived = status === "RECEIVED";
    const isAck = status === "ACKNOWLEDGED";
    const isResolved = status === "RESOLVED";

    let badgeColor = "#ef4444";
    if (isAck) badgeColor = "#f59e0b";
    if (isResolved) badgeColor = "#22c55e";

    return `
      <div style="background:#18131e; border:1px solid ${badgeColor}; border-radius:8px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f8fafc; font-size:0.95rem;">🚨 Request #${a.id}</strong>
          <span style="font-size:0.75rem; background:${badgeColor}; color:#fff; font-weight:700; padding:3px 8px; border-radius:4px;">${status}</span>
        </div>
        <p style="font-size:0.85rem; color:#cbd5e1; margin-top:4px;"><strong>Location:</strong> ${loc} (${a.timestamp ? a.timestamp.substring(11, 19) || a.timestamp : "Just now"})</p>
        <p style="font-size:0.8rem; color:#94a3b8; margin-top:2px;"><strong>Reason:</strong> ${a.reason}</p>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          ${isReceived ? `
            <button class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem; border-color:#f59e0b; color:#f59e0b;" onclick="window.updateAlertStatus('${a.id}', 'ACKNOWLEDGED')">
              <img src="icons/check.svg" class="icon icon-sm icon-amber" alt="" /> Acknowledge Request
            </button>
          ` : ""}
          ${isAck ? `
            <button class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem; border-color:#22c55e; color:#22c55e;" onclick="window.updateAlertStatus('${a.id}', 'RESOLVED')">
              <img src="icons/check.svg" class="icon icon-sm icon-green" alt="" /> Mark Resolved
            </button>
          ` : ""}
          ${isResolved ? `
            <span style="font-size:0.8rem; color:#22c55e; align-self:center;">✅ Resolved by Dispatcher</span>
          ` : ""}
          <button class="btn btn-primary" style="padding:4px 10px; font-size:0.8rem;" onclick="alert('Connected to student live audio channel!')">
            <img src="icons/headphones.svg" class="icon icon-sm icon-white" alt="" /> Connect Two-Way Audio
          </button>
        </div>
      </div>
    `;
  }).join("");
}
