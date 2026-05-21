const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    const login = prompt("Willkommen im StepFree Admin-Bereich\nBitte geben Sie Ihr Passwort ein:");
    if (btoa(login) !== "ZldpUyE=") {
        alert("Zugriff verweigert.");
        window.location.href = "index.html";
    }
}

const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb";

function getBasketUrl(lat, lng) {
    const gridLat = Math.floor(lat);
    const gridLng = Math.floor(lng);
    return `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/freeway_grid_${gridLat}_${gridLng}`;
}

let map, myLocationMarker, reportsData = [],
    activeMarkers = {};

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    map = L.map('map', { fadeAnimation: false }).setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));
    setupLocationTracking();
    
    let loadTimeout;
    map.on('moveend', function() {
        clearTimeout(loadTimeout);
        loadTimeout = setTimeout(() => {
            loadFromCommunity();
        }, 400);
    });
    
    try {
        await loadFromCommunity();
    } catch (e) {}
    
    if (splash) {
        splash.style.display = 'none';
        map.invalidateSize();
    }
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
    const center = map.getCenter();
    const url = getBasketUrl(center.lat, center.lng);
    try {
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            reportsData = result.markers || [];
            drawMarkersOnMap();
        }
    } catch (err) {}
}

async function saveToCommunity(markerToUpdate = null) {
    const ref = markerToUpdate || (reportsData.length > 0 ? reportsData[0] : map.getCenter());
    const targetUrl = getBasketUrl(ref.lat, ref.lng);
    try {
        await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markers: reportsData })
        });
    } catch (err) {}
}

function drawMarkersOnMap() {
    const isAdminPage = window.location.pathname.includes("admin.html");
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};
    
    reportsData.forEach((r, index) => {
        let emoji = "📍";
        if (r.typ.includes("Treppe")) emoji = "🪜";
        if (r.typ.includes("defekt") || r.typ.includes("Aufzug")) emoji = "🛗";
        if (r.typ.includes("WC")) emoji = "🚽";
        if (r.typ.includes("Parkplatz")) emoji = "🅿️";
        if (r.typ.includes("Baustelle")) emoji = "🚧";
        
        
        let adminStyle = "";
        if (isAdminPage) {
            if (r.votes <= -3) adminStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;";
            else if (r.status === "new") adminStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;";
        }
        
        const icon = L.divIcon({
            html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${adminStyle}">${emoji}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const m = L.marker([r.lat, r.lng], { icon }).addTo(map);
        
        const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
        
        let popupContent = `<div style="font-family:sans-serif; min-width:200px;">
                <b style="font-size:1.1em;">${r.typ}</b><br>
                <p style="margin: 5px 0; color:#555;">${r.kommentar}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Vertrauen: <b>${r.votes || 0}</b>
                </div>
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">✅</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">❌</button>
                </div>
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; margin-bottom:10px; cursor:pointer; font-weight:bold;">Route planen</button>
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
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle / Sperrung', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:10px; border-radius:5px; cursor:pointer;">🚧 Baustelle / Sperrung</button><br>
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
    const details = prompt("Weitere Details (optional):", "");
    const newReport = { lat, lng, typ, farbe, kommentar: details || "", id: "id_" + Date.now(), votes: 0, status: "new" };
    
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
        await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(regionData) });
    } catch (err) {}
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

function directDelete(id) {
    if (confirm("Eintrag entfernen?")) {
        const report = reportsData.find(r => r.id === id);
        reportsData = reportsData.filter(r => r.id !== id);
        saveToCommunity(report);
        drawMarkersOnMap();
    }
}

window.onload = initApp;