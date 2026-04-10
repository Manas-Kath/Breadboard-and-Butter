const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BROKER_URL = "mqtt://100.125.241.104:1883"; 
const DB_FILE = path.join(__dirname, 'routines.json');
const MEMO_FILE = path.join(__dirname, 'memos.json');

const SPOTIFY = {
    clientId: '39b4e02aa1aa4742811e08051f91f20c',
    clientSecret: '7b2b3f45a6a3482091683b9439939eea',
    refreshToken: 'AQAJ3_Y71bV3PtebmsYyV7POaqEAbENppTzpPTB4VBy2PzhbWSc2TvzQYXaoH1RLyQ7j-sS2x5h2llu5rwRZdfQLjmgkv9cF6JgzvBXrgizwrEUcFwC9prxm_U00WugpQdk',
    accessToken: '',
    lastTrackId: '',
    lastTempo: 0,
    lastTrackPayload: ''
};

const client = mqtt.connect(BROKER_URL);
let routines = [];
let memos = [];

async function refreshSpotifyToken() {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', SPOTIFY.refreshToken);
        const auth = Buffer.from(`${SPOTIFY.clientId}:${SPOTIFY.clientSecret}`).toString('base64');
        const res = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        SPOTIFY.accessToken = res.data.access_token;
        console.log("[SPOTIFY] Token Refreshed");
    } catch (e) { console.error("[SPOTIFY] Auth Error"); }
}

async function getTrackTempo(trackId) {
    if (!SPOTIFY.accessToken || !trackId) return 0;
    try {
        const res = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: { 'Authorization': `Bearer ${SPOTIFY.accessToken}` }
        });
        if (res.data && res.data.tempo) {
            return res.data.tempo;
        }
        return 120; // Fallback if track has no features
    } catch (e) {
        console.error(`[SPOTIFY] Tempo Fetch Failed for ${trackId}:`, e.response?.status || e.message);
        return 0; // Trigger retry on next poll
    }
}

async function updateSpotifyMetadata() {
    if (!SPOTIFY.accessToken) return;
    try {
        const res = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${SPOTIFY.accessToken}` }
        });

        if (res.status === 200 && res.data && res.data.item) {
            const track = res.data.item;
            
            if (track.id !== SPOTIFY.lastTrackId || SPOTIFY.lastTempo === 0) {
                const newTempo = await getTrackTempo(track.id);
                if (newTempo > 0) {
                    SPOTIFY.lastTempo = newTempo;
                    SPOTIFY.lastTrackId = track.id;
                    console.log(`[SPOTIFY] Sync: ${track.name} @ ${SPOTIFY.lastTempo} BPM`);
                }
            }

            const status = {
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                albumArt: track.album.images[0]?.url,
                isPlaying: res.data.is_playing,
                progress: res.data.progress_ms,
                duration: track.duration_ms,
                tempo: SPOTIFY.lastTempo || 120,
                timestamp: Date.now()
            };

            const payload = JSON.stringify(status);
            if (payload !== SPOTIFY.lastTrackPayload) {
                client.publish("room/media/status", payload, { retain: true });
                SPOTIFY.lastTrackPayload = payload;
            }
        } else {
            const status = { isPlaying: false, title: "", artist: "", tempo: 120, timestamp: Date.now() };
            const payload = JSON.stringify(status);
            if (payload !== SPOTIFY.lastTrackPayload) {
                client.publish("room/media/status", payload, { retain: true });
                SPOTIFY.lastTrackPayload = payload;
                SPOTIFY.lastTrackId = '';
                SPOTIFY.lastTempo = 0;
            }
        }
    } catch (e) {
        if (e.response?.status === 401) await refreshSpotifyToken();
        else console.error("[SPOTIFY] Poll Error");
    }
}

async function spotifyCmd(cmd) {
    if (!SPOTIFY.accessToken) await refreshSpotifyToken();
    const headers = { 'Authorization': `Bearer ${SPOTIFY.accessToken}` };
    try {
        if (cmd === 'NEXT') await axios.post('https://api.spotify.com/v1/me/player/next', {}, { headers });
        else if (cmd === 'PREV') await axios.post('https://api.spotify.com/v1/me/player/previous', {}, { headers });
        else if (cmd === 'TOGGLE') {
            await axios.put('https://api.spotify.com/v1/me/player/pause', {}, { headers })
                .catch(() => axios.put('https://api.spotify.com/v1/me/player/play', {}, { headers }));
        }
        setTimeout(updateSpotifyMetadata, 500);
    } catch (e) { console.error("[SPOTIFY] Cmd Error:", cmd); }
}

setInterval(updateSpotifyMetadata, 3000);
refreshSpotifyToken();

function loadData() {
    try {
        if (fs.existsSync(DB_FILE)) routines = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || "[]");
        if (fs.existsSync(MEMO_FILE)) memos = JSON.parse(fs.readFileSync(MEMO_FILE, 'utf8') || "[]");
    } catch (e) {}
}
loadData();

function save() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(routines, null, 2));
        fs.writeFileSync(MEMO_FILE, JSON.stringify(memos, null, 2));
        client.publish("room/routine/list", JSON.stringify(routines), { retain: true });
        client.publish("room/memo/list", JSON.stringify(memos), { retain: true });
    } catch (e) {}
}

setInterval(() => {
    const now = new Date();
    const day = now.getDay();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    let changed = false;
    for (let i = routines.length - 1; i >= 0; i--) {
        const r = routines[i];
        if (r.type === 'timer' && Date.now() >= r.triggerAt) {
            client.publish(r.target, r.action);
            routines.splice(i, 1); changed = true;
        } else if (r.type === 'schedule') {
            if (r.time === timeStr && r.days.includes(day) && !r.lastRun) {
                client.publish(r.target, r.action);
                r.lastRun = true; changed = true;
            } else if (r.time !== timeStr && r.lastRun) {
                r.lastRun = false; changed = true;
            }
        }
    }
    if (changed) save();
}, 1000);

client.on('connect', () => {
    client.subscribe(["room/routine/cmd", "room/dashboard/memo", "room/memo/cmd", "room/media/command"]);
    save();
});

client.on('message', (topic, message) => {
    const payload = message.toString();
    try {
        if (topic === "room/media/command") spotifyCmd(payload);
        else if (topic === "room/dashboard/memo") { memos.push({ id: Date.now().toString(), text: payload }); save(); }
        else if (topic === "room/memo/cmd") {
            const cmd = JSON.parse(payload);
            if (cmd.op === 'delete') { memos = memos.filter(m => m.id !== cmd.id); save(); }
        } else if (topic === "room/routine/cmd") {
            const cmd = JSON.parse(payload);
            if (cmd.op === 'timer') {
                routines.push({ id: Date.now().toString(), type: 'timer', target: cmd.target, action: cmd.action, triggerAt: Date.now() + (cmd.minutes * 60000) });
            } else if (cmd.op === 'schedule') {
                routines.push({ id: Date.now().toString(), type: 'schedule', target: cmd.target, action: cmd.action, time: cmd.time, days: cmd.days || [0,1,2,3,4,5,6] });
            } else if (cmd.op === 'delete') routines = routines.filter(r => r.id !== cmd.id);
            save();
        }
    } catch (e) {}
});
