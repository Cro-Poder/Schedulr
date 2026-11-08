/**
 * ui.js — DOM Rendering Module
 *
 * Handles all DOM manipulation: process table, Gantt chart,
 * ready queue, results table, comparison view, and animation display.
 * No scheduling logic lives here.
 */

import { getProcessColor } from './scheduler.js';

// ─── Constants ────────────────────────────────────────────────────

const IDLE_COLOR = '#D5D8DB';
const IDLE_TEXT_COLOR = '#555B60';

// ─── Process Table ────────────────────────────────────────────────

/**
 * Render the editable process table.
 * @param {HTMLElement} tbody - Table body element.
 * @param {Array} processes - Current process list.
 * @param {Function} onEdit - Callback(index, field, value) when a field changes.
 * @param {Function} onRemove - Callback(index) when remove is clicked.
 */
export function renderProcessTable(tbody, processes, onEdit, onRemove) {
  tbody.innerHTML = '';

  for (let i = 0; i < processes.length; i++) {
    const p = processes[i];
    const tr = document.createElement('tr');

    // PID cell (read-only)
    const pidTd = document.createElement('td');
    pidTd.className = 'pid-cell';
    const pidInner = document.createElement('span');
    pidInner.className = 'pid-cell-inner';
    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = getProcessColor(p.pid);
    pidInner.appendChild(swatch);
    pidInner.appendChild(document.createTextNode(p.pid));
    pidTd.appendChild(pidInner);
    tr.appendChild(pidTd);

    // Editable cells
    const fields = [
      { key: 'arrivalTime', label: 'Arrival Time' },
      { key: 'burstTime', label: 'Burst Time' },
      { key: 'priority', label: 'Priority' }
    ];

    for (const field of fields) {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.value = p[field.key];
      input.className = 'process-input';
      input.setAttribute('aria-label', `${p.pid} ${field.label}`);
      input.dataset.index = i;
      input.dataset.field = field.key;
      input.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        onEdit(i, field.key, val, e.target);
      });
      td.appendChild(input);
      tr.appendChild(td);
    }

    // Remove button
    const actionTd = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'btn btn-remove';
    removeBtn.setAttribute('aria-label', `Remove ${p.pid}`);
    removeBtn.addEventListener('click', () => onRemove(i));
    if (processes.length <= 1) {
      removeBtn.disabled = true;
    }
    actionTd.appendChild(removeBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  }
}

// ─── Validation Display ───────────────────────────────────────────

/**
 * Show or clear a validation error on an input.
 */
export function showInputError(input, message) {
  input.classList.add('input-error');
  let errEl = input.parentElement.querySelector('.error-msg');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'error-msg';
    input.parentElement.appendChild(errEl);
  }
  errEl.textContent = message;
}

export function clearInputError(input) {
  input.classList.remove('input-error');
  const errEl = input.parentElement.querySelector('.error-msg');
  if (errEl) errEl.remove();
}

/**
 * Show a global validation message.
 */
export function showValidationMessage(container, messages) {
  container.innerHTML = '';
  if (messages.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  for (const msg of messages) {
    const div = document.createElement('div');
    div.textContent = msg;
    container.appendChild(div);
  }
}

// ─── Gantt Chart ──────────────────────────────────────────────────

/**
 * Render the full Gantt chart (static).
 * @param {HTMLElement} container - Gantt chart container.
 * @param {Array} timeline - Timeline segments.
 * @param {number} totalTime - Total simulation time.
 */
export function renderGanttChart(container, timeline, totalTime) {
  container.innerHTML = '';

  if (timeline.length === 0) {
    container.innerHTML = '<div class="gantt-empty">No timeline to display.</div>';
    return;
  }

  const chart = document.createElement('div');
  chart.className = 'gantt-chart';

  // Calculate minimum segment width for readability
  const minSegWidth = 40;

  for (let i = 0; i < timeline.length; i++) {
    const seg = timeline[i];
    const duration = seg.end - seg.start;
    const isIdle = seg.pid === 'Idle';

    const segEl = document.createElement('div');
    segEl.className = 'gantt-segment' + (isIdle ? ' gantt-idle' : '');
    segEl.dataset.index = i;
    if (!isIdle) {
      segEl.style.backgroundColor = getProcessColor(seg.pid);
    }
    segEl.style.minWidth = minSegWidth + 'px';
    segEl.style.flexGrow = duration;

    // Process label
    const label = document.createElement('div');
    label.className = 'gantt-label';
    label.textContent = seg.pid;
    segEl.appendChild(label);

    // Duration label
    const durLabel = document.createElement('div');
    durLabel.className = 'gantt-duration';
    durLabel.textContent = `(${duration})`;
    segEl.appendChild(durLabel);

    // Start time marker
    const startMark = document.createElement('div');
    startMark.className = 'gantt-time gantt-time-start';
    startMark.textContent = seg.start;
    segEl.appendChild(startMark);

    // End time marker (only on last segment or when next start differs)
    if (i === timeline.length - 1) {
      const endMark = document.createElement('div');
      endMark.className = 'gantt-time gantt-time-end';
      endMark.textContent = seg.end;
      segEl.appendChild(endMark);
    }

    chart.appendChild(segEl);
  }

  container.appendChild(chart);
}

/**
 * Highlight a specific segment in the Gantt chart (for animation).
 */
export function highlightGanttSegment(container, index) {
  const chart = container.querySelector('.gantt-chart');
  if (chart) chart.classList.add('gantt-animating');
  const segments = container.querySelectorAll('.gantt-segment');
  segments.forEach((seg, i) => {
    seg.classList.toggle('gantt-active', i <= index);
    seg.classList.toggle('gantt-current', i === index);
  });
}

/**
 * Clear all Gantt highlights.
 */
export function clearGanttHighlights(container) {
  const chart = container.querySelector('.gantt-chart');
  if (chart) chart.classList.remove('gantt-animating');
  const segments = container.querySelectorAll('.gantt-segment');
  segments.forEach(seg => {
    seg.classList.remove('gantt-active', 'gantt-current');
  });
}

// ─── Ready Queue ──────────────────────────────────────────────────

/**
 * Render the ready-queue display.
 * @param {HTMLElement} container - Ready queue container.
 * @param {Object} snapshot - { time, running, readyQueue, cpuIdle }
 */
export function renderReadyQueue(container, snapshot) {
  container.innerHTML = '';

  // Current time
  const timeDiv = document.createElement('div');
  timeDiv.className = 'rq-time';
  timeDiv.textContent = `Time: ${snapshot.time}`;
  container.appendChild(timeDiv);

  // CPU status
  const cpuDiv = document.createElement('div');
  cpuDiv.className = 'rq-cpu';
  if (snapshot.cpuIdle) {
    cpuDiv.innerHTML = '<span class="rq-status-label">CPU:</span> <span class="rq-idle">Idle</span>';
  } else {
    const color = getProcessColor(snapshot.running);
    cpuDiv.innerHTML = `<span class="rq-status-label">Running:</span> <span class="rq-running" style="background:${color}">${snapshot.running}</span>`;
  }
  container.appendChild(cpuDiv);

  // Queue
  const queueDiv = document.createElement('div');
  queueDiv.className = 'rq-queue';
  const qLabel = document.createElement('span');
  qLabel.className = 'rq-status-label';
  qLabel.textContent = 'Ready Queue:';
  queueDiv.appendChild(qLabel);

  if (snapshot.readyQueue.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'rq-empty';
    empty.textContent = ' (empty)';
    queueDiv.appendChild(empty);
  } else {
    for (const pid of snapshot.readyQueue) {
      const chip = document.createElement('span');
      chip.className = 'rq-chip';
      chip.style.backgroundColor = getProcessColor(pid);
      chip.textContent = pid;
      queueDiv.appendChild(chip);
    }
  }
  container.appendChild(queueDiv);
}

/**
 * Show initial empty state for ready queue.
 */
export function renderReadyQueueEmpty(container) {
  container.innerHTML = '<div class="rq-empty-state">Run a simulation to see the ready queue.</div>';
}

// ─── Results Table ────────────────────────────────────────────────

/**
 * Render the per-process results table and summary metrics.
 */
export function renderResultsTable(tbody, processes, metrics) {
  tbody.innerHTML = '';

  for (const p of processes) {
    const tr = document.createElement('tr');
    const cells = [
      p.pid, p.arrivalTime, p.burstTime, p.priority,
      p.completionTime, p.turnaroundTime, p.waitingTime, p.responseTime
    ];
    for (let i = 0; i < cells.length; i++) {
      const td = document.createElement('td');
      td.textContent = cells[i];
      if (i === 0) {
        td.textContent = '';
        const inner = document.createElement('span');
        inner.className = 'pid-cell-inner';
        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = getProcessColor(p.pid);
        inner.appendChild(swatch);
        inner.appendChild(document.createTextNode(p.pid));
        td.appendChild(inner);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // Averages row
  const avgTr = document.createElement('tr');
  avgTr.className = 'averages-row';
  const labels = ['Avg', '', '', '', '', 
    metrics.averageTurnaroundTime.toFixed(2),
    metrics.averageWaitingTime.toFixed(2),
    metrics.averageResponseTime.toFixed(2)
  ];
  for (const val of labels) {
    const td = document.createElement('td');
    td.textContent = val;
    avgTr.appendChild(td);
  }
  tbody.appendChild(avgTr);
}

/**
 * Render summary metric panels.
 */
export function renderMetricPanels(container, metrics) {
  container.innerHTML = `
    <div class="metric-panel">
      <div class="metric-label">CPU Utilization</div>
      <div class="metric-value">${metrics.cpuUtilization.toFixed(2)}%</div>
    </div>
    <div class="metric-panel">
      <div class="metric-label">Throughput</div>
      <div class="metric-value">${metrics.throughput.toFixed(2)} proc/unit</div>
    </div>
    <div class="metric-panel">
      <div class="metric-label">Avg Waiting</div>
      <div class="metric-value">${metrics.averageWaitingTime.toFixed(2)}</div>
    </div>
    <div class="metric-panel">
      <div class="metric-label">Avg Turnaround</div>
      <div class="metric-value">${metrics.averageTurnaroundTime.toFixed(2)}</div>
    </div>
    <div class="metric-panel">
      <div class="metric-label">Avg Response</div>
      <div class="metric-value">${metrics.averageResponseTime.toFixed(2)}</div>
    </div>
  `;
}

// ─── Compare All ──────────────────────────────────────────────────

/**
 * Render comparison table.
 */
export function renderComparisonTable(tbody, results) {
  tbody.innerHTML = '';

  for (const r of results) {
    const tr = document.createElement('tr');
    const cells = [
      r.algorithm,
      r.metrics.averageWaitingTime.toFixed(2),
      r.metrics.averageTurnaroundTime.toFixed(2),
      r.metrics.averageResponseTime.toFixed(2),
      r.metrics.cpuUtilization.toFixed(2) + '%',
      r.metrics.throughput.toFixed(2)
    ];
    for (const val of cells) {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

/**
 * Render comparison bar chart using inline SVG.
 */
export function renderComparisonChart(container, results) {
  container.innerHTML = '';

  const algorithms = results.map(r => r.algorithm);
  const waitingTimes = results.map(r => r.metrics.averageWaitingTime);
  const turnaroundTimes = results.map(r => r.metrics.averageTurnaroundTime);

  const maxVal = Math.max(...waitingTimes, ...turnaroundTimes, 1);

  const svgNS = 'http://www.w3.org/2000/svg';
  const chartWidth = 700;
  const chartHeight = 300;
  const marginLeft = 50;
  const marginBottom = 80;
  const marginTop = 30;
  const marginRight = 20;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`);
  svg.setAttribute('class', 'comparison-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Comparison bar chart of average waiting and turnaround times');

  const n = algorithms.length;
  const groupWidth = plotWidth / n;
  const barWidth = groupWidth * 0.3;
  const barGap = groupWidth * 0.05;

  // Y-axis scale
  const niceMax = niceRound(maxVal);
  const yScale = plotHeight / niceMax;

  // Grid lines and Y labels
  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    const val = (niceMax / numGridLines) * i;
    const y = marginTop + plotHeight - (val * yScale);

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', marginLeft);
    line.setAttribute('y1', y);
    line.setAttribute('x2', chartWidth - marginRight);
    line.setAttribute('y2', y);
    line.setAttribute('class', 'chart-grid-line');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', marginLeft - 5);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '11');
    label.setAttribute('class', 'chart-y-label');
    label.setAttribute('font-family', '"Courier New", monospace');
    label.textContent = val.toFixed(1);
    svg.appendChild(label);
  }

  for (let i = 0; i < n; i++) {
    const groupX = marginLeft + i * groupWidth + groupWidth * 0.15;

    // Waiting time bar
    const wHeight = waitingTimes[i] * yScale;
    const wRect = document.createElementNS(svgNS, 'rect');
    wRect.setAttribute('x', groupX);
    wRect.setAttribute('y', marginTop + plotHeight - wHeight);
    wRect.setAttribute('width', barWidth);
    wRect.setAttribute('height', Math.max(wHeight, 0));
    wRect.setAttribute('class', 'chart-bar-waiting');
    svg.appendChild(wRect);

    // Waiting time value
    if (waitingTimes[i] > 0) {
      const wVal = document.createElementNS(svgNS, 'text');
      wVal.setAttribute('x', groupX + barWidth / 2);
      wVal.setAttribute('y', marginTop + plotHeight - wHeight - 3);
      wVal.setAttribute('text-anchor', 'middle');
      wVal.setAttribute('font-size', '10');
      wVal.setAttribute('class', 'chart-val-label');
      wVal.setAttribute('font-family', '"Courier New", monospace');
      wVal.textContent = waitingTimes[i].toFixed(1);
      svg.appendChild(wVal);
    }

    // Turnaround time bar
    const tHeight = turnaroundTimes[i] * yScale;
    const tRect = document.createElementNS(svgNS, 'rect');
    tRect.setAttribute('x', groupX + barWidth + barGap);
    tRect.setAttribute('y', marginTop + plotHeight - tHeight);
    tRect.setAttribute('width', barWidth);
    tRect.setAttribute('height', Math.max(tHeight, 0));
    tRect.setAttribute('class', 'chart-bar-turnaround');
    svg.appendChild(tRect);

    // Turnaround time value
    if (turnaroundTimes[i] > 0) {
      const tVal = document.createElementNS(svgNS, 'text');
      tVal.setAttribute('x', groupX + barWidth + barGap + barWidth / 2);
      tVal.setAttribute('y', marginTop + plotHeight - tHeight - 3);
      tVal.setAttribute('text-anchor', 'middle');
      tVal.setAttribute('font-size', '10');
      tVal.setAttribute('class', 'chart-val-label');
      tVal.setAttribute('font-family', '"Courier New", monospace');
      tVal.textContent = turnaroundTimes[i].toFixed(1);
      svg.appendChild(tVal);
    }

    // Algorithm label
    const algLabel = document.createElementNS(svgNS, 'text');
    algLabel.setAttribute('x', groupX + barWidth + barGap / 2);
    algLabel.setAttribute('y', marginTop + plotHeight + 15);
    algLabel.setAttribute('text-anchor', 'middle');
    algLabel.setAttribute('font-size', '11');
    algLabel.setAttribute('class', 'chart-x-label');
    algLabel.setAttribute('font-family', 'Arial, Verdana, sans-serif');
    // Shorten labels for SVG
    const shortNames = { 'FCFS': 'FCFS', 'SJF': 'SJF', 'SRTF': 'SRTF', 'Round Robin': 'RR', 'Priority': 'Prio' };
    algLabel.textContent = shortNames[algorithms[i]] || algorithms[i];
    svg.appendChild(algLabel);
  }

  // Legend
  const legendY = chartHeight - 20;
  const legendX = marginLeft;

  const wLegRect = document.createElementNS(svgNS, 'rect');
  wLegRect.setAttribute('x', legendX);
  wLegRect.setAttribute('y', legendY);
  wLegRect.setAttribute('width', 12);
  wLegRect.setAttribute('height', 12);
  wLegRect.setAttribute('class', 'chart-bar-waiting');
  svg.appendChild(wLegRect);

  const wLegText = document.createElementNS(svgNS, 'text');
  wLegText.setAttribute('x', legendX + 16);
  wLegText.setAttribute('y', legendY + 10);
  wLegText.setAttribute('font-size', '11');
  wLegText.setAttribute('class', 'chart-leg-text');
  wLegText.setAttribute('font-family', 'Arial, Verdana, sans-serif');
  wLegText.textContent = 'Avg Waiting';
  svg.appendChild(wLegText);

  const tLegRect = document.createElementNS(svgNS, 'rect');
  tLegRect.setAttribute('x', legendX + 110);
  tLegRect.setAttribute('y', legendY);
  tLegRect.setAttribute('width', 12);
  tLegRect.setAttribute('height', 12);
  tLegRect.setAttribute('class', 'chart-bar-turnaround');
  svg.appendChild(tLegRect);

  const tLegText = document.createElementNS(svgNS, 'text');
  tLegText.setAttribute('x', legendX + 126);
  tLegText.setAttribute('y', legendY + 10);
  tLegText.setAttribute('font-size', '11');
  tLegText.setAttribute('class', 'chart-leg-text');
  tLegText.setAttribute('font-family', 'Arial, Verdana, sans-serif');
  tLegText.textContent = 'Avg Turnaround';
  svg.appendChild(tLegText);

  container.appendChild(svg);
}

function niceRound(val) {
  if (val <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  const norm = val / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

// ─── Animation Speed Display ──────────────────────────────────────

export function updateSpeedDisplay(el, speed) {
  el.textContent = speed.toFixed(2) + 'x';
}
