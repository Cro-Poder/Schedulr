# Schedulr — CPU Scheduling Visualizer

An interactive educational web application that demonstrates how CPU scheduling algorithms execute processes. Designed for computer science students studying operating systems.

![Schedulr Screenshot](screenshots/schedulr.png)

Live Demo: [Add deployment URL here]

---

## Project Summary

Schedulr visualizes five CPU scheduling algorithms side by side, showing how each one selects and executes processes over time. Users can create processes with custom arrival times, burst times, and priorities, then observe the scheduling behavior through animated Gantt charts, live ready-queue displays, and per-process performance metrics.

The application prioritizes **correct scheduling behavior** over visual polish. Every algorithm is independently implemented with precise tie-breaking rules, idle-gap handling, and preemption logic, making it suitable for academic demonstrations and exam preparation.

---

## Features

- **Five scheduling algorithms**: FCFS, SJF, SRTF, Round Robin, Priority
- **Editable process table** with validation (up to 20 processes)
- **Animated Gantt chart** with Play, Pause, Step Forward, Reset, and speed control
- **Live ready queue** synchronized with animation showing CPU state at each step
- **Per-process metrics**: completion time, turnaround time, waiting time, response time
- **Aggregate metrics**: average times, CPU utilization, throughput
- **Compare All mode**: side-by-side comparison of all algorithms with bar chart
- **Three preset workloads** demonstrating convoy effect, idle gaps, and mixed scenarios
- **Adjustable time quantum** for Round Robin
- **Responsive layout** functional down to 375px
- **Dark & Light theme support**: Default academic dark theme with persistent toggle
- **Zero dependencies**: no frameworks, libraries, CDNs, or build tools
- **Comprehensive test suite**: 69 automated tests using Node.js built-in test runner

---

## Technologies

| Layer | Technology |
|-------|------------|
| Markup | HTML5 (semantic) |
| Styling | CSS3 (system fonts, no preprocessor) |
| Logic | Vanilla JavaScript (ES modules) |
| Testing | Node.js built-in `node:test` and `node:assert/strict` |

**No external dependencies.** The application runs by opening `index.html` in a modern browser.

---

## How to Run

### Option 1: Direct File Open

Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari).

### Option 2: Local Server (if ES modules are blocked)

Some browsers restrict ES module imports over `file://`. Use any static file server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx, no install)
npx serve .

# PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`.

---

## Scheduling Algorithms

### 1. FCFS — First Come First Serve

**Type:** Non-preemptive

Processes execute in the order they arrive. Once a process starts, it runs to completion. Simple but can cause the **convoy effect** where a long process delays many short ones.

- **Selection**: Earliest arrival time
- **Preemption**: None
- **Tie-breaking**: Lower PID number

### 2. SJF — Shortest Job First

**Type:** Non-preemptive

Selects the available process with the shortest burst time. Optimal for minimizing average waiting time among non-preemptive algorithms, but requires advance knowledge of burst times.

- **Selection**: Shortest burst time among arrived processes
- **Preemption**: None
- **Tie-breaking**: Earlier arrival time, then lower PID

**Important:** SJF selects from currently arrived processes, not by globally sorting all processes.

### 3. SRTF — Shortest Remaining Time First

**Type:** Preemptive

The preemptive version of SJF. At each scheduling decision point (typically when a new process arrives), the process with the shortest **remaining** burst time runs. A newly arrived process preempts the running process only if its remaining time is **strictly shorter**.

- **Selection**: Shortest remaining burst time
- **Preemption**: When a new arrival has strictly shorter remaining time
- **Tie-breaking**: Earlier arrival time, then lower PID
- **No unnecessary preemption**: Equal remaining times do not trigger preemption

### 4. Round Robin (RR)

**Type:** Preemptive (time-sharing)

Each process receives a fixed time slice (quantum). If a process does not finish within its quantum, it is placed at the back of the ready queue. Ensures fairness at the cost of context-switching overhead.

- **Selection**: FIFO ready-queue order
- **Preemption**: After each time quantum
- **Time quantum**: Configurable (default: 2, minimum: 1)
- **Queue ordering at quantum boundary (time T)**:
  1. Enqueue all newly arrived processes (arrival ≤ T) ordered by PID
  2. Re-enqueue the unfinished running process

### 5. Priority Scheduling

**Type:** Non-preemptive

Selects the available process with the highest priority. Lower numeric priority values indicate higher scheduling priority.

- **Selection**: Lowest priority number among arrived processes
- **Preemption**: None
- **Tie-breaking**: Earlier arrival time, then lower PID

---

## Scheduling Metrics

### Per-Process Metrics

| Metric | Formula |
|--------|---------|
| **Completion Time (CT)** | Time at which the process finishes execution |
| **Turnaround Time (TAT)** | CT − Arrival Time |
| **Waiting Time (WT)** | TAT − Burst Time |
| **Response Time (RT)** | First CPU Start Time − Arrival Time |

### Aggregate Metrics

| Metric | Formula |
|--------|---------|
| **Average Waiting Time** | Sum of all WT / Number of processes |
| **Average Turnaround Time** | Sum of all TAT / Number of processes |
| **Average Response Time** | Sum of all RT / Number of processes |
| **CPU Utilization** | (Total Busy Time / Total Simulation Time) × 100% |
| **Throughput** | Number of Completed Processes / Total Simulation Time |

---

## Tie-Breaking Rules

All algorithms follow a consistent tie-breaking hierarchy:

1. **Primary criterion**: Algorithm-specific (arrival time for FCFS, burst for SJF, remaining time for SRTF, priority value for Priority, FIFO order for RR)
2. **Secondary**: Earlier arrival time
3. **Tertiary**: Lower numeric PID (P2 < P10, not alphabetical)

### Round Robin Queue Ordering

At each quantum boundary (time T):
1. First: enqueue all newly arrived processes with arrival ≤ T (ordered by PID)
2. Then: re-enqueue the unfinished running process

This ensures newly arriving processes get a fair turn before the interrupted process runs again.

### SRTF Preemption Rule

A running process is preempted **only** when a newly arrived process has a **strictly shorter** remaining time. Equal remaining times do **not** trigger preemption — the currently running process continues.

---

## Presets

### Convoy Effect
| PID | Arrival | Burst | Priority |
|-----|---------|-------|----------|
| P1  | 0       | 10    | 3        |
| P2  | 1       | 2     | 1        |
| P3  | 2       | 1     | 2        |
| P4  | 3       | 2     | 4        |

**Demonstrates:** A long process (P1) delays all short processes under FCFS.

### Idle Gaps
| PID | Arrival | Burst | Priority |
|-----|---------|-------|----------|
| P1  | 0       | 3     | 2        |
| P2  | 7       | 2     | 1        |
| P3  | 12      | 4     | 3        |
| P4  | 13      | 1     | 2        |

**Demonstrates:** CPU sits idle between process arrivals, affecting utilization.

### Mixed Workload
| PID | Arrival | Burst | Priority |
|-----|---------|-------|----------|
| P1  | 0       | 5     | 3        |
| P2  | 1       | 3     | 1        |
| P3  | 2       | 8     | 4        |
| P4  | 4       | 2     | 2        |
| P5  | 6       | 4     | 2        |

**Demonstrates:** Varied arrival times, burst times, and priorities reveal algorithmic differences.

---

## Animation

### Controls

| Control | Behavior |
|---------|----------|
| **Play** | Start/resume segment-by-segment animation |
| **Pause** | Stop playback without resetting progress |
| **Step** | Advance exactly one timeline segment |
| **Reset** | Return to the beginning, clear highlights |
| **Speed** | Adjustable from 0.25× to 3× (slider) |

Animation duration per segment scales with the segment's time units. Changing algorithm or input while playing stops and resets the animation.

---

## Compare All

Click **Compare All** to run all five algorithms on the current process set with the current quantum.

Displays:
- **Comparison table**: Average waiting, turnaround, response times, CPU utilization, throughput
- **Bar chart**: Visual comparison of average waiting and turnaround times (SVG)

---

## Project Structure

```
Schedulr/
│
├── index.html              # Application markup and layout
│
├── css/
│   └── style.css           # All visual styling
│
├── js/
│   ├── scheduler.js        # Pure scheduling algorithms and metrics
│   ├── ui.js               # DOM rendering functions
│   └── main.js             # App controller, events, animation
│
├── tests/
│   └── scheduler.test.js   # Automated test suite (69 tests)
│
└── README.md               # This file
```

### Architecture

- **scheduler.js**: Pure functions — no DOM access, no browser APIs. Accepts process data, returns deterministic results. Safe to test under Node.js.
- **ui.js**: DOM rendering only. Receives data, produces HTML. No scheduling logic.
- **main.js**: Glue layer. Manages application state, binds events, coordinates scheduler and UI.

---

## Testing

Run the complete test suite:

```bash
node --test tests/scheduler.test.js
```

### Test Categories (69 tests total)

| Category | Count | Description |
|----------|-------|-------------|
| Input Validation | 14 | Empty lists, bounds, types, duplicates |
| Single Process | 6 | Basic single-process behavior |
| Reference Cases | 5 | Mandatory hand-verified workload (all algorithms) |
| Idle-Gap Cases | 6 | Idle intervals for all algorithms |
| Tie-Breaking | 10 | PID ordering, preemption rules, queue ordering |
| Hand-Verified Cases | 5 | Additional 2+ cases per algorithm |
| Metric Verification | 9 | Formula correctness, bounds, consistency |
| Input Immutability | 3 | Algorithms don't modify input data |
| Deterministic Output | 1 | Identical results on repeated runs |
| Compare All | 2 | Multi-algorithm execution and immutability |
| Simultaneous Arrivals | 2 | Same-time arrival ordering |
| Preset Data | 4 | Preset integrity |
| Process Colors | 2 | Color assignment consistency |

All tests use exact expected values from hand calculations, not fuzzy or structural checks.

---

## Limitations

- This is a **client-side educational simulator**. It does not interact with an actual operating-system CPU scheduler.
- Maximum 20 processes per simulation.
- All scheduling decisions use integer time units.
- The application assumes deterministic, known burst times (no I/O bursts or process blocking).
- Priority Scheduling is non-preemptive only. Preemptive Priority is not implemented.
- No multi-level queue or multi-level feedback queue algorithms.
- The bar chart uses SVG with a fixed viewBox; extremely large metric values may need manual scale adjustment.

