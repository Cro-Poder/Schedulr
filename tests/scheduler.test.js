/**
 * scheduler.test.js — Comprehensive test suite for the scheduling engine.
 *
 * Uses Node.js built-in test runner and assert module.
 * Run with: node --test tests/scheduler.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import scheduling functions — these are ES modules
import {
  fcfs, sjf, srtf, roundRobin, priority,
  compareAll, computeMetrics,
  validateProcessList, validateQuantum, validateProcess,
  PRESETS, getProcessColor
} from '../js/scheduler.js';

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function timelineToSegments(timeline) {
  return timeline.map(s => [s.pid, s.start, s.end]);
}

function getProcessMetric(result, pid, field) {
  const p = result.processes.find(proc => proc.pid === pid);
  return p ? p[field] : undefined;
}

// ═══════════════════════════════════════════════════════════════════
// 1. INPUT VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Input Validation', () => {

  it('rejects empty process list', () => {
    const r = validateProcessList([]);
    assert.equal(r.valid, false);
    assert.ok(r.errors.length > 0);
  });

  it('rejects null/undefined process list', () => {
    assert.equal(validateProcessList(null).valid, false);
    assert.equal(validateProcessList(undefined).valid, false);
  });

  it('rejects more than 20 processes', () => {
    const procs = Array.from({ length: 21 }, (_, i) => ({
      pid: `P${i + 1}`, arrivalTime: 0, burstTime: 1, priority: 1
    }));
    assert.equal(validateProcessList(procs).valid, false);
  });

  it('accepts exactly 20 processes', () => {
    const procs = Array.from({ length: 20 }, (_, i) => ({
      pid: `P${i + 1}`, arrivalTime: 0, burstTime: 1, priority: 1
    }));
    assert.equal(validateProcessList(procs).valid, true);
  });

  it('rejects negative arrival time', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: -1, burstTime: 1, priority: 1 });
    assert.ok(errors.length > 0);
  });

  it('rejects zero burst time', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: 0, burstTime: 0, priority: 1 });
    assert.ok(errors.length > 0);
  });

  it('rejects negative burst time', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: 0, burstTime: -3, priority: 1 });
    assert.ok(errors.length > 0);
  });

  it('rejects non-integer arrival time', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: 1.5, burstTime: 1, priority: 1 });
    assert.ok(errors.length > 0);
  });

  it('rejects non-integer burst time', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: 0, burstTime: 2.5, priority: 1 });
    assert.ok(errors.length > 0);
  });

  it('rejects non-integer priority', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: 0, burstTime: 1, priority: 1.5 });
    assert.ok(errors.length > 0);
  });

  it('accepts negative priority', () => {
    const errors = validateProcess({ pid: 'P1', arrivalTime: 0, burstTime: 1, priority: -5 });
    assert.equal(errors.length, 0);
  });

  it('rejects duplicate PIDs', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: 'P1', arrivalTime: 1, burstTime: 2, priority: 2 }
    ];
    const r = validateProcessList(procs);
    assert.equal(r.valid, false);
  });

  it('accepts valid process list', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 },
      { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }
    ];
    assert.equal(validateProcessList(procs).valid, true);
  });

  it('validates quantum correctly', () => {
    assert.equal(validateQuantum(2).valid, true);
    assert.equal(validateQuantum(1).valid, true);
    assert.equal(validateQuantum(0).valid, false);
    assert.equal(validateQuantum(-1).valid, false);
    assert.equal(validateQuantum(1.5).valid, false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. SINGLE PROCESS WORKLOAD
// ═══════════════════════════════════════════════════════════════════

describe('Single Process', () => {
  const procs = [{ pid: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 }];

  it('FCFS single process', () => {
    const r = fcfs(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [['P1', 0, 4]]);
    assert.equal(r.totalTime, 4);
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 4);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);
  });

  it('SJF single process', () => {
    const r = sjf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [['P1', 0, 4]]);
  });

  it('SRTF single process', () => {
    const r = srtf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [['P1', 0, 4]]);
  });

  it('Round Robin single process', () => {
    const r = roundRobin(procs, 2);
    // P1 runs 0-2, then 2-4
    assert.deepEqual(timelineToSegments(r.timeline), [['P1', 0, 2], ['P1', 2, 4]]);
    assert.equal(r.totalTime, 4);
  });

  it('Priority single process', () => {
    const r = priority(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [['P1', 0, 4]]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. SINGLE PROCESS WITH LATE ARRIVAL
// ═══════════════════════════════════════════════════════════════════

describe('Single Process Late Arrival', () => {
  const procs = [{ pid: 'P1', arrivalTime: 3, burstTime: 2, priority: 1 }];

  it('FCFS with idle gap before single process', () => {
    const r = fcfs(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['Idle', 0, 3], ['P1', 3, 5]
    ]);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. MANDATORY REFERENCE TEST CASES
//    Workload: P1(0,5,3), P2(1,3,1), P3(2,2,2)
// ═══════════════════════════════════════════════════════════════════

describe('Reference Test Cases — P1(0,5,3) P2(1,3,1) P3(2,2,2)', () => {
  const procs = [
    { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 },
    { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
    { pid: 'P3', arrivalTime: 2, burstTime: 2, priority: 2 }
  ];

  it('FCFS: P1 0-5, P2 5-8, P3 8-10', () => {
    const r = fcfs(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 5], ['P2', 5, 8], ['P3', 8, 10]
    ]);
    assert.equal(r.totalTime, 10);

    // P1: CT=5, TAT=5-0=5, WT=5-5=0, RT=0-0=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 5);
    assert.equal(getProcessMetric(r, 'P1', 'turnaroundTime'), 5);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);

    // P2: CT=8, TAT=8-1=7, WT=7-3=4, RT=5-1=4
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 8);
    assert.equal(getProcessMetric(r, 'P2', 'turnaroundTime'), 7);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 4);
    assert.equal(getProcessMetric(r, 'P2', 'responseTime'), 4);

    // P3: CT=10, TAT=10-2=8, WT=8-2=6, RT=8-2=6
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 10);
    assert.equal(getProcessMetric(r, 'P3', 'turnaroundTime'), 8);
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 6);
    assert.equal(getProcessMetric(r, 'P3', 'responseTime'), 6);

    // Averages: TAT=(5+7+8)/3=6.67, WT=(0+4+6)/3=3.33, RT=(0+4+6)/3=3.33
    assert.equal(r.metrics.averageTurnaroundTime, 6.67);
    assert.equal(r.metrics.averageWaitingTime, 3.33);
    assert.equal(r.metrics.averageResponseTime, 3.33);
    assert.equal(r.metrics.cpuUtilization, 100);
  });

  it('SJF: P1 0-5, P3 5-7, P2 7-10', () => {
    const r = sjf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 5], ['P3', 5, 7], ['P2', 7, 10]
    ]);
    assert.equal(r.totalTime, 10);

    // P1: CT=5, TAT=5, WT=0, RT=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 5);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);

    // P3: CT=7, TAT=7-2=5, WT=5-2=3, RT=5-2=3
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 7);
    assert.equal(getProcessMetric(r, 'P3', 'turnaroundTime'), 5);
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 3);

    // P2: CT=10, TAT=10-1=9, WT=9-3=6, RT=7-1=6
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 10);
    assert.equal(getProcessMetric(r, 'P2', 'turnaroundTime'), 9);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 6);
  });

  it('SRTF: P1 0-1, P2 1-4, P3 4-6, P1 6-10', () => {
    const r = srtf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 1], ['P2', 1, 4], ['P3', 4, 6], ['P1', 6, 10]
    ]);
    assert.equal(r.totalTime, 10);

    // P1: CT=10, TAT=10-0=10, WT=10-5=5, RT=0-0=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 10);
    assert.equal(getProcessMetric(r, 'P1', 'turnaroundTime'), 10);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 5);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);

    // P2: CT=4, TAT=4-1=3, WT=3-3=0, RT=1-1=0
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 4);
    assert.equal(getProcessMetric(r, 'P2', 'turnaroundTime'), 3);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P2', 'responseTime'), 0);

    // P3: CT=6, TAT=6-2=4, WT=4-2=2, RT=4-2=2
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 6);
    assert.equal(getProcessMetric(r, 'P3', 'turnaroundTime'), 4);
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 2);
    assert.equal(getProcessMetric(r, 'P3', 'responseTime'), 2);
  });

  it('Priority: P1 0-5, P2 5-8, P3 8-10', () => {
    const r = priority(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 5], ['P2', 5, 8], ['P3', 8, 10]
    ]);
    assert.equal(r.totalTime, 10);

    // P2 has priority 1 (highest), but P1 is already running (non-preemptive)
    // After P1 finishes at t=5, P2(prio=1) selected over P3(prio=2)
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 8);
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 10);
  });

  it('Round Robin (q=2): P1 0-2, P2 2-4, P3 4-6, P1 6-8, P2 8-9, P1 9-10', () => {
    const r = roundRobin(procs, 2);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 2], ['P2', 2, 4], ['P3', 4, 6],
      ['P1', 6, 8], ['P2', 8, 9], ['P1', 9, 10]
    ]);
    assert.equal(r.totalTime, 10);

    // P1: CT=10, TAT=10-0=10, WT=10-5=5, RT=0-0=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 10);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 5);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);

    // P2: CT=9, TAT=9-1=8, WT=8-3=5, RT=2-1=1
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 9);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 5);
    assert.equal(getProcessMetric(r, 'P2', 'responseTime'), 1);

    // P3: CT=6, TAT=6-2=4, WT=4-2=2, RT=4-2=2
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 6);
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 2);
    assert.equal(getProcessMetric(r, 'P3', 'responseTime'), 2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. MANDATORY IDLE-GAP TEST CASE
//    P1(3,2,2), P2(9,1,1)
// ═══════════════════════════════════════════════════════════════════

describe('Idle-Gap Test — P1(3,2,2) P2(9,1,1)', () => {
  const procs = [
    { pid: 'P1', arrivalTime: 3, burstTime: 2, priority: 2 },
    { pid: 'P2', arrivalTime: 9, burstTime: 1, priority: 1 }
  ];

  const expectedTimeline = [
    ['Idle', 0, 3], ['P1', 3, 5], ['Idle', 5, 9], ['P2', 9, 10]
  ];

  it('FCFS idle gaps', () => {
    const r = fcfs(procs);
    assert.deepEqual(timelineToSegments(r.timeline), expectedTimeline);
    assert.equal(r.totalTime, 10);
    assert.equal(r.metrics.cpuUtilization, 30); // 3 busy / 10 total
  });

  it('SJF idle gaps', () => {
    const r = sjf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), expectedTimeline);
  });

  it('SRTF idle gaps', () => {
    const r = srtf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), expectedTimeline);
  });

  it('Round Robin idle gaps (q=2)', () => {
    const r = roundRobin(procs, 2);
    assert.deepEqual(timelineToSegments(r.timeline), expectedTimeline);
  });

  it('Priority idle gaps', () => {
    const r = priority(procs);
    assert.deepEqual(timelineToSegments(r.timeline), expectedTimeline);
  });

  it('idle gap metrics are correct', () => {
    const r = fcfs(procs);
    // P1: CT=5, TAT=5-3=2, WT=2-2=0, RT=3-3=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 5);
    assert.equal(getProcessMetric(r, 'P1', 'turnaroundTime'), 2);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);
    // P2: CT=10, TAT=10-9=1, WT=1-1=0, RT=9-9=0
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 10);
    assert.equal(getProcessMetric(r, 'P2', 'turnaroundTime'), 1);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P2', 'responseTime'), 0);
    // Throughput = 2/10 = 0.2
    assert.equal(r.metrics.throughput, 0.2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. TIE-BREAKING TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Tie-Breaking', () => {

  it('FCFS: same arrival → lower PID first', () => {
    const procs = [
      { pid: 'P2', arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 }
    ];
    const r = fcfs(procs);
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
  });

  it('SJF: same burst → earlier arrival wins', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
      { pid: 'P3', arrivalTime: 2, burstTime: 3, priority: 1 }
    ];
    const r = sjf(procs);
    // P1 runs first (arrives first), then P2, then P3
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
    assert.equal(r.timeline[2].pid, 'P3');
  });

  it('SJF: same burst, same arrival → lower PID wins', () => {
    const procs = [
      { pid: 'P3', arrivalTime: 0, burstTime: 2, priority: 1 },
      { pid: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { pid: 'P2', arrivalTime: 0, burstTime: 2, priority: 1 }
    ];
    const r = sjf(procs);
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
    assert.equal(r.timeline[2].pid, 'P3');
  });

  it('SRTF: equal remaining → prefer currently running (no unnecessary preemption)', () => {
    // P1 starts, P2 arrives at t=1 with same remaining time — P1 should not be preempted
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 1 }
    ];
    const r = srtf(procs);
    // At t=1: P1 has remaining=2, P2 has remaining=2 → P1 continues (earlier arrival)
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 3], ['P2', 3, 5]
    ]);
  });

  it('SRTF: strictly shorter remaining → preempt', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 1 },
      { pid: 'P2', arrivalTime: 2, burstTime: 2, priority: 1 }
    ];
    const r = srtf(procs);
    // At t=2: P1 remaining=3, P2 remaining=2 → P2 preempts
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 2], ['P2', 2, 4], ['P1', 4, 7]
    ]);
  });

  it('Priority: same priority → earlier arrival wins', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 2, priority: 2 },
      { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 2 }
    ];
    const r = priority(procs);
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
  });

  it('Priority: same priority, same arrival → lower PID wins', () => {
    const procs = [
      { pid: 'P3', arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: 'P1', arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: 'P2', arrivalTime: 0, burstTime: 1, priority: 1 }
    ];
    const r = priority(procs);
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
    assert.equal(r.timeline[2].pid, 'P3');
  });

  it('RR: simultaneous arrivals → lower PID first in queue', () => {
    const procs = [
      { pid: 'P3', arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: 'P1', arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: 'P2', arrivalTime: 0, burstTime: 1, priority: 1 }
    ];
    const r = roundRobin(procs, 2);
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
    assert.equal(r.timeline[2].pid, 'P3');
  });

  it('RR: quantum-boundary ordering — new arrivals before re-enqueue', () => {
    // P1 arrives at 0, P2 arrives at 1, quantum=2
    // At t=2, P1 time slice ends. P2 (arrived at t=1) enters queue first,
    // then P1 re-enqueued.
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 1 }
    ];
    const r = roundRobin(procs, 2);
    // t=0-2: P1 (remaining=2). At t=2: enqueue P2 first, then P1.
    // t=2-4: P2 (done). t=4-6: P1 (done).
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 2], ['P2', 2, 4], ['P1', 4, 6]
    ]);
  });

  it('Numeric PID ordering: P2 before P10', () => {
    const procs = [
      { pid: 'P10', arrivalTime: 0, burstTime: 1, priority: 1 },
      { pid: 'P2', arrivalTime: 0, burstTime: 1, priority: 1 }
    ];
    const r = fcfs(procs);
    assert.equal(r.timeline[0].pid, 'P2');
    assert.equal(r.timeline[1].pid, 'P10');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. HAND-VERIFIED ALGORITHM CASES (2+ per algorithm = 10+ total)
// ═══════════════════════════════════════════════════════════════════

// ─── FCFS Case 2: Multiple arrivals with gaps ────────────────────

describe('FCFS — Hand-Verified Case 2', () => {
  const procs = [
    { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
    { pid: 'P2', arrivalTime: 5, burstTime: 2, priority: 1 }
  ];

  it('timeline and metrics', () => {
    const r = fcfs(procs);
    // P1: 0-3, Idle: 3-5, P2: 5-7
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 3], ['Idle', 3, 5], ['P2', 5, 7]
    ]);
    assert.equal(r.totalTime, 7);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 0);
    assert.equal(getProcessMetric(r, 'P2', 'responseTime'), 0);
    // CPU util: 5/7 * 100 = 71.43
    assert.equal(r.metrics.cpuUtilization, 71.43);
  });
});

// ─── SJF Case 2: Non-trivial selection ───────────────────────────

describe('SJF — Hand-Verified Case 2', () => {
  // At t=0: only P1 available. At t=3: P2(burst=4), P3(burst=1), P4(burst=2) available.
  // SJF selects P3(1), then P4(2), then P2(4).
  const procs = [
    { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
    { pid: 'P2', arrivalTime: 1, burstTime: 4, priority: 1 },
    { pid: 'P3', arrivalTime: 2, burstTime: 1, priority: 1 },
    { pid: 'P4', arrivalTime: 3, burstTime: 2, priority: 1 }
  ];

  it('timeline and metrics', () => {
    const r = sjf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 3], ['P3', 3, 4], ['P4', 4, 6], ['P2', 6, 10]
    ]);
    assert.equal(r.totalTime, 10);
    // P1: CT=3, TAT=3, WT=0, RT=0
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 0);
    // P3: CT=4, TAT=4-2=2, WT=2-1=1, RT=3-2=1
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 1);
    assert.equal(getProcessMetric(r, 'P3', 'responseTime'), 1);
    // P4: CT=6, TAT=6-3=3, WT=3-2=1, RT=4-3=1
    assert.equal(getProcessMetric(r, 'P4', 'waitingTime'), 1);
    // P2: CT=10, TAT=10-1=9, WT=9-4=5, RT=6-1=5
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 5);
  });
});

// ─── SRTF Case 2: Complex preemption ─────────────────────────────

describe('SRTF — Hand-Verified Case 2', () => {
  // P1(0,6,1), P2(2,4,1), P3(4,1,1)
  // t=0-2: P1 (remaining 4)
  // t=2: P2 arrives (remaining 4). P1 remaining=4, P2 remaining=4 → P1 earlier arrival → continues
  // t=4: P3 arrives (remaining 1). P1 remaining=2, P2 remaining=4 → P3 shortest → P3 runs
  // t=4-5: P3 (done)
  // t=5: P1 remaining=2, P2 remaining=4 → P1 runs
  // t=5-7: P1 (done)
  // t=7-11: P2 (done)
  const procs = [
    { pid: 'P1', arrivalTime: 0, burstTime: 6, priority: 1 },
    { pid: 'P2', arrivalTime: 2, burstTime: 4, priority: 1 },
    { pid: 'P3', arrivalTime: 4, burstTime: 1, priority: 1 }
  ];

  it('timeline and metrics', () => {
    const r = srtf(procs);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 4], ['P3', 4, 5], ['P1', 5, 7], ['P2', 7, 11]
    ]);
    assert.equal(r.totalTime, 11);
    // P1: CT=7, TAT=7, WT=7-6=1, RT=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 7);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 1);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);
    // P2: CT=11, TAT=11-2=9, WT=9-4=5, RT=7-2=5
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 11);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 5);
    // P3: CT=5, TAT=5-4=1, WT=0, RT=0
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 5);
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 0);
  });
});

// ─── Round Robin Case 2: Quantum = 3 ────────────────────────────

describe('Round Robin — Hand-Verified Case 2 (q=3)', () => {
  // P1(0,4,1), P2(0,3,1), P3(0,5,1), quantum=3
  // Initial queue: P1, P2, P3
  // t=0-3: P1 (remaining 1). Queue: P2, P3, P1
  // t=3-6: P2 (done). Queue: P3, P1
  // t=6-9: P3 (remaining 2). Queue: P1, P3
  // t=9-10: P1 (done, remaining 0 after 1 unit). Queue: P3
  // t=10-12: P3 (done)
  const procs = [
    { pid: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
    { pid: 'P2', arrivalTime: 0, burstTime: 3, priority: 1 },
    { pid: 'P3', arrivalTime: 0, burstTime: 5, priority: 1 }
  ];

  it('timeline and metrics', () => {
    const r = roundRobin(procs, 3);
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P1', 0, 3], ['P2', 3, 6], ['P3', 6, 9],
      ['P1', 9, 10], ['P3', 10, 12]
    ]);
    assert.equal(r.totalTime, 12);

    // P1: CT=10, TAT=10, WT=10-4=6, RT=0
    assert.equal(getProcessMetric(r, 'P1', 'completionTime'), 10);
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 6);
    assert.equal(getProcessMetric(r, 'P1', 'responseTime'), 0);

    // P2: CT=6, TAT=6, WT=6-3=3, RT=3
    assert.equal(getProcessMetric(r, 'P2', 'completionTime'), 6);
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 3);
    assert.equal(getProcessMetric(r, 'P2', 'responseTime'), 3);

    // P3: CT=12, TAT=12, WT=12-5=7, RT=6
    assert.equal(getProcessMetric(r, 'P3', 'completionTime'), 12);
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 7);
    assert.equal(getProcessMetric(r, 'P3', 'responseTime'), 6);
  });
});

// ─── Priority Case 2: Different priorities with same arrival ─────

describe('Priority — Hand-Verified Case 2', () => {
  // All arrive at 0. Priority: P2(1) < P3(2) < P1(3) < P4(5)
  const procs = [
    { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 3 },
    { pid: 'P2', arrivalTime: 0, burstTime: 2, priority: 1 },
    { pid: 'P3', arrivalTime: 0, burstTime: 4, priority: 2 },
    { pid: 'P4', arrivalTime: 0, burstTime: 1, priority: 5 }
  ];

  it('timeline and metrics', () => {
    const r = priority(procs);
    // Order: P2(prio 1), P3(prio 2), P1(prio 3), P4(prio 5)
    assert.deepEqual(timelineToSegments(r.timeline), [
      ['P2', 0, 2], ['P3', 2, 6], ['P1', 6, 9], ['P4', 9, 10]
    ]);
    assert.equal(r.totalTime, 10);

    // P2: CT=2, TAT=2, WT=0, RT=0
    assert.equal(getProcessMetric(r, 'P2', 'waitingTime'), 0);
    // P3: CT=6, TAT=6, WT=6-4=2, RT=2
    assert.equal(getProcessMetric(r, 'P3', 'waitingTime'), 2);
    // P1: CT=9, TAT=9, WT=9-3=6, RT=6
    assert.equal(getProcessMetric(r, 'P1', 'waitingTime'), 6);
    // P4: CT=10, TAT=10, WT=10-1=9, RT=9
    assert.equal(getProcessMetric(r, 'P4', 'waitingTime'), 9);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. METRIC VERIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Metric Verification', () => {

  it('waiting time is non-negative for all algorithms', () => {
    const procs = PRESETS.mixed.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      for (const p of r.processes) {
        assert.ok(p.waitingTime >= 0, `${r.algorithm} ${p.pid} WT=${p.waitingTime}`);
      }
    }
  });

  it('turnaround time >= burst time', () => {
    const procs = PRESETS.mixed.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      for (const p of r.processes) {
        const orig = procs.find(op => op.pid === p.pid);
        assert.ok(p.turnaroundTime >= orig.burstTime,
          `${r.algorithm} ${p.pid} TAT=${p.turnaroundTime} < BT=${orig.burstTime}`);
      }
    }
  });

  it('response time is non-negative', () => {
    const procs = PRESETS.convoy.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      for (const p of r.processes) {
        assert.ok(p.responseTime >= 0, `${r.algorithm} ${p.pid} RT=${p.responseTime}`);
      }
    }
  });

  it('completion time >= arrival time', () => {
    const procs = PRESETS.mixed.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      for (const p of r.processes) {
        const orig = procs.find(op => op.pid === p.pid);
        assert.ok(p.completionTime >= orig.arrivalTime,
          `${r.algorithm} ${p.pid} CT=${p.completionTime} < AT=${orig.arrivalTime}`);
      }
    }
  });

  it('CPU utilization does not exceed 100%', () => {
    const procs = PRESETS.idleGaps.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      assert.ok(r.metrics.cpuUtilization <= 100,
        `${r.algorithm} CPU util=${r.metrics.cpuUtilization}`);
    }
  });

  it('total busy time equals sum of burst times', () => {
    const procs = PRESETS.mixed.processes;
    const totalBurst = procs.reduce((s, p) => s + p.burstTime, 0);
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      const busyTime = r.timeline
        .filter(s => s.pid !== 'Idle')
        .reduce((sum, s) => sum + (s.end - s.start), 0);
      assert.equal(busyTime, totalBurst, `${r.algorithm} busy=${busyTime} vs burst=${totalBurst}`);
    }
  });

  it('no timeline overlaps or gaps', () => {
    const procs = PRESETS.convoy.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      for (let i = 1; i < r.timeline.length; i++) {
        assert.equal(r.timeline[i].start, r.timeline[i - 1].end,
          `${r.algorithm} gap/overlap at segment ${i}`);
      }
    }
  });

  it('every process completes exactly once', () => {
    const procs = PRESETS.mixed.processes;
    const algorithms = [
      () => fcfs(procs), () => sjf(procs), () => srtf(procs),
      () => roundRobin(procs, 2), () => priority(procs)
    ];
    for (const run of algorithms) {
      const r = run();
      const pids = procs.map(p => p.pid);
      const completedPids = r.processes.map(p => p.pid);
      assert.deepEqual(new Set(completedPids), new Set(pids), `${r.algorithm} missing processes`);
      assert.equal(completedPids.length, pids.length, `${r.algorithm} duplicate completions`);
    }
  });

  it('TAT = CT - AT, WT = TAT - BT, RT = FirstStart - AT', () => {
    const procs = PRESETS.mixed.processes;
    const r = srtf(procs);
    for (const p of r.processes) {
      const orig = procs.find(op => op.pid === p.pid);
      assert.equal(p.turnaroundTime, p.completionTime - orig.arrivalTime,
        `${p.pid} TAT formula`);
      assert.equal(p.waitingTime, p.turnaroundTime - orig.burstTime,
        `${p.pid} WT formula`);
      // Response time: first segment start for this PID
      const firstSeg = r.timeline.find(s => s.pid === p.pid);
      assert.equal(p.responseTime, firstSeg.start - orig.arrivalTime,
        `${p.pid} RT formula`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. INPUT IMMUTABILITY
// ═══════════════════════════════════════════════════════════════════

describe('Input Immutability', () => {

  it('FCFS does not modify input', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 },
      { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }
    ];
    const copy = JSON.parse(JSON.stringify(procs));
    fcfs(procs);
    assert.deepEqual(procs, copy);
  });

  it('SRTF does not modify input', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 },
      { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }
    ];
    const copy = JSON.parse(JSON.stringify(procs));
    srtf(procs);
    assert.deepEqual(procs, copy);
  });

  it('Round Robin does not modify input', () => {
    const procs = [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 },
      { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }
    ];
    const copy = JSON.parse(JSON.stringify(procs));
    roundRobin(procs, 2);
    assert.deepEqual(procs, copy);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. DETERMINISTIC OUTPUT
// ═══════════════════════════════════════════════════════════════════

describe('Deterministic Output', () => {

  it('same input produces identical results on repeated runs', () => {
    const procs = PRESETS.mixed.processes;
    const r1 = srtf(procs);
    const r2 = srtf(procs);
    assert.deepEqual(r1.timeline, r2.timeline);
    assert.deepEqual(r1.metrics, r2.metrics);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. COMPARE ALL
// ═══════════════════════════════════════════════════════════════════

describe('Compare All', () => {

  it('returns results for all 5 algorithms', () => {
    const procs = PRESETS.convoy.processes;
    const results = compareAll(procs, 2);
    assert.equal(results.length, 5);
    const names = results.map(r => r.algorithm);
    assert.ok(names.includes('FCFS'));
    assert.ok(names.includes('SJF'));
    assert.ok(names.includes('SRTF'));
    assert.ok(names.includes('Round Robin'));
    assert.ok(names.includes('Priority'));
  });

  it('does not mutate input', () => {
    const procs = PRESETS.mixed.processes.map(p => ({ ...p }));
    const copy = JSON.parse(JSON.stringify(procs));
    compareAll(procs, 2);
    assert.deepEqual(procs, copy);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. SIMULTANEOUS ARRIVALS
// ═══════════════════════════════════════════════════════════════════

describe('Simultaneous Arrivals', () => {

  it('all processes arrive at time 0 — FCFS orders by PID', () => {
    const procs = [
      { pid: 'P3', arrivalTime: 0, burstTime: 2, priority: 1 },
      { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: 'P2', arrivalTime: 0, burstTime: 1, priority: 1 }
    ];
    const r = fcfs(procs);
    assert.equal(r.timeline[0].pid, 'P1');
    assert.equal(r.timeline[1].pid, 'P2');
    assert.equal(r.timeline[2].pid, 'P3');
  });

  it('all processes arrive at time 0 — SJF orders by burst then PID', () => {
    const procs = [
      { pid: 'P3', arrivalTime: 0, burstTime: 2, priority: 1 },
      { pid: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
      { pid: 'P2', arrivalTime: 0, burstTime: 1, priority: 1 }
    ];
    const r = sjf(procs);
    assert.equal(r.timeline[0].pid, 'P2'); // burst 1
    assert.equal(r.timeline[1].pid, 'P3'); // burst 2
    assert.equal(r.timeline[2].pid, 'P1'); // burst 3
  });
});

// ═══════════════════════════════════════════════════════════════════
// 13. PRESET DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════

describe('Preset Data', () => {

  it('convoy preset has 4 processes', () => {
    assert.equal(PRESETS.convoy.processes.length, 4);
  });

  it('idle gaps preset has 4 processes', () => {
    assert.equal(PRESETS.idleGaps.processes.length, 4);
  });

  it('mixed workload preset has 5 processes', () => {
    assert.equal(PRESETS.mixed.processes.length, 5);
  });

  it('all presets pass validation', () => {
    for (const key of Object.keys(PRESETS)) {
      const r = validateProcessList(PRESETS[key].processes);
      assert.equal(r.valid, true, `Preset "${key}" invalid: ${r.errors.join(', ')}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 14. PROCESS COLOR ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════

describe('Process Colors', () => {

  it('returns consistent colors', () => {
    assert.equal(getProcessColor('P1'), getProcessColor('P1'));
    assert.notEqual(getProcessColor('P1'), getProcessColor('P2'));
  });

  it('handles high PID numbers', () => {
    const color = getProcessColor('P25');
    assert.ok(typeof color === 'string');
    assert.ok(color.startsWith('#'));
  });
});

