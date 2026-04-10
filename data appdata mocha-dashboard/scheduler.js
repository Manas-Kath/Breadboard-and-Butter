const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

const BROKER_URL = "mqtt://100.125.241.104:1883"; 
const DB_FILE = path.join(__dirname, 'routines.json');
const MEMO_FILE = path.join(__dirname, 'memos.json');
const client = mqtt.connect(BROKER_URL);

let routines = [];
let memos = [];

function loadData() {
    console.log("[INIT] Loading Database...");
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            routines = JSON.parse(data || "[]");
        } else {
            fs.writeFileSync(DB_FILE, "[]");
            routines = [];
        }
        
        if (fs.existsSync(MEMO_FILE)) {
            const data = fs.readFileSync(MEMO_FILE, 'utf8');
            memos = JSON.parse(data || "[]");
        } else {
            fs.writeFileSync(MEMO_FILE, "[]");
            memos = [];
        }
        console.log(`[INIT] Loaded ${routines.length} routines and ${memos.length} memos.`);
    } catch (e) { 
        console.error("[ERROR] Load Error:", e.message); 
        routines = []; memos = [];
    }
}
loadData();

function save() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(routines, null, 2));
        fs.writeFileSync(MEMO_FILE, JSON.stringify(memos, null, 2));
        client.publish("room/routine/list", JSON.stringify(routines), { retain: true });
        client.publish("room/memo/list", JSON.stringify(memos), { retain: true });
        console.log(`[SYNC] Data saved. Routines: ${routines.length}, Memos: ${memos.length}`);
    } catch (e) { console.error("[ERROR] Save Error:", e); }
}

let lastLog = 0;
setInterval(() => {
    const now = new Date();
    const day = now.getDay();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    // Heartbeat every 30 seconds
    if (Date.now() - lastLog > 30000) {
        console.log(`[HEARTBEAT] Time: ${timeStr}, Active Routines: ${routines.length}`);
        lastLog = Date.now();
    }

    let changed = false;
    // Iterate backwards to safely splice
    for (let i = routines.length - 1; i >= 0; i--) {
        const r = routines[i];
        if (r.type === 'timer') {
            const remaining = Math.round((r.triggerAt - Date.now()) / 1000);
            if (Date.now() >= r.triggerAt) {
                console.log(`[TRIGGER] Timer Expired: ${r.target} -> ${r.action}`);
                client.publish(r.target, r.action);
                client.publish("room/notify", `Timer triggered: ${r.action}`);
                routines.splice(i, 1);
                changed = true;
            }
        } else if (r.type === 'schedule') {
            if (r.time === timeStr && r.days.includes(day) && !r.lastRun) {
                console.log(`[TRIGGER] Schedule Hit (${timeStr}): ${r.target} -> ${r.action}`);
                client.publish(r.target, r.action);
                client.publish("room/notify", `Schedule triggered: ${r.action}`);
                r.lastRun = true;
                changed = true;
            } else if (r.time !== timeStr && r.lastRun) {
                console.log(`[RESET] Schedule reset for next run: ${r.label}`);
                r.lastRun = false; 
                changed = true;
            }
        }
    }
    if (changed) save();
}, 1000);

client.on('connect', () => {
    console.log("Nurpur Pro Scheduler Connected to MQTT Broker");
    client.subscribe(["room/routine/cmd", "room/dashboard/memo", "room/memo/cmd"]);
    save();
});

client.on('message', (topic, message) => {
    const payload = message.toString();
    console.log(`[MQTT MSG] ${topic}: ${payload}`);

    try {
        if (topic === "room/dashboard/memo") {
            memos.push({ id: Date.now().toString(), text: payload });
            save();
        } else if (topic === "room/memo/cmd") {
            const cmd = JSON.parse(payload);
            if (cmd.op === 'delete') {
                memos = memos.filter(m => m.id !== cmd.id);
                save();
            }
        } else if (topic === "room/routine/cmd") {
            const cmd = JSON.parse(payload);
            if (cmd.op === 'timer') {
                routines.push({
                    id: Date.now().toString(),
                    type: 'timer',
                    target: cmd.target,
                    action: cmd.action,
                    triggerAt: Date.now() + (cmd.minutes * 60000),
                    label: cmd.label || `Timer`
                });
            } else if (cmd.op === 'schedule') {
                routines.push({
                    id: Date.now().toString(),
                    type: 'schedule',
                    target: cmd.target,
                    action: cmd.action,
                    time: cmd.time,
                    days: cmd.days || [0,1,2,3,4,5,6],
                    label: cmd.label || "Daily"
                });
            } else if (cmd.op === 'delete') {
                routines = routines.filter(r => r.id !== cmd.id);
            }
            save();
        }
    } catch (e) { console.error("Process Error:", e); }
});
