const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    const login = prompt("Willkommen im StepFree Admin-Bereich\nBitte Passwort eingeben:");
    if (btoa(login) !== "ZldpUyE=") {
        alert("Zugriff verweigert.");
        window.location.href = "index.html";
    }
}

const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb";
let isSyncing = false;

// VERFEINERTES RASTER: Jetzt ca. 1,1km Quadrate statt 111km
function getBasketUrl(lat, lng) {
    const gridLat = (Math.floor(lat * 100) / 100).toFixed(2);
    const gridLng = (Math.floor(lng * 100) / 100).toFixed(2);
    return `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/grid_${gridLat}_${gridLng}`;
}

let map, myLocationMarker, reportsData = [],
    activeMarkers = {};

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if (s) {
        s.innerHTML = text;
        s.style.background = color;
        s.style.display = 'block';
    }
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    map = L.map('map', { fadeAnimation: false }).setView([48.775, 9.182], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));
    setupLocationTracking();
    
    let loadTimeout;
    map.on('moveend', function() {
        if (isSyncing) return;
        updateStatus("Synchronisiere...", "#3498db");
        clearTimeout(loadTimeout);
        loadTimeout = setTimeout(() => {
            loadFromCommunity();
        }, 400);
    });
    
    loadFromCommunity();
    
    setTimeout(() => {
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
            }, 600);
        }
    }, 1200);
}

function setupLocationTracking() {
    const locationIcon = L.divIcon({
        html: `<div style="background:#3498db; width:12px; height:12px; border-radius:50%; border:3px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        className: '',
        iconSize: [18, 18]
    });
    map.locate({ watch: true, enableHighAccuracy: true });
    map.on('locationfound', e => {
        if (myLocationMarker) {
            myLocationMarker.setLatLng(e.latlng);
        } else {
            myLocationMarker = L.marker(e.latlng, { icon: locationIcon }).addTo(map);
            myLocationMarker.bindPopup("Sie befinden sich hier");
            map.setView(e.latlng, 16);
        }
    });
}

async function loadFromCommunity() {
    if (isSyncing) return;
    const center = map.getCenter();
    const url = getBasketUrl(center.lat, center.lng);
    try {
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            if (!isSyncing) {
                reportsData = result.markers || [];
                drawMarkersOnMap();
                updateStatus("Community Live ✅", "#27AE60");
            }
        } else {
            // Falls das Raster noch nicht existiert
            reportsData = [];
            drawMarkersOnMap();
            updateStatus("Region bereit ✅", "#27AE60");
        }
    } catch (err) {
        updateStatus("Verbindung prüfen", "#E67E22");
    }
}

async function saveToCommunity(markerToUpdate = null) {
    isSyncing = true;
    const ref = markerToUpdate || (reportsData.length > 0 ? reportsData[0] : map.getCenter());
    const targetUrl = getBasketUrl(ref.lat, ref.lng);
    updateStatus("Sichere Daten...", "#f39c12");
    
    try {
        await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markers: reportsData })
        });
        updateStatus("Community Live ✅", "#27AE60");
    } catch (err) {
        updateStatus("Sync-Fehler ❌", "#E74C3C");
    } finally {
        setTimeout(() => { isSyncing = false; }, 1500);
    }
}

function drawMarkersOnMap() {
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};
    
    reportsData.forEach((r, index) => {
        let emoji = "📍";
        if (r.typ.includes("Treppe")) emoji = "🪜";
        if (r.typ.includes("defekt") || r.typ.includes("Aufzug")) emoji = "🛗";
        if (r.typ.includes("WC")) emoji = "🚽";
        if (r.typ.includes("Parkplatz")) emoji = "🅿️";
        if (r.typ.includes("Baustelle")) emoji = "🚧";
        
        const icon = L.divIcon({
            html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white;">${emoji}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const m = L.marker([r.lat, r.lng], { icon }).addTo(map);
        
        // Google Maps Navigation URL Fix
        const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
        
        let popupContent = `<div style="font-family:sans-serif; min-width:200px;">
                <b style="font-size:1.1em;">${r.typ}</b><br>
                <p style="margin: 5px 0; color:#555;">${r.kommentar}</p>
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">✅</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">❌</button>
                </div>
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; margin-bottom:10px; cursor:pointer; font-weight:bold;">📍 Route planen</button>
                </a>`;
        
        if (isAdminPage) {
            popupContent += `<button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer;">🗑️ Löschen</button>`;
        }
        popupContent += `</div>`;
        m.bindPopup(popupContent);
        activeMarkers[index] = m;
    });
}

function openSelectionPopup(latlng) {
    const content = `
    <div style="width: 260px; font-family: sans-serif;">
      <b style="display: block; text-align: center; margin-bottom: 10px;">Neuer Eintrag</b>
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🪜 Treppe</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🛗 Aufzug defekt</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle / Sperrung', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:10px; border-radius:5px; cursor:pointer;">🚧 Baustelle / Sperrung</button>
        <hr style="margin:5px 0; border:0; border-top:1px solid #ccc;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🛗 Aufzug vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🚽 WC barrierefrei</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🅿️ Parkplatz</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">📍 Barrierefreier Ort</button>
      </div>
    </div>`;
    L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

async function finalizeReport(lat, lng, typ, farbe) {
    const details = prompt("Möchten Sie Details hinzufügen?", "");
    const newReport = { lat, lng, typ, farbe, kommentar: details || "", id: "id_" + Date.now(), votes: 0 };
    
    isSyncing = true;
    reportsData.push(newReport);
    drawMarkersOnMap();
    map.closePopup();
    
    const targetUrl = getBasketUrl(lat, lng);
    try {
        let regionData = { markers: [] };
        const response = await fetch(targetUrl);
        if (response.ok) {
            const result = await response.json();
            regionData.markers = result.markers || [];
        }
        regionData.markers.push(newReport);
        
        await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regionData)
        });
        updateStatus("Community Live ✅", "#27AE60");
    } catch (err) {
        updateStatus("Sync-Fehler ❌", "#E74C3C");
    } finally {
        setTimeout(() => { isSyncing = false; }, 1500);
    }
}

function directDelete(id) {
    if (confirm("Eintrag löschen?")) {
        isSyncing = true;
        const reportToDelete = reportsData.find(r => r.id === id);
        reportsData = reportsData.filter(r => r.id !== id);
        drawMarkersOnMap();
        saveToCommunity(reportToDelete);
    }
}

async function vote(id, change) {
    const report = reportsData.find(r => r.id === id);
    if (!report) return;
    let myVotes = JSON.parse(localStorage.getItem('userVotes') || "{}");
    if (myVotes[id]) return;
    report.votes += change;
    myVotes[id] = true;
    localStorage.setItem('userVotes', JSON.stringify(myVotes));
    saveToCommunity(report);
    drawMarkersOnMap();
}

window.onload = initApp;