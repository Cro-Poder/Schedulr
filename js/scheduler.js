/**
 * scheduler.js — Pure CPU Scheduling Engine
 *
 * Contains all scheduling algorithms and metric calculations.
 * No DOM manipulation. No browser-specific APIs.
 * All functions are pure: deterministic output for identical input.
 */

// ─── Helpers ───────────────────────────────────────────────────────

/** Extract numeric PID value from "P1", "P2", etc. */
function pidNum(pid) {
  return parseInt(pid.replace('P', ''), 10);
}

/** Deep-clone an array of process objects to avoid mutating caller data. */
function cloneProcesses(processes) {
  return processes.map(p => ({ ...p }));
}

// ─── Input Validation ──────────────────────────────────────────────

/**
 * Validate a single process object.
 * Returns an array of error strings (empty if valid).
 */
export function validateProcess(proc) {
  const errors = [];
  if (proc.arrivalTime === undefined || proc.arrivalTime === null ||
      !Number.isInteger(proc.arrivalTime) || proc.arrivalTime < 0) {
    errors.push(`${proc.pid}: Arrival time must be a non-negative integer.`);
  }
  if (proc.burstTime === undefined || proc.burstTime === null ||
      !Number.isInteger(proc.burstTime) || proc.burstTime < 1) {
    errors.push(`${proc.pid}: Burst time must be a positive integer.`);
  }
  if (proc.priority === undefined || proc.priority === null ||
      !Number.isInteger(proc.priority)) {
    errors.push(`${proc.pid}: Priority must be an integer.`);
  }
  return errors;
}

/**
 * Validate the entire process list.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateProcessList(processes) {
  const errors = [];
  if (!Array.isArray(processes) || processes.length === 0) {
    return { valid: false, errors: ['At least one process is required.'] };
  }
  if (processes.length > 20) {
    return { valid: false, errors: ['Maximum 20 processes allowed.'] };
  }
  const pids = new Set();
  for (const p of processes) {
    if (pids.has(p.pid)) {
      errors.push(`Duplicate PID: ${p.pid}.`);
    }
    pids.add(p.pid);
    errors.push(...validateProcess(p));
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate quantum for Round Robin.
 */
export function validateQuantum(quantum) {
  if (!Number.isInteger(quantum) || quantum < 1) {
    return { valid: false, error: 'Time quantum must be a positive integer.' };
  }
  return { valid: true, error: null };
}

// ─── Metric Calculations ──────────────────────────────────────────

/**
 * Compute per-process metrics from timeline and original process data.
 * Returns enriched process array and aggregate metrics.
 */
export function computeMetrics(timeline, originalProcesses, totalTime) {
  const procs = cloneProcesses(originalProcesses);
  const firstStart = {};
  const completionTime = {};

  for (const seg of timeline) {
    if (seg.pid === 'Idle') continue;
    if (firstStart[seg.pid] === undefined) {
      firstStart[seg.pid] = seg.start;
    }
    completionTime[seg.pid] = seg.end;
  }

  let totalWT = 0, totalTAT = 0, totalRT = 0;
  const busyTime = timeline.reduce((s, seg) => s + (seg.pid !== 'Idle' ? seg.end - seg.start : 0), 0);

  for (const p of procs) {
    p.completionTime = completionTime[p.pid];
    p.turnaroundTime = p.completionTime - p.arrivalTime;
    p.waitingTime = p.turnaroundTime - p.burstTime;
    p.responseTime = firstStart[p.pid] - p.arrivalTime;
    totalWT += p.waitingTime;
    totalTAT += p.turnaroundTime;
    totalRT += p.responseTime;
  }

  const n = procs.length;
  const metrics = {
    averageWaitingTime: round2(totalWT / n),
    averageTurnaroundTime: round2(totalTAT / n),
    averageResponseTime: round2(totalRT / n),
    cpuUtilization: totalTime > 0 ? round2((busyTime / totalTime) * 100) : 0,
    throughput: totalTime > 0 ? round2(n / totalTime) : 0
  };

  return { processes: procs, metrics };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// ─── Ready-Queue Snapshot Generation ──────────────────────────────

/**
 * Build an array of snapshots (one per timeline segment) describing
 * the simulation state at each step.  The UI uses these directly.
 *
 * Each snapshot: { time, running, readyQueue: [pid, ...], cpuIdle }
 *
 * Algorithm-specific snapshot generators produce accurate queue states.
 */

// ─── FCFS ──────────────────────────────────────────────────────────

export function fcfs(inputProcesses) {
  const processes = cloneProcesses(inputProcesses);
  processes.sort((a, b) => a.arrivalTime - b.arrivalTime || pidNum(a.pid) - pidNum(b.pid));

  const timeline = [];
  let time = 0;

  for (const p of processes) {
    if (time < p.arrivalTime) {
      timeline.push({ pid: 'Idle', start: time, end: p.arrivalTime });
      time = p.arrivalTime;
    }
    timeline.push({ pid: p.pid, start: time, end: time + p.burstTime });
    time += p.burstTime;
  }

  const totalTime = time;
  const { processes: enriched, metrics } = computeMetrics(timeline, inputProcesses, totalTime);
  const snapshots = buildNonPreemptiveSnapshots(timeline, inputProcesses);

  return { algorithm: 'FCFS', timeline, processes: enriched, metrics, totalTime, snapshots };
}

// ─── SJF ───────────────────────────────────────────────────────────

export function sjf(inputProcesses) {
  const remaining = cloneProcesses(inputProcesses);
  const timeline = [];
  let time = 0;
  const done = new Set();

  while (done.size < inputProcesses.length) {
    // Available: arrived and not done
    const available = remaining.filter(p => p.arrivalTime <= time && !done.has(p.pid));

    if (available.length === 0) {
      // Find next arrival
      const nextArrival = remaining
        .filter(p => !done.has(p.pid))
        .reduce((min, p) => Math.min(min, p.arrivalTime), Infinity);
      timeline.push({ pid: 'Idle', start: time, end: nextArrival });
      time = nextArrival;
      continue;
    }

    // SJF selection: shortest burst, then earliest arrival, then lowest PID
    available.sort((a, b) =>
      a.burstTime - b.burstTime ||
      a.arrivalTime - b.arrivalTime ||
      pidNum(a.pid) - pidNum(b.pid)
    );

    const selected = available[0];
    timeline.push({ pid: selected.pid, start: time, end: time + selected.burstTime });
    time += selected.burstTime;
    done.add(selected.pid);
  }

  const totalTime = time;
  const { processes: enriched, metrics } = computeMetrics(timeline, inputProcesses, totalTime);
  const snapshots = buildNonPreemptiveSnapshots(timeline, inputProcesses);

  return { algorithm: 'SJF', timeline, processes: enriched, metrics, totalTime, snapshots };
}

// ─── SRTF ──────────────────────────────────────────────────────────

export function srtf(inputProcesses) {
  const procs = cloneProcesses(inputProcesses);
  // Add remaining time tracking
  for (const p of procs) {
    p.remaining = p.burstTime;
  }

  const timeline = [];
  let time = 0;
  const done = new Set();
  const n = procs.length;

  while (done.size < n) {
    const available = procs.filter(p => p.arrivalTime <= time && !done.has(p.pid) && p.remaining > 0);

    if (available.length === 0) {
      const nextArrival = procs
        .filter(p => !done.has(p.pid))
        .reduce((min, p) => Math.min(min, p.arrivalTime), Infinity);

      timeline.push({ pid: 'Idle', start: time, end: nextArrival });
      time = nextArrival;
      continue;
    }

    // Select shortest remaining, then earliest arrival, then lowest PID
    available.sort((a, b) =>
      a.remaining - b.remaining ||
      a.arrivalTime - b.arrivalTime ||
      pidNum(a.pid) - pidNum(b.pid)
    );

    const selected = available[0];

    // Determine how long this process runs before a possible preemption
    // It runs until: (a) next arrival that might preempt, (b) it finishes
    const futureArrivals = procs
      .filter(p => p.arrivalTime > time && !done.has(p.pid) && p.remaining > 0)
      .map(p => p.arrivalTime)
      .sort((a, b) => a - b);

    let runUntil = time + selected.remaining;
    for (const arr of futureArrivals) {
      if (arr >= runUntil) break;
      if (arr > time) {
        runUntil = arr;
        break;
      }
    }

    const runDuration = runUntil - time;

    // Merge contiguous segments of the same process for cleaner Gantt display.
    const last = timeline[timeline.length - 1];
    if (last && last.pid === selected.pid && last.end === time) {
      last.end = time + runDuration;
    } else {
      timeline.push({ pid: selected.pid, start: time, end: time + runDuration });
    }

    selected.remaining -= runDuration;
    time += runDuration;

    if (selected.remaining === 0) {
      done.add(selected.pid);
    }
  }

  const totalTime = time;
  const { processes: enriched, metrics } = computeMetrics(timeline, inputProcesses, totalTime);

  // Build snapshots aligned 1:1 with final (merged) timeline segments
  const snapshots = buildSrtfSnapshots(timeline, inputProcesses);

  return { algorithm: 'SRTF', timeline, processes: enriched, metrics, totalTime, snapshots };
}

/**
 * Build SRTF snapshots from the final merged timeline.
 * For each segment, reconstruct which processes are waiting in the ready queue.
 */
function buildSrtfSnapshots(timeline, inputProcesses) {
  const snapshots = [];
  const procs = cloneProcesses(inputProcesses);

  // Track remaining times using the timeline
  const remainingAt = {};
  for (const p of procs) {
    remainingAt[p.pid] = p.burstTime;
  }

  // For each segment, figure out the state at segment.start
  for (let i = 0; i < timeline.length; i++) {
    const seg = timeline[i];

    // Subtract execution time of all prior segments
    // (done cumulatively)

    if (seg.pid === 'Idle') {
      snapshots.push({
        time: seg.start,
        running: null,
        readyQueue: [],
        cpuIdle: true
      });
    } else {
      // Arrived, not completed, not the running one
      const waiting = procs
        .filter(p =>
          p.arrivalTime <= seg.start &&
          p.pid !== seg.pid &&
          remainingAt[p.pid] > 0
        )
        .sort((a, b) =>
          remainingAt[a.pid] - remainingAt[b.pid] ||
          a.arrivalTime - b.arrivalTime ||
          pidNum(a.pid) - pidNum(b.pid)
        )
        .map(p => p.pid);

      snapshots.push({
        time: seg.start,
        running: seg.pid,
        readyQueue: waiting,
        cpuIdle: false
      });
    }

    // After this segment executes, update remaining time
    if (seg.pid !== 'Idle') {
      remainingAt[seg.pid] -= (seg.end - seg.start);
    }
  }

  return snapshots;
}

// ─── Round Robin ───────────────────────────────────────────────────

export function roundRobin(inputProcesses, quantum = 2) {
  const procs = cloneProcesses(inputProcesses);
  for (const p of procs) {
    p.remaining = p.burstTime;
  }
  // Sort by arrival, then PID for initial ordering
  procs.sort((a, b) => a.arrivalTime - b.arrivalTime || pidNum(a.pid) - pidNum(b.pid));

  const timeline = [];
  const snapshots = [];
  const queue = []; // PIDs in queue
  const inQueue = new Set();
  const done = new Set();
  let time = 0;
  const n = procs.length;

  // Enqueue processes arriving at time 0
  for (const p of procs) {
    if (p.arrivalTime <= time) {
      queue.push(p.pid);
      inQueue.add(p.pid);
    }
  }

  while (done.size < n) {
    if (queue.length === 0) {
      // Find next arrival
      const nextProc = procs
        .filter(p => !done.has(p.pid) && !inQueue.has(p.pid))
        .sort((a, b) => a.arrivalTime - b.arrivalTime || pidNum(a.pid) - pidNum(b.pid))[0];

      if (!nextProc) break;

      const idleSeg = { pid: 'Idle', start: time, end: nextProc.arrivalTime };
      timeline.push(idleSeg);

      snapshots.push({
        time,
        running: null,
        readyQueue: [],
        cpuIdle: true
      });

      time = nextProc.arrivalTime;

      // Enqueue all processes arriving at this time
      for (const p of procs) {
        if (p.arrivalTime <= time && !done.has(p.pid) && !inQueue.has(p.pid)) {
          queue.push(p.pid);
          inQueue.add(p.pid);
        }
      }
      continue;
    }

    const currentPid = queue.shift();
    const proc = procs.find(p => p.pid === currentPid);
    const execTime = Math.min(quantum, proc.remaining);

    // Snapshot: show current running + remaining queue
    snapshots.push({
      time,
      running: currentPid,
      readyQueue: [...queue],
      cpuIdle: false
    });

    timeline.push({ pid: currentPid, start: time, end: time + execTime });
    proc.remaining -= execTime;
    time += execTime;

    // After execution: enqueue newly arrived processes FIRST, then re-enqueue current if unfinished
    // "Newly arrived" = arrival <= time, not done, not already in queue
    for (const p of procs) {
      if (p.arrivalTime <= time && !done.has(p.pid) && !inQueue.has(p.pid) && p.pid !== currentPid) {
        queue.push(p.pid);
        inQueue.add(p.pid);
      }
    }

    if (proc.remaining > 0) {
      queue.push(currentPid);
      // currentPid stays in inQueue
    } else {
      done.add(currentPid);
      inQueue.delete(currentPid);
    }
  }

  const totalTime = time;
  const { processes: enriched, metrics } = computeMetrics(timeline, inputProcesses, totalTime);

  return { algorithm: 'Round Robin', timeline, processes: enriched, metrics, totalTime, snapshots };
}

// ─── Priority (Non-Preemptive) ─────────────────────────────────────

export function priority(inputProcesses) {
  const remaining = cloneProcesses(inputProcesses);
  const timeline = [];
  let time = 0;
  const done = new Set();

  while (done.size < inputProcesses.length) {
    const available = remaining.filter(p => p.arrivalTime <= time && !done.has(p.pid));

    if (available.length === 0) {
      const nextArrival = remaining
        .filter(p => !done.has(p.pid))
        .reduce((min, p) => Math.min(min, p.arrivalTime), Infinity);
      timeline.push({ pid: 'Idle', start: time, end: nextArrival });
      time = nextArrival;
      continue;
    }

    // Priority selection: lower number = higher priority, then arrival, then PID
    available.sort((a, b) =>
      a.priority - b.priority ||
      a.arrivalTime - b.arrivalTime ||
      pidNum(a.pid) - pidNum(b.pid)
    );

    const selected = available[0];
    timeline.push({ pid: selected.pid, start: time, end: time + selected.burstTime });
    time += selected.burstTime;
    done.add(selected.pid);
  }

  const totalTime = time;
  const { processes: enriched, metrics } = computeMetrics(timeline, inputProcesses, totalTime);
  const snapshots = buildNonPreemptiveSnapshots(timeline, inputProcesses);

  return { algorithm: 'Priority', timeline, processes: enriched, metrics, totalTime, snapshots };
}

// ─── Non-preemptive snapshot builder ──────────────────────────────

/**
 * Build snapshots for non-preemptive algorithms (FCFS, SJF, Priority).
 * At each segment start, show the running process and waiting arrived processes.
 */
function buildNonPreemptiveSnapshots(timeline, inputProcesses) {
  const snapshots = [];
  const procs = cloneProcesses(inputProcesses);
  const done = new Set();

  for (const seg of timeline) {
    const time = seg.start;

    if (seg.pid === 'Idle') {
      snapshots.push({
        time,
        running: null,
        readyQueue: [],
        cpuIdle: true
      });
    } else {
      // Arrived, not done, not the running one
      const waiting = procs
        .filter(p => p.arrivalTime <= time && !done.has(p.pid) && p.pid !== seg.pid)
        .map(p => p.pid);

      snapshots.push({
        time,
        running: seg.pid,
        readyQueue: waiting,
        cpuIdle: false
      });

      done.add(seg.pid);
    }
  }

  return snapshots;
}

// ─── Compare All ──────────────────────────────────────────────────

/**
 * Run all five algorithms on the same input.
 * Returns an array of result objects.
 */
export function compareAll(inputProcesses, quantum = 2) {
  return [
    fcfs(inputProcesses),
    sjf(inputProcesses),
    srtf(inputProcesses),
    roundRobin(inputProcesses, quantum),
    priority(inputProcesses)
  ];
}

// ─── Presets ──────────────────────────────────────────────────────

export const PRESETS = {
  convoy: {
    name: 'Convoy Effect',
    description: 'A long process delays short processes under FCFS.',
    processes: [
      { pid: 'P1', arrivalTime: 0,  burstTime: 10, priority: 3 },
      { pid: 'P2', arrivalTime: 1,  burstTime: 2,  priority: 1 },
      { pid: 'P3', arrivalTime: 2,  burstTime: 1,  priority: 2 },
      { pid: 'P4', arrivalTime: 3,  burstTime: 2,  priority: 4 }
    ]
  },
  idleGaps: {
    name: 'Idle Gaps',
    description: 'Demonstrates idle CPU periods between process arrivals.',
    processes: [
      { pid: 'P1', arrivalTime: 0,  burstTime: 3, priority: 2 },
      { pid: 'P2', arrivalTime: 7,  burstTime: 2, priority: 1 },
      { pid: 'P3', arrivalTime: 12, burstTime: 4, priority: 3 },
      { pid: 'P4', arrivalTime: 13, burstTime: 1, priority: 2 }
    ]
  },
  mixed: {
    name: 'Mixed Workload',
    description: 'Mixed arrival times, burst times, and priorities.',
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 },
      { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
      { pid: 'P3', arrivalTime: 2, burstTime: 8, priority: 4 },
      { pid: 'P4', arrivalTime: 4, burstTime: 2, priority: 2 },
      { pid: 'P5', arrivalTime: 6, burstTime: 4, priority: 2 }
    ]
  }
};

// ─── Process Color Assignment ─────────────────────────────────────

const PROCESS_COLORS = [
  '#B8C9D8', '#D6C2A8', '#BDD0BE', '#D6B9B9', '#C8C0D6',
  '#C4D4C0', '#D8C8B8', '#B8C4D0', '#D0C4B8', '#C0C8D4',
  '#D4C0C8', '#B8D0C4', '#D0D0B8', '#C8B8D0', '#B8D4D4',
  '#D4D0C0', '#C0B8D0', '#D0C0C0', '#B8C0C0', '#D0D4C8'
];

export function getProcessColor(pid) {
  const idx = pidNum(pid) - 1;
  return PROCESS_COLORS[idx % PROCESS_COLORS.length];
}
