# Through the Tunnel · Simulation Lab

A dependency-free, browser-based simulator for vehicle positioning during a GNSS outage. It models one vehicle on a single-lane road without junctions, with three geometries: straight, single curve, and S-shaped. Ground truth and Approaches A, B, and C are implemented. The scope is position estimation along a known road; detailed branching, lane changes, and the full platform or infrastructure modules described in the solution document are outside this version.

## Live demo

**[Open the simulator](https://mertozerdem.github.io/through-the-tunnel-simulator/)** — no installation required.

## Running locally

Prerequisites for running locally: a working Python 3 installation. Tests additionally require Node.js 18 or newer. Check your versions with `python3 --version` and `node --version`.

From the project directory, using Python 3:

```sh
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173. If port 4173 is already in use, choose another port in the command and URL (for example, 4183). The modular `index.html` uses ES modules and a Worker, so it must be served over HTTP rather than opened through `file://`. No installation or build step is required. Fonts are optionally loaded from Google Fonts; system fonts are used when the network is unavailable.

On macOS, if the system Python reports an Xcode license error, use a separately installed Python 3 or complete the Xcode setup before retrying. If Node reports `bad option: --test`, switch to Node.js 18 or newer.

Run tests with Node.js 18+:

```sh
node --test tests/*.test.js
```

## Model names and display order

The interface presents the models in this order: **Actual vehicle → Constant speed (A) → Acceleration tracking · Kalman (C) → Advanced sensor fusion · IMM-EKF (B)**. Cards, chart layers, legends, and summaries follow the same order. The numerical engine, colors, and A/B/C data keys are preserved. CSV model columns use A/C/B order; JSON exports also include the display names and order. This progression represents increasing model complexity, not a guaranteed ranking of accuracy in every run.

## Usage

The simulator is designed for desktop use, with a minimum layout width of 1120 px. The speed and tunnel-length sliders are in the **Experiment controls** panel at the top, which scrolls with the page.

- **Target speed, 30–110 km/h:** Sets the cruising speed of a new run. Changing it during a run preserves the current position and history while the vehicle accelerates or slows down within acceleration and jerk limits. Actual speed is displayed beside the target. A live command replaces the remaining automatic slowdown or stop profile.
- **Tunnel length, 500–5000 m:** Rescales the geometry and starts a new run from time zero with the same seed and selected speed. Changing the road geometry or driving profile also starts a new run and clears live speed commands. Changing phone, map, seed, or technical parameters regenerates the experiment while preserving the initial speed and scheduled live speed commands.
- **New run:** Clears live commands and restarts with the selected speed and automatic driving profile. **Rewind (↺):** Replays the same recording, including live speed commands.

Play/Pause, 1×–32× playback, and timeline scrubbing are supported. When a speed command is issued during playback, playback resumes from the same point after computation finishes; when paused, it remains paused. Scrubbing back and issuing a new speed command replaces existing commands at that time and later. Additional settings are grouped in the left-hand controls for Driver / Wavespeed, actual sensor parameters, and filter assumptions. **Follow vehicle** tracks the ground-truth vehicle. Vehicles and chart lines can be hidden through the legend.

Speed changes are stored as `{at: seconds, speed: km/h}` events. A Web Worker recomputes the run using the same initial conditions, seed, and preceding commands; a new command takes effect on the next 10 Hz frame. This enables live intervention without changing the visible history. Target speed is supplied only to the ground-truth driver controller; the estimators do not receive this command or the ground-truth position. They track changes through simulated sensor and GNSS recordings. Calibration history is preserved. Slider changes may cause a brief computation delay.

Vertical dashed lines mark live command times in the charts; the gray dashed line in the speed chart shows target speed. The run summary reports tunnel-wide RMSE, peak error, the proportion of estimates within ±50 m, and coverage of the reported ±2σ interval. It also lists live command times. CSV exports contain raw estimates, sensor channels, `truth_a_mps2`, and `target_speed_kmh`. Scenario JSON exports preserve settings, commands, and the summary.

**Quick interview experiment:** Select Cruise, 80 km/h, and a 2 km tunnel. At 30 seconds into the tunnel, change the target to 40 km/h. About 20 seconds later, discuss why Constant speed continues at its entry speed while Advanced sensor fusion follows braking through sensor measurements. Then set the target to 100 km/h and inspect the maneuver probability. Repeat with a 5 km straight tunnel and an S-shaped tunnel using the same seed.

## Exit callout

The exit is the tunnel end. Each model independently calls it out when its raw along-track position first reaches 90% of tunnel length (10% remaining). This is a distance-based demonstration policy, not a validated real-world warning distance. The vehicle continues along the single lane; an internal exit or branch is not simulated.

The live event table and run summary record ground truth and all three estimators: elapsed callout time, timing error versus ground truth (negative = early), and actual remaining distance to the exit. Events latch once at 10 Hz; missing events remain explicit. JSON includes the event records and CSV marks the triggering frame. Callouts never feed back into the estimators or driver.
