# 👁️ VisionPath AI — Spatial Campus Navigation for Visually Impaired Students

> **Problem Statement:** PS-15 (*Assistive Navigation for Visually Impaired Students*)  
> **Difficulty Level:** 9/10 (High Impact Official Recommendation)  
> **Evaluation Rubric Alignment:** Social Impact (25%) | Technical Implementation (25%) | Innovation (20%) | UI/UX (15%) | Practical Feasibility (15%)

---

## 💡 The Core Problem

Standard navigation tools (Google Maps, Apple Maps) are designed for sighted pedestrians using outdoor GPS. They fail visually impaired students inside college campuses because:
1. **They are blind to temporary obstacles:** A wet floor sign, construction barricade, or parked bicycle turns a familiar corridor into a danger zone.
2. **GPS doesn't work indoors:** Building interiors and multi-floor academic halls lose satellite signals.
3. **Generic AI apps talk too much:** Endless computer-generated speech creates cognitive overload, masking real-world ambient auditory cues.

---

## 🚀 The VisionPath AI Solution

**VisionPath AI** is an intelligent assistive co-pilot that combines:
* **3-Sector Spatial Perception HUD (Left / Center / Right):** Calculates safe traversable corridors and monocular distance estimation instead of useless generic bounding boxes.
* **3D Spatial Binaural Audio (Web Audio API):** Pings sound directly to the left or right ear, guiding the student intuitively toward the clear path without overwhelming speech fatigue.
* **Dynamic A* Campus Indoor/Outdoor Rerouting:** When a temporary hazard (e.g., wet floor or construction) is spotted, it registers the obstacle onto the campus graph and instantly calculates an accessible alternate route (e.g., via Ramp Corridor B).
* **Responsible AI & Human-in-the-Loop Safeguards:** Features a Real-Time Confidence Gate (under low-light or sensor degradation, it warns the user and alerts a campus volunteer dispatcher with live telemetry).

---

## ⚡ Quick Start (1 Step)

Double-click `RUN_APP.bat` or run:

```bash
python server.py
```

Then open your browser at **`http://localhost:8000`** on your laptop or phone!

---

## 🎯 5 Live Pitch Scenarios Built-In

During your 3-minute hackathon pitch, use the top scenario bar to demonstrate the system live without hardware failure:
1. 🟢 **Clear Hallway:** Normal forward walking, rhythmic center pings.
2. ⚠️ **Wet Floor Sign:** Detects center hazard at 1.4m, immediately directs student to veer right into the clear corridor, pings right ear.
3. 🚧 **Corridor Blockage:** Detects wide barricade, issues imperative `STOP` command and prepares safe turnaround.
4. 🪜 **Staircase Descent Caution:** Flags upcoming downward elevation change for blind user safety.
5. 🌙 **Low-Light Safety Trigger:** Demonstrates Responsible AI guardrails when lighting drops below 25 lux.
6. 📹 **Live Camera Stream:** Switch to physical laptop/phone camera to demonstrate live physical frame processing!

---

## 🏆 Scoring Rubric Alignment (How You Win 1st Place)

| Criterion | Weight | VisionPath AI Implementation |
| :--- | :---: | :--- |
| **Social Impact** | 25% | Direct empowerment of visually impaired campus students; independence in navigating new classrooms, labs, and sudden campus hazards. |
| **Technical Implementation** | 25% | Multi-stage pipeline: real-time spatial sectoring, depth estimation, low-latency audio synthesis, and dynamic graph rerouting under dynamic obstacles. |
| **Innovation** | 20% | **Dynamic Hazard Re-routing** (connecting CV obstacle detection to the campus map) + **3D Spatial Binaural Panning** instead of annoying endless talking. |
| **UI/UX** | 15% | Screen-reader optimized, voice-driven, high contrast (4.5:1 ratio), dual-mode (Student HUD + Campus Dispatcher portal). |
| **Practical Feasibility** | 15% | Works on standard smartphone browsers with zero specialized hardware; includes confidence gates and human volunteer fallback for safety. |

---

## 🛡️ Responsible AI & Ethical Safeguards (Organizer Requirements)

In compliance with the hackathon rules (*"Teams should document limitations, false positives, privacy protections, and responsible-AI safeguards"*):
1. **Confidence Gate:** The model never guesses when sensor confidence drops below 60%. It triggers safe-mode fallback.
2. **Privacy by Design:** Video frames are processed in-memory for obstacle vectors; bystander faces are blurred; no continuous facial footage is persisted.
3. **Human-in-the-Loop:** High-risk path closures require campus dispatcher confirmation before campus-wide broadcast.

