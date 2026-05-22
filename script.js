const isAdminPage = window.location.pathname.toLowerCase().includes("admin.html");

if (isAdminPage) {
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        const login = prompt("StepFree Admin-Bereich\nBitte Passwort eingeben:");
        if (btoa(login) === "ZldpUyE=") { 
            sessionStorage.setItem('isLoggedIn', 'true');
        } else {
            alert("Zugriff verweigert!");
            window.location.href = "index.html"; 
        }
    }
}

const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb"; 
const BASKET_NAME = "freeway_stuttgart"; 
const PANTRY_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;

let map, myLocationMarker, reportsData = [], activeMarkers = {};

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    map = L.map('map', { fadeAnimation: false }).setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    map.on('click', e => openSelectionPopup(e.latlng));
    map.on('moveend', () => drawMarkersOnMap());
    map.on('zoomend', () => drawMarkersOnMap());
    setupLocationTracking();
    updateStatus("Lade Daten...", "#3498db");
    try {
        await loadFromCommunity();
        updateStatus("Community Live ✅", "#27AE60");
    } catch (e) {
        updateStatus("Offline-Modus ⚠️", "#E67E22");
    }
    setTimeout(() => {
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
            }, 800);
        }
    }, 1000);
}

function setupLocationTracking() {
    const icon = L.divIcon({
        html: `<div style="background:#3498db; width:12px; height:12px; border-radius:50%; border:3px solid white;"></div>`,
        className: '', iconSize: [18, 18]
    });
    map.locate({watch: true, enableHighAccuracy: true});
    map.on('locationfound', e => {
        if (myLocationMarker) myLocationMarker.setLatLng(e.latlng);
        else {
            myLocationMarker = L.marker(e.latlng, {icon}).addTo(map);
            map.setView(e.latlng, 16);
        }
    });
}

async function loadFromCommunity() {
    const response = await fetch(PANTRY_URL + "?t=" + Date.now());
    if (response.ok) {
        const result = await response.json();
        reportsData = result.markers || [];
        drawMarkersOnMap();
    }
}

function saveToCommunity() {
    updateStatus("Speichere...", "#f39c12");
    fetch(PANTRY_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ markers: reportsData })
    })
    .then(() => updateStatus("Community Live ✅", "#27AE60"))
    .catch(() => updateStatus("Sync-Fehler ❌", "#e74c3c"));
}

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if(s) { s.innerHTML = text; s.style.background = color; }
}

function drawMarkersOnMap() {
    if (!map) return;
    const bounds = map.getBounds();
    Object.keys(activeMarkers).forEach(id => {
        const m = activeMarkers[id];
        if (!bounds.contains(m.getLatLng())) {
            map.removeLayer(m);
            delete activeMarkers[id];
        }
    });
    reportsData.forEach((r) => {
        const pos = L.latLng(r.lat, r.lng);
        if (bounds.contains(pos) && !activeMarkers[r.id]) {
            let emoji = "📍";
            if (r.typ.includes("Treppe")) emoji = "🪜";
            if (r.typ.includes("defekt") || r.typ.includes("Aufzug")) emoji = "🛗";
            if (r.typ.includes("WC")) emoji = "🚽";
            if (r.typ.includes("Parkplatz")) emoji = "🅿️";
            if (r.typ.includes("Baustelle")) emoji = "🚧";
            let adminStyle = "";
            if (isAdminPage) {
                if (r.votes <= -3 || r.status === "review") {
                    adminStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;"; 
                } else if (r.status === "new") {
                    adminStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; 
                }
            }
            const icon = L.divIcon({
                html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${adminStyle}">${emoji}</div>`,
                className: '', iconSize: [30, 30]
            });
            const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
            const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
            let popup = `<div style="font-family:sans-serif; min-width:200px;">
                <b>${r.typ}</b><br><p>${r.kommentar}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px;">Vertrauen: ${r.votes || 0}</div>
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">✅</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">❌</button>
                </div>
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer;">🗺️ Navigation</button>
                </a>`;
            if (isAdminPage) {
                popup += `<button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; margin-top:5px; cursor:pointer;">🗑️ Löschen</button>`;
                if (r.status === "new") { m.on('click', () => adminReviewDone(r.id)); }
            }
            m.bindPopup(popup + `</div>`);
            activeMarkers[r.id] = m;
        }
    }); 
}

function openSelectionPopup(latlng) {
  const content = `<div style="width: 250px; font-family: sans-serif; padding: 10px;">
      <b style="display: block; text-align: center; margin-bottom: 10px;">Eintrag hinzufügen</b>
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🪜 Treppe</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🛗 Aufzug defekt</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:10px; border-radius:5px; cursor:pointer;">🚧 Baustelle</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🛗 Aufzug vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🚽 WC</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🅿️ Parkplatz</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">📍 Ort</button>
      </div>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

function finalizeReport(lat, lng, typ, farbe) {
    const details = prompt(`Zusatzinfos:`, "");
    const newId = "id_" + Date.now();
    reportsData.push({ lat, lng, typ, farbe, kommentar: details || "", id: newId, votes: 0, status: "new" });
    drawMarkersOnMap();
    map.closePopup();
    saveToCommunity();
}

function directDelete(id) {
    if (confirm("Löschen?")) { 
        reportsData = reportsData.filter(r => r.id !== id); 
        if (activeMarkers[id]) { map.removeLayer(activeMarkers[id]); delete activeMarkers[id]; }
        drawMarkersOnMap();
        saveToCommunity();
    }
}

function vote(id, change) {
    let myVotes = JSON.parse(localStorage.getItem('userVotes') || "{}");
    if (myVotes[id]) { alert("Bereits abgestimmt!"); return; }
    const report = reportsData.find(r => r.id === id);
    if (!report) return;
    report.votes = (report.votes || 0) + change;
    myVotes[id] = true;
    localStorage.setItem('userVotes', JSON.stringify(myVotes));
    if (report.votes <= -3) report.status = "review";
    saveToCommunity();
    map.closePopup();
    setTimeout(() => {
        Object.keys(activeMarkers).forEach(key => { map.removeLayer(activeMarkers[key]); });
        activeMarkers = {};
        drawMarkersOnMap();
    }, 300);
}

function adminReviewDone(id) {
    const r = reportsData.find(item => item.id === id);
    if (r && r.status === "new") {
        r.status = "active";
        drawMarkersOnMap();
        saveToCommunity();
    }
}

window.onload = initApp;