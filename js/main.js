/**
 * main.js — Application Controller
 *
 * Initializes the app, manages state, wires events between
 * scheduler.js (engine) and ui.js (rendering).
 */

import {
  fcfs, sjf, srtf, roundRobin, priority,
  compareAll, validateProcessList, validateQuantum,
  PRESETS, getProcessColor
} from './scheduler.js';

import {
  renderProcessTable, renderGanttChart, renderResultsTable,
  renderMetricPanels, renderComparisonTable, renderComparisonChart,
  renderReadyQueue, renderReadyQueueEmpty,
  highlightGanttSegment, clearGanttHighlights,
  showInputError, clearInputError, showValidationMessage,
  updateSpeedDisplay
} from './ui.js';

// ─── Application State ───────────────────────────────────────────

const state = {
  processes: [],
  nextPidNum: 1,
  selectedAlgorithm: 'fcfs',
  quantum: 2,
  currentResult: null,
  animationIndex: -1,
  animationPlaying: false,
  animationTimerId: null,
  animationSpeed: 1.0,
  animationGeneration: 0  // incremented on each new simulation to invalidate stale callbacks
};

// ─── DOM References ───────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

let els = {};

function cacheDomElements() {
  els = {
    processTableBody: $('process-table-body'),
    addProcessBtn: $('add-process-btn'),
    presetSelect: $('preset-select'),
    algorithmSelect: $('algorithm-select'),
    quantumInput: $('quantum-input'),
    quantumGroup: $('quantum-group'),
    runBtn: $('run-btn'),
    ganttContainer: $('gantt-container'),
    readyQueueContainer: $('ready-queue-container'),
    resultsTableBody: $('results-table-body'),
    metricPanels: $('metric-panels'),
    validationMsg: $('validation-msg'),
    // Animation controls
    playBtn: $('play-btn'),
    pauseBtn: $('pause-btn'),
    stepBtn: $('step-btn'),
    resetBtn: $('reset-btn'),
    speedSlider: $('speed-slider'),
    speedDisplay: $('speed-display'),
    // Compare
    compareBtn: $('compare-btn'),
    comparisonTableBody: $('comparison-table-body'),
    comparisonChartContainer: $('comparison-chart-container'),
    comparisonSection: $('comparison-section'),
    // Results section
    resultsSection: $('results-section'),
    ganttSection: $('gantt-section'),
    // Theme toggle
    themeToggleBtn: $('theme-toggle-btn'),
    themeText: $('theme-text')
  };
}

// ─── Initialization ───────────────────────────────────────────────

function init() {
  cacheDomElements();
  initTheme();
  loadPreset('convoy');
  bindEvents();
  updateQuantumVisibility();
  updateSpeedDisplay(els.speedDisplay, state.animationSpeed);
  renderReadyQueueEmpty(els.readyQueueContainer);
}

// ─── Theme Management ─────────────────────────────────────────────

function initTheme() {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('schedulr-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (_) {}
  setTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('schedulr-theme', theme);
  } catch (_) {}
  if (els.themeText) {
    els.themeText.textContent = theme === 'dark' ? 'Light Theme' : 'Dark Theme';
  }
}

// ─── Event Binding ────────────────────────────────────────────────

function bindEvents() {
  if (els.themeToggleBtn) {
    els.themeToggleBtn.addEventListener('click', toggleTheme);
  }
  els.addProcessBtn.addEventListener('click', addProcess);
  els.presetSelect.addEventListener('change', onPresetChange);
  els.algorithmSelect.addEventListener('change', onAlgorithmChange);
  els.quantumInput.addEventListener('change', onQuantumChange);
  els.runBtn.addEventListener('click', runSimulation);
  els.playBtn.addEventListener('click', animationPlay);
  els.pauseBtn.addEventListener('click', animationPause);
  els.stepBtn.addEventListener('click', animationStep);
  els.resetBtn.addEventListener('click', animationReset);
  els.speedSlider.addEventListener('input', onSpeedChange);
  els.compareBtn.addEventListener('click', runCompareAll);
}

// ─── Preset Loading ───────────────────────────────────────────────

function loadPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  state.processes = preset.processes.map(p => ({ ...p }));
  state.nextPidNum = preset.processes.length + 1;

  els.presetSelect.value = key;
  refreshProcessTable();
  resetSimulation();
}

function onPresetChange(e) {
  loadPreset(e.target.value);
}

// ─── Process Management ───────────────────────────────────────────

function addProcess() {
  if (state.processes.length >= 20) return;

  const pid = 'P' + state.nextPidNum;
  state.nextPidNum++;

  state.processes.push({
    pid,
    arrivalTime: 0,
    burstTime: 1,
    priority: 1
  });

  refreshProcessTable();
  resetSimulation();
}

function removeProcess(index) {
  if (state.processes.length <= 1) return;
  state.processes.splice(index, 1);
  refreshProcessTable();
  resetSimulation();
}

function editProcess(index, field, value, inputEl) {
  clearInputError(inputEl);

  if (isNaN(value)) {
    showInputError(inputEl, 'Must be an integer.');
    return;
  }

  if (field === 'arrivalTime' && (value < 0 || !Number.isInteger(value))) {
    showInputError(inputEl, 'Min: 0, integer.');
    return;
  }
  if (field === 'burstTime' && (value < 1 || !Number.isInteger(value))) {
    showInputError(inputEl, 'Min: 1, integer.');
    return;
  }
  if (field === 'priority' && !Number.isInteger(value)) {
    showInputError(inputEl, 'Must be an integer.');
    return;
  }

  state.processes[index][field] = value;
  resetSimulation();
}

function refreshProcessTable() {
  renderProcessTable(els.processTableBody, state.processes, editProcess, removeProcess);
  validateAndUpdateUI();
}

// ─── Validation ───────────────────────────────────────────────────

function validateAndUpdateUI() {
  const result = validateProcessList(state.processes);
  const errors = [...result.errors];

  if (state.selectedAlgorithm === 'rr') {
    const qResult = validateQuantum(state.quantum);
    if (!qResult.valid) errors.push(qResult.error);
  }

  showValidationMessage(els.validationMsg, errors);

  const isValid = errors.length === 0;
  els.runBtn.disabled = !isValid;
  els.compareBtn.disabled = !isValid;

  return isValid;
}

// ─── Algorithm Selection ──────────────────────────────────────────

function onAlgorithmChange(e) {
  state.selectedAlgorithm = e.target.value;
  updateQuantumVisibility();
  resetSimulation();
}

function updateQuantumVisibility() {
  els.quantumGroup.style.display = state.selectedAlgorithm === 'rr' ? 'flex' : 'none';
}

function onQuantumChange(e) {
  const val = parseInt(e.target.value, 10);
  if (isNaN(val) || val < 1) {
    showInputError(e.target, 'Min: 1, integer.');
    return;
  }
  clearInputError(e.target);
  state.quantum = val;
  resetSimulation();
}

// ─── Speed Control ────────────────────────────────────────────────

function onSpeedChange(e) {
  state.animationSpeed = parseFloat(e.target.value);
  updateSpeedDisplay(els.speedDisplay, state.animationSpeed);
}

// ─── Simulation ───────────────────────────────────────────────────

function runSimulation() {
  if (!validateAndUpdateUI()) return;

  stopAnimation();

  const algMap = {
    fcfs: () => fcfs(state.processes),
    sjf: () => sjf(state.processes),
    srtf: () => srtf(state.processes),
    rr: () => roundRobin(state.processes, state.quantum),
    priority: () => priority(state.processes)
  };

  const runner = algMap[state.selectedAlgorithm];
  if (!runner) return;

  state.currentResult = runner();
  state.animationGeneration++;
  state.animationIndex = -1;

  renderGanttChart(els.ganttContainer, state.currentResult.timeline, state.currentResult.totalTime);
  renderResultsTable(els.resultsTableBody, state.currentResult.processes, state.currentResult.metrics);
  renderMetricPanels(els.metricPanels, state.currentResult.metrics);
  renderReadyQueueEmpty(els.readyQueueContainer);

  els.ganttSection.style.display = 'block';
  els.resultsSection.style.display = 'block';
}

function resetSimulation() {
  stopAnimation();
  state.currentResult = null;
  state.animationIndex = -1;
  state.animationGeneration++;

  els.ganttContainer.innerHTML = '';
  els.resultsTableBody.innerHTML = '';
  els.metricPanels.innerHTML = '';
  renderReadyQueueEmpty(els.readyQueueContainer);
  clearGanttHighlights(els.ganttContainer);

  els.ganttSection.style.display = 'none';
  els.resultsSection.style.display = 'none';
  els.comparisonSection.style.display = 'none';

  validateAndUpdateUI();
}

// ─── Animation ────────────────────────────────────────────────────

function animationPlay() {
  if (!state.currentResult) return;
  if (state.animationPlaying) return;
  if (state.animationIndex >= state.currentResult.timeline.length - 1) return;

  state.animationPlaying = true;
  scheduleNextFrame();
}

function animationPause() {
  state.animationPlaying = false;
  if (state.animationTimerId !== null) {
    clearTimeout(state.animationTimerId);
    state.animationTimerId = null;
  }
}

function animationStep() {
  if (!state.currentResult) return;
  animationPause();

  if (state.animationIndex < state.currentResult.timeline.length - 1) {
    state.animationIndex++;
    renderAnimationFrame();
  }
}

function animationReset() {
  stopAnimation();
  if (!state.currentResult) return;

  state.animationIndex = -1;
  clearGanttHighlights(els.ganttContainer);
  renderReadyQueueEmpty(els.readyQueueContainer);
}

function stopAnimation() {
  state.animationPlaying = false;
  if (state.animationTimerId !== null) {
    clearTimeout(state.animationTimerId);
    state.animationTimerId = null;
  }
}

function scheduleNextFrame() {
  if (!state.animationPlaying || !state.currentResult) return;

  const gen = state.animationGeneration;
  const seg = state.currentResult.timeline[state.animationIndex + 1];
  if (!seg) {
    state.animationPlaying = false;
    return;
  }

  const duration = seg.end - seg.start;
  const delay = (duration * 500) / state.animationSpeed; // base: 500ms per unit

  state.animationTimerId = setTimeout(() => {
    // Check generation to avoid stale callbacks
    if (gen !== state.animationGeneration) return;
    if (!state.animationPlaying) return;

    state.animationIndex++;
    renderAnimationFrame();

    if (state.animationIndex < state.currentResult.timeline.length - 1) {
      scheduleNextFrame();
    } else {
      state.animationPlaying = false;
    }
  }, delay);
}

function renderAnimationFrame() {
  if (!state.currentResult) return;
  const idx = state.animationIndex;

  highlightGanttSegment(els.ganttContainer, idx);

  // Show ready queue snapshot
  if (state.currentResult.snapshots && state.currentResult.snapshots[idx]) {
    renderReadyQueue(els.readyQueueContainer, state.currentResult.snapshots[idx]);
  }
}

// ─── Compare All ──────────────────────────────────────────────────

function runCompareAll() {
  if (!validateAndUpdateUI()) return;

  const results = compareAll(state.processes, state.quantum);
  renderComparisonTable(els.comparisonTableBody, results);
  renderComparisonChart(els.comparisonChartContainer, results);

  els.comparisonSection.style.display = 'block';
}

// ─── Start ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

