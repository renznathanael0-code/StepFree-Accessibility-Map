const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    const login = prompt("StepFree Admin-Bereich\nBitte Passwort eingeben:");
    if (btoa(login) !== "ZldpUyE=") { 
        alert("Zugriff verweigert!");
        window.location.href = "index.html"; 
    }
}

const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb";
function getBasketUrl(lat, lng) {
    const gridLat = Math.floor(lat);
    const gridLng = Math.floor(lng);
    return `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/freeway_grid_${gridLat}_${gridLng}`;
}


let map, myLocationMarker, reportsData = [], activeMarkers = {};

// Distanzberechnung für den Vor-Ort-Check
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Kilometer
}

async function initApp() {
    const splash = document.getElementById('splash-screen');
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
map.on('moveend', function() {
    loadFromCommunity(); 
});

 updateStatus("Lade Community-Daten...", "#3498db");
    try {
        await loadFromCommunity();
        updateStatus("Community Live ✅", "#27AE60");
    } catch (e) {
        updateStatus("Eingeschränkt bereit ⚠️", "#E67E22");
    }

    setTimeout(() => {
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
            }, 600);
        }
    }, 100);
}

function setupLocationTracking() {
    const locationIcon = L.divIcon({
        html: `<div style="background:#3498db; width:12px; height:12px; border-radius:50%; border:3px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        className: '',
        iconSize: [18, 18]
    });
    map.locate({watch: true, enableHighAccuracy: true});
    map.on('locationfound', e => {
        if (myLocationMarker) {
            myLocationMarker.setLatLng(e.latlng);
        } else {
            myLocationMarker = L.marker(e.latlng, {icon: locationIcon}).addTo(map);
            myLocationMarker.bindPopup("Du bist hier");
            map.setView(e.latlng, 16);
        }
    });
}

async function loadFromCommunity() {
    // Wir nehmen die aktuelle Kartenmitte als Referenzpunkt
    const center = map.getCenter();
    const url = getBasketUrl(center.lat, center.lng);

    try {
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            reportsData = result.markers || [];
            drawMarkersOnMap();
        }
    } catch (err) { 
        console.log("Dieses Raster ist noch leer."); 
    }
}

async function saveToCommunity() {
    updateStatus("Speichere...", "#f39c12");
    try {
        await fetch(PANTRY_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ markers: reportsData })
        });
        updateStatus("Community Live ✅", "#27AE60");
    } catch (err) { console.error("Speichern fehlgeschlagen."); }
}

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if(s) {
        s.innerHTML = text;
        s.style.background = color;
    }
}

function drawMarkersOnMap() {
    const isAdminPage = window.location.pathname.includes("admin.html");
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};

    reportsData.forEach((r, index) => {
        // Emojis festlegen
        let emoji = "📍";
        if (r.typ.includes("Treppe")) emoji = "🪜";
        if (r.typ.includes("defekt")) emoji = "🛗";
        if (r.typ.includes("WC")) emoji = "🚽";
        if (r.typ.includes("Parkplatz")) emoji = "🅿️";
        if (r.typ.includes("Aufzug")) emoji = "🛗";
        if (r.typ.includes("Baustelle")) emoji = "🚧";

        // MARKIERUNGEN NUR FÜR ADMINS (Leuchteffekte)
        let adminStyle = "";
        if (isAdminPage) {
            if (r.votes <= -3) {
                adminStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;"; // Viel Kritik (Rot)
            } else if (r.status === "new") {
                adminStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; // Neu (Blau)
            }
        }

        const icon = L.divIcon({
            html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${adminStyle}">${emoji}</div>`,
            className: '', 
            iconSize: [30, 30]
        });

        const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
        
        // Admin-Logik: Markierung beim ersten Klick entfernen
        if (isAdminPage && r.status === "new") {
            m.on('click', () => adminReviewDone(r.id));
        }

        const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
        
        let popupContent = `<div style="font-family:sans-serif; min-width:200px;">`;
        
        // Admin-Header Info
        if (isAdminPage) {
            if (r.votes <= -3) popupContent += `<b style="color:red; font-size:10px;">⚠️ KRITISCH (VOTES)</b><br>`;
            if (r.status === "new") popupContent += `<b style="color:#3498db; font-size:10px;">🆕 UNGEPRÜFT</b><br>`;
        }

        popupContent += `
                <b style="font-size:1.1em;">${r.typ}</b><br>
                <p style="margin: 5px 0; color:#555;">${r.kommentar}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Community-Vertrauen: <b>${r.votes || 0}</b>
                </div>`;

        // ZEITSTEMPEL NUR FÜR ADMIN (VerifiedAt)
        if (isAdminPage && r.verifiedAt) {
            popupContent += `
                <div style="background:#D4EFDF; color:#1D8348; padding:8px; border-radius:5px; margin-bottom:10px; font-size:0.8em; border:1px solid #27AE60;">
                    <b>✅ Check-In erfolgt:</b><br>${r.verifiedAt}
                </div>`;
        }

        // Voting Buttons
        popupContent += `
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">✅</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">❌</button>
                </div>`;

        // GOOGLE MAPS BUTTON (Wieder da!)
        popupContent += `
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; margin-bottom:10px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">
                        <span style="margin-right:8px;">🗺️</span> Navigation starten
                    </button>
                </a>`;

        // Spezielle Buttons
        if (isAdminPage) {
            popupContent += `
                <div style="border-top:1px solid #ccc; padding-top:10px; margin-top:5px;">
                    <button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">🗑️ Löschen</button>
                    <button onclick="askForCheck('${r.id}')" style="background:#3498db; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Check anfordern</button>
                </div>`;
        } else if (r.needsCheck) {
            popupContent += `
                <button onclick="verifyByLocation('${r.id}')" style="background:#f39c12; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Hier einchecken (GPS)</button>`;
        }

        popupContent += `</div>`; 
        m.bindPopup(popupContent);
        activeMarkers[index] = m;
    }); 
}

function directDelete(id) {
    if (confirm("Diesen Punkt wirklich für alle löschen?")) {
        reportsData = reportsData.filter(r => r.id !== id);
        saveToCommunity();
        drawMarkersOnMap();
    }
}

function askForCheck(id) {
    const r = reportsData.find(item => item.id === id);
    if (r) {
        r.needsCheck = true;
        r.status = "active"; 
        saveToCommunity();
        drawMarkersOnMap();
        alert("Vor-Ort-Check wurde angefordert!");
    }
}

function verifyByLocation(id) {
    updateStatus("Prüfe Standort...", "#3498db");
    navigator.geolocation.getCurrentPosition((pos) => {
        const report = reportsData.find(r => r.id === id);
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, report.lat, report.lng);

        // 50 Meter Radius (0.05 km)
        if (dist <= 0.05) { 
            report.needsCheck = false;
            report.verifiedAt = new Date().toLocaleString('de-DE');
            saveToCommunity();
            drawMarkersOnMap();
            alert("Erfolgreich! Dein Standort wurde verifiziert und der Punkt bestätigt.");
        } else {
            alert(`Check-In fehlgeschlagen! Du bist ${Math.round(dist * 1000)}m entfernt. Du musst näher am Hindernis sein (max. 50m).`);
        }
        updateStatus("Community Live ✅", "#27AE60");
    }, () => alert("GPS-Zugriff verweigert! Ohne Standort kein Check-In möglich."));
}

function openSelectionPopup(latlng) {
  const content = `
    <div style="width: 280px; font-family: sans-serif; padding: 10px;">
      <b style="display: block; text-align: center; margin-bottom: 15px;">Eintrag hinzufügen</b>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🪜 Treppe melden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🛗 Aufzug defekt</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚧 Baustelle</button>
        <hr>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🛗 Aufzug vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🚽 WC barrierefrei</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">🅿️ Parkplatz</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">📍 Barrierefreier Ort</button>
      </div>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

async function finalizeReport(lat, lng, typ, farbe) {
    const details = prompt(`Zusatzinfos für ${typ}:`, "");
    const newReport = {
        lat: lat, lng: lng, typ: typ, farbe: farbe, 
        kommentar: details || "", id: "id_" + Date.now(), 
        votes: 0, status: "new"
    };

    const targetUrl = getBasketUrl(lat, lng);
    
    updateStatus("Speichere im Raster...", "#f39c12");

    try {
        // 1. Erst schauen, was in diesem Quadrat schon existiert
        let regionData = { markers: [] };
        const response = await fetch(targetUrl);
        if (response.ok) regionData = await response.json();

        // 2. Neuen Punkt hinzufügen
        regionData.markers.push(newReport);

        // 3. Zurückschicken
        await fetch(targetUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(regionData)
        });
        
        reportsData.push(newReport); // Lokal aktualisieren
        drawMarkersOnMap();
        updateStatus("Weltweit gespeichert ✅", "#27AE60");
    } catch (err) {
        alert("Fehler beim Speichern im Raster.");
    }
}

function adminReviewDone(id) {
    const r = reportsData.find(item => item.id === id);
    if (r && r.status === "new") {
        r.status = "active";
        saveToCommunity();
        drawMarkersOnMap();
    }
}

function adminReviewDone(id) {
    const r = reportsData.find(item => item.id === id);
    if (r && r.status === "new") {
        r.status = "active";
        saveToCommunity();
        drawMarkersOnMap();
    }
}

async function vote(id, change) {
    const report = reportsData.find(r => r.id === id);
    if (!report) return;
    
    let myVotes = JSON.parse(localStorage.getItem('userVotes') || "{}");
    if (myVotes[id]) return alert("Bereits abgestimmt!");
    
    report.votes += change;
    myVotes[id] = true;
    localStorage.setItem('userVotes', JSON.stringify(myVotes));
    
    if (report.votes <= -3) report.status = "review";
    
    saveToCommunity();
    drawMarkersOnMap();
}

async function adminScanStuttgartRegion() {
    updateStatus("Scanne Region...", "#3498db");
    reportsData = [];
    
    // Scannt ein 3x3 Raster um Stuttgart (Lat 47-49, Lng 8-10)
    const scanArea = [];
    for(let lat = 47; lat <= 49; lat++) {
        for(let lng = 8; lng <= 10; lng++) {
            scanArea.push(getBasketUrl(lat, lng));
        }
    }

    const fetchPromises = scanArea.map(url => 
        fetch(url).then(res => res.ok ? res.json() : null).catch(() => null)
    );

    const results = await Promise.all(fetchPromises);
    results.forEach(data => {
        if(data && data.markers) reportsData.push(...data.markers);
    });
    drawMarkersOnMap();
    updateStatus("Radar aktiv ✅", "#27AE60");
}


window.onload = initApp;