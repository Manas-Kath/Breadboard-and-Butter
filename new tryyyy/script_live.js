/* ================================================================
   EcoWatt Connect — script_live.js (Strict Live Mode)
================================================================ */

// ─── MQTT CONFIGURATION ────────────────────────────────────────

var mqttConfig = {
  host: localStorage.getItem('mq_h') || "100.125.241.104",
  port: parseInt(localStorage.getItem('mq_p')) || 9001
};

var isMqttConnected = false;
var lastMqttUpdate = 0;
var targetKW = 0;
var currentKW = 0;
var MAX_KW = 5;
var FULL_ARC = 251;

var ROOMS = [
  { label: 'Living',  kwh: 0 },
  { label: 'Kitchen', kwh: 0 },
  { label: 'Master',  kwh: 0 },
  { label: 'Office',  kwh: 0 },
  { label: 'Laundry', kwh: 0 },
  { label: 'Garage',  kwh: 0 },
];

// Mapped to room/switch/relay_1 to relay_5
var CONSUMERS = [
  { name: 'Charger', topic: 'room/switch/relay_1', icon: 'geyser', active: false },
  { name: 'Lamp',    topic: 'room/switch/relay_2', icon: 'ac',     active: false },
  { name: 'Outlet',  topic: 'room/switch/relay_3', icon: 'washer', active: false },
  { name: 'Fan',     topic: 'room/switch/relay_4', icon: 'fridge', active: false },
  { name: 'Work',    topic: 'room/switch/relay_5', icon: 'tv',     active: false },
];

let alertData = [];

// ─── MQTT CLIENT ───────────────────────────────────────────────

var mqttClient = new Paho.MQTT.Client(mqttConfig.host, mqttConfig.port, "EcoWattLive_" + Math.random().toString(16).slice(2, 6));

function onMqttConnect() {
  console.log("MQTT Live Connected");
  isMqttConnected = true;
  mqttClient.subscribe("room/stats/#");
  mqttClient.subscribe("room/notify");
  mqttClient.subscribe("room/db/status");
  mqttClient.subscribe("room/hub/status");
  mqttClient.subscribe("room/switch/+/state");
  
  const b = document.getElementById('brokerStatus');
  if(b) {
    b.innerText = "BROKER: ONLINE";
    b.style.background = "rgba(0,255,0,0.1)";
    b.style.color = "#00ff00";
    b.style.border = "1px solid #00ff00";
  }
}

function onMqttLost(res) {
  isMqttConnected = false;
  const b = document.getElementById('brokerStatus');
  if(b) {
    b.innerText = "BROKER: OFFLINE";
    b.style.background = "rgba(255,0,0,0.1)";
    b.style.color = "#ff4444";
    b.style.border = "1px solid #ff4444";
  }
  setTimeout(() => mqttClient.connect({ onSuccess: onMqttConnect, useSSL: false }), 5000);
}

function onMqttMessage(m) {
  const topic = m.destinationName;
  const payload = m.payloadString;
  lastMqttUpdate = Date.now();

  // Handle Relay States
  if (topic.includes("switch/relay_")) {
    const parts = topic.split('/');
    const relayPart = parts.find(p => p.startsWith('relay_'));
    if (relayPart) {
        const relayNum = parseInt(relayPart.split('_')[1]);
        const device = CONSUMERS[relayNum - 1];
        if (device) {
          device.active = (payload === "ON");
          buildConsumers();
        }
    }
  }

  if (topic === "room/db/status") {
    const d = document.getElementById('dbStatus');
    if(d) {
      d.innerText = "DB: " + payload.toUpperCase();
      d.style.background = (payload === "online") ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)";
      d.style.color = (payload === "online") ? "#00ff00" : "#ff4444";
      d.style.border = (payload === "online") ? "1px solid #00ff00" : "1px solid #ff4444";
    }
  }

  if (topic === "room/stats/total_power") {
    targetKW = parseFloat(payload);
  } else if (topic === "room/stats/rooms") {
    try {
      const data = JSON.parse(payload);
      for(let i=0; i<6; i++) {
        if(data["room"+(i+1)] !== undefined) ROOMS[i].kwh = (data["room"+(i+1)] * 230 / 1000); // Approximation
      }
      buildBarChart();
    } catch(e) {}
  } else if (topic === "room/stats/alert" || topic === "room/notify") {
    alertData.unshift({ type: 'warn', title: 'Update', msg: payload, time: 'just now' });
    if(alertData.length > 8) alertData.pop();
    buildAlerts();
  }
}

mqttClient.onConnectionLost = onMqttLost;
mqttClient.onMessageArrived = onMqttMessage;
mqttClient.connect({ onSuccess: onMqttConnect, useSSL: false });

// ─── UI UPDATER ────────────────────────────────────────────────

function updateGauge(kw) {
  const arc = document.getElementById('gaugeArc');
  const valEl = document.getElementById('gaugeValue');
  const pctEl = document.getElementById('usagePercent');
  const fillEl = document.getElementById('usageBarFill');

  if (arc) {
    const pct = Math.min(Math.max(kw / MAX_KW, 0), 1);
    arc.style.strokeDashoffset = FULL_ARC - pct * FULL_ARC;
  }
  if (valEl) valEl.textContent = kw.toFixed(2);
  
  const pctRound = Math.round((kw / MAX_KW) * 100);
  if (pctEl) pctEl.textContent = pctRound + '%';
  if (fillEl) fillEl.style.width = pctRound + '%';
}

function fastLoop() {
  const statusPill = document.querySelector('.status-pill');
  const gaugeVal = document.getElementById('gaugeValue');

  if (!isMqttConnected) {
    if (statusPill) {
      statusPill.className = 'status-pill';
      statusPill.innerHTML = '<span class="dot" style="background: #ff4444"></span> BROKER DISCONNECTED';
    }
    if (gaugeVal) gaugeVal.textContent = "ERR";
    return;
  } else {
    if (statusPill) {
      statusPill.className = 'status-pill active';
      statusPill.innerHTML = '<span class="dot"></span> LIVE HARDWARE';
    }
  }

  currentKW += (targetKW - currentKW) * 0.2;
  updateGauge(currentKW);

  if (lastMqttUpdate !== 0 && Date.now() - lastMqttUpdate > 15000) {
    if (gaugeVal) gaugeVal.textContent = "STALE";
  }
}
setInterval(fastLoop, 50);

// ─── PANEL SWITCHING ───────────────────────────────────────────

function showPanel(label) {
  const top = document.querySelector('.top-row');
  const mid = document.querySelector('.mid-row');
  const bot = document.querySelector('.bot-row');

  if (label === 'dashboard') {
    top.style.display = 'flex';
    mid.style.display = 'flex';
    bot.style.display = 'flex';
  } else if (label === 'analytics' || label === 'rooms') {
    top.style.display = 'none';
    mid.style.display = 'flex';
    bot.style.display = 'none';
  } else if (label === 'devices') {
    top.style.display = 'none';
    mid.style.display = 'none';
    bot.style.display = 'flex';
  } else {
    top.style.display = 'none';
    mid.style.display = 'none';
    bot.style.display = 'none';
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    const label = item.querySelector('span').innerText.toLowerCase();
    showPanel(label);

    if (window.innerWidth <= 840) {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('show');
    }
  });
});

// ─── BAR CHART ──────────────────────────────────────────────────

function buildBarChart() {
  const container = document.getElementById('barChart');
  if (!container) return;
  container.innerHTML = '';
  const max = Math.max(...ROOMS.map(r => r.kwh)) || 1;

  ROOMS.forEach(room => {
    const pct = (room.kwh / max) * 100;
    const group = document.createElement('div');
    group.className = 'bar-group';
    group.innerHTML = `<div class="bar-val">${room.kwh.toFixed(2)}</div><div class="bar" style="height:${pct}%"></div><div class="bar-label">${room.label}</div>`;
    container.appendChild(group);
  });
}

// ─── CONSUMERS LIST (CONTROL) ───────────────────────────────────

function deviceIconSVG(type) {
  const icons = {
    geyser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 8v4l3 3"/></svg>`,
    ac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 11h12M6 14h4"/></svg>`,
    washer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><circle cx="7" cy="7" r="1" fill="currentColor"/></svg>`,
    fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="10" y1="6" x2="10" y2="8"/><line x1="10" y1="14" x2="10" y2="18"/></svg>`,
    tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  };
  return icons[type] || icons.tv;
}

function toggleDevice(index) {
  const device = CONSUMERS[index];
  const newVal = device.active ? "OFF" : "ON";
  const message = new Paho.MQTT.Message(newVal);
  message.destinationName = device.topic + "/command";
  mqttClient.send(message);
}

function buildConsumers() {
  const container = document.getElementById('consumersList');
  if (!container) return;
  container.innerHTML = '';

  CONSUMERS.forEach((c, idx) => {
    const item = document.createElement('div');
    item.className = 'consumer-item' + (c.active ? ' active-device' : '');
    item.style.cursor = 'pointer';
    item.onclick = () => toggleDevice(idx);

    item.innerHTML = `
      <div class="consumer-icon" style="color: ${c.active ? 'var(--orange)' : '#555'}">${deviceIconSVG(c.icon)}</div>
      <div class="consumer-info">
        <div class="consumer-name">${c.name}</div>
        <div class="consumer-status" style="font-size: 0.8rem; color: ${c.active ? '#00ff00' : '#888'}">
          ${c.active ? 'ACTIVE' : 'OFFLINE'}
        </div>
      </div>
      <div class="toggle-indicator" style="width: 12px; height: 12px; border-radius: 50%; background: ${c.active ? '#00ff00' : '#333'}"></div>
    `;
    container.appendChild(item);
  });
}

// ─── ALERTS ─────────────────────────────────────────────────────

function buildAlerts() {
  const container = document.getElementById('alertsList');
  if (!container) return;
  container.innerHTML = alertData.length ? "" : '<div class="no-alerts">No active alerts ✓</div>';
  alertData.forEach(a => {
    const item = document.createElement('div');
    item.className = `alert-item ${a.type}`;
    item.innerHTML = `<div class="alert-dot ${a.type}"></div><div class="alert-msg"><strong>${a.title}.</strong> ${a.msg}</div><div class="alert-time">${a.time}</div>`;
    container.appendChild(item);
  });
  document.getElementById('alertCount').textContent = alertData.length;
}

// ─── INITIALIZATION ─────────────────────────────────────────────

function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) el.textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);

const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const overlay = document.getElementById('overlay');

hamburger?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });

buildBarChart();
buildAlerts();
buildConsumers();
