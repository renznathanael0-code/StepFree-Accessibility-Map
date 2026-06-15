const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    setTimeout(async () => {
        const login = prompt("StepFree Admin-Bereich\nBitte Passwort eingeben:");
        
        if (!login) {
            window.location.href = "index.html";
            return;
        }

        const msgBuffer = new TextEncoder().encode(login);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // FÜGE HIER DEINEN KOPIERTEN HASH EIN:
        if (hashHex === "b6e97cdceff5afead6676708d2261e8a915078ff0f2fa77856aae786ad6ac78c") {
            console.log("Admin erfolgreich eingeloggt.");
        } else {
            alert("Zugriff verweigert!");
            window.location.href = "index.html";
        }
    }, 100); 
}

const DATA_URL_BASE = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata/markers";
let map, myLocationMarker, reportsData = [],
    activeMarkers = {};
let activeSelectedFilters = [];

// --- HIERHIN VERSCHOBEN: Damit die Funktion sofort überall bereitsteht ---
function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if (s) {
        s.innerHTML = text;
        s.style.background = color;
    }
}

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
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));
    setupLocationTracking();
    
    L.Control.geocoder({
            position: 'topleft',
            defaultMarkGeocode: false,
            placeholder: "Stadt oder Straße suchen...",
            errorMessage: "Nichts gefunden."
        })
        .on('markgeocode', function(e) {
            var bbox = e.geocode.bbox;
            var poly = L.polygon([bbox.getSouthEast(), bbox.getNorthEast(), bbox.getNorthWest(), bbox.getSouthWest()]);
            map.fitBounds(poly.getBounds());
        })
        .addTo(map);
    
    map.on('moveend', loadFromCommunity);
    map.on('zoomend', loadFromCommunity);
    
    await loadFromCommunity();
    
    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
                drawMarkersOnMap();
            }, 800);
        }, 1000);
    }
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

// --- OPTIMIERT: Lädt nur noch Punkte, die im aktuellen Sichtfeld liegen ---
async function loadFromCommunity() {
    if (!map) return;
    updateStatus("Lade sichtbare Daten...", "#3498db");

    try {
        // 1. Sichtbare Grenzen der Karte abgreifen
        const bounds = map.getBounds();
        const southWest = bounds.getSouthWest();
        const northEast = bounds.getNorthEast();

        // 2. URL mit Firebase-Filtern für den Breitengrad (lat) zusammenbauen
        // Wichtig: Die Parameter müssen in Anführungszeichen übergeben werden
        const url = `${DATA_URL_BASE}.json?orderBy="lat"&startAt=${southWest.lat}&endAt=${northEast.lat}`;

        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            
            let geladeneMarker = [];
            if (result) {
                // Firebase gibt bei gefilterten Abfragen ein Objekt/Dictionary zurück, kein Array.
                // Wir wandeln es hier in ein Array um und filtern zusätzlich den Längengrad (lng)
                geladeneMarker = Object.values(result).filter(r => {
                    return r && r.lng >= southWest.lng && r.lng <= northEast.lng;
                });
            }
            
            // --- AUTOMATISCHE BEREINIGUNG BEIM LADEN ---
            const jetzt = Date.now();
            const valideMarker = geladeneMarker.filter(r => !r.expiresAt || r.expiresAt > jetzt);
            
            reportsData = valideMarker;

            // Falls abgelaufene Marker im aktuellen Ausschnitt gelöscht wurden, in DB aufräumen
            if (valideMarker.length !== geladeneMarker.length) {
                // Hinweis: Da wir hier nur ein Teilstück der DB haben, löschen wir abgelaufene 
                // Einträge am besten punktuell. Fürs Erste reicht es, reportsData lokal sauber zu halten.
            }
            
            drawMarkersOnMap();
            updateStatus("Community Live ✅", "#27AE60");
        }
    } catch (err) { 
        console.error("Ladefehler:", err);
        updateStatus("Offline-Modus ⚠️", "#E67E22");
    }
}

// --- HINWEIS: Da reportsData jetzt nur noch die sichtbaren Marker enthält,
// müssen wir beim Speichern aufpassen, dass wir nicht die restliche Welt überschreiben!
// Deshalb ändern wir PUT (überschreibt alles) zu einem gezielten Update/Push für den neuen Punkt.
async function saveSingleMarkerToCommunity(neuerPunkt) {
    updateStatus("Speichere...", "#f39c12");
    try {
        // Wir speichern den Punkt unter seiner eigenen ID in der Datenbank ab
        const response = await fetch(`${DATA_URL_BASE}/${neuerPunkt.id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(neuerPunkt)
        });
        
        if (response.ok) {
            updateStatus("Community Live ✅", "#27AE60");
        } else {
            throw new Error("Firebase Fehler");
        }
    } catch (err) { 
        console.error("Speicher-Fehler:", err);
        updateStatus("Sync-Fehler ❌", "#e74c3c");
    }
}

async function updateSingleMarkerInCommunity(punkt) {
    try {
        await fetch(`${DATA_URL_BASE}/${punkt.id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(punkt)
        });
    } catch (err) {
        console.error("Update-Fehler:", err);
    }
}

function toggleFilterBadge(button) {
    const value = button.getAttribute('data-value');
    
    if (activeSelectedFilters.includes(value)) {
        activeSelectedFilters = activeSelectedFilters.filter(f => f !== value);
        button.style.background = "#f0f3f4";
        button.style.color = "#2c3e50";
        button.style.borderColor = "#d5dbdb";
    } else {
        activeSelectedFilters.push(value);
        button.style.background = "#3498db";
        button.style.color = "white";
        button.style.borderColor = "#2980b9";
    }
    drawMarkersOnMap();
}

function resetAllFilters() {
    activeSelectedFilters = [];
    const badges = document.querySelectorAll('.filter-badge');
    badges.forEach(b => {
        b.style.background = "#f0f3f4";
        b.style.color = "#2c3e50";
        b.style.borderColor = "#d5dbdb";
    });
    drawMarkersOnMap();
}

function drawMarkersOnMap() {
    if (!map) return;

    const isAdminPage = window.location.pathname.includes("admin.html");
    const jetzt = Date.now();

    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};
    
    reportsData.forEach((r, index) => {
        if (r.expiresAt && r.expiresAt < jetzt) return;

        let markerTypes = Array.isArray(r.typ) ? r.typ : [r.typ];
        markerTypes = markerTypes.map(t => t === "WC barrierefrei" ? "WC" : t);

        if (activeSelectedFilters.length > 0) {
            const matchesAny = activeSelectedFilters.some(filter => {
                return markerTypes.some(t => t.includes(filter) || filter.includes(t));
            });
            if (!matchesAny) return; 
        }

        let emoji = "📍";
        let markerFarbe = r.farbe || "#9B59B6"; 

        if (markerTypes.length > 1) {
            emoji = "🏢"; 
            markerFarbe = "#2c3e50"; 
        } else if (markerTypes.length === 1) {
            const singleType = markerTypes[0];
            if (singleType.includes("Kein barrierefreier")) { emoji = "🚫"; markerFarbe = "#34495E"; }
            else if (singleType.includes("Treppe")) { emoji = "🪜"; markerFarbe = "#E74C3C"; }
            else if (singleType.includes("defekt")) { emoji = "🛗"; markerFarbe = "#E67E22"; }
            else if (singleType.includes("Baustelle")) { emoji = "🚧"; markerFarbe = "#F1C40F"; }
            else if (singleType.includes("E-Scooter")) { emoji = "🛴"; markerFarbe = "#D35400"; } 
            else if (singleType.includes("Mülltonne")) { emoji = "🗑️"; markerFarbe = "#7F8C8D"; } 
            else if (singleType.includes("Aufzug vorhanden")) { emoji = "🛗"; markerFarbe = "#27AE60"; }
            else if (singleType.includes("Rampe vorhanden")) { emoji = "📐"; markerFarbe = "#16A085"; }
            else if (singleType.includes("WC")) { emoji = "🚽"; markerFarbe = "#2ECC71"; }
            else if (singleType.includes("Parkplatz")) { emoji = "🅿️"; markerFarbe = "#3498DB"; }
            else if (singleType.includes("Barrierefreier Ort")) { emoji = "📍"; markerFarbe = "#9B59B6"; }
            else if (singleType.includes("Höhenunterschied")) { emoji = "⚠️"; markerFarbe = "#D35400"; }
            else if (singleType.includes("Niveaugleicher")) { emoji = "✅"; markerFarbe = "#2980B9"; }
        }
    
        let adminStyle = "";
        if (r.status === "confirmed") {
            adminStyle = "box-shadow: 0 0 15px 5px #2ecc71; border: 2px solid #2ecc71;";
        } else if (isAdminPage) {
            if (r.votes <= -3) {
                adminStyle = "box-shadow: 0 0 15px 5px red; border: 2px solid red;"; 
            } else if (r.votes >= 3) {
                adminStyle = "box-shadow: 0 0 15px 5px #2ecc71; border: 2px solid #2ecc71;"; 
            } else if (r.status === "new") {
                adminStyle = "box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;"; 
            }
        }
        
        const icon = L.divIcon({
            html: `<div style="background:${markerFarbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${adminStyle}">${emoji}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const m = L.marker([r.lat, r.lng], { icon }).addTo(map);
        
        if (isAdminPage && r.status === "new") {
            m.on('click', () => adminReviewDone(r.id));
        }
        
        let content = `<div style="font-family:sans-serif; min-width:220px;">`;
        
        if (isAdminPage) {
            if (r.votes <= -3) content += `<b style="color:red;">⚠️ KRITISCH (Votes)</b><br>`;
            else if (r.status === "confirmed") content += `<b style="color:#2ecc71;">✅ VOM ADMIN BESTÄTIGT</b><br>`;
            else if (r.votes >= 3) content += `<b style="color:#2ecc71;">🔥 FREIGABE BEREIT</b><br>`;
            else if (r.status === "new") content += `<b style="color:#3498db;">🆕 NEUER EINTRAG</b><br>`;
        } else if (r.status === "confirmed") {
            content += `<b style="color:#2ecc71;">🌟 Offiziell Bestätigt</b><br>`;
        }
        
        content += `<div style="margin-top:5px; margin-bottom:5px;">`;
        markerTypes.forEach(t => {
            content += `<span style="display:inline-block; background:#f0f4f8; padding:3px 8px; border-radius:12px; font-size:0.9em; font-weight:bold; margin:2px 2px 2px 0; color:#2c3e50;"># ${t}</span>`;
        });
        content += `</div>`;

        if (r.expiresAt) {
            const restStunden = Math.round((r.expiresAt - jetzt) / (1000 * 60 * 60));
            content += `<p style="margin: 2px 0; font-size: 0.85em; color: #e67e22;">⏱️ Automatisch weg in ca. <b>${restStunden} Std.</b></p>`;
        }

        content += `
                <p style="margin: 8px 0; color:#555; font-style:italic;">"${r.kommentar || 'Keine Zusatzinfos'}"</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Vertrauen: <b>${r.votes || 0}</b>
                </div>
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">✅ Stimmt</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">❌ Falsch</button>
                </div>`;
        
        const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`;
        content += `<a href="${googleUrl}" target="_blank" style="display:block; background:#4285F4; color:white; text-align:center; padding:10px; border-radius:5px; text-decoration:none; font-weight:bold; margin-bottom:10px;">Route in Google Maps starten</a>`;

        if (isAdminPage) {
            content += `<div style="border-top:1px solid #ccc; padding-top:10px; margin-top:5px;">`;
            if (r.votes >= 3 && r.status !== "confirmed") {
                content += `<button onclick="confirmByAdmin('${r.id}')" style="background:#2ecc71; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">👁️ Für User freigeben</button>`;
            }
            content += `
                    <button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">🗑️ Löschen</button>
                    <button onclick="askForCheck('${r.id}')" style="background:#3498db; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Check anfordern</button>
                </div>`;
        } else {
            const isTempType = markerTypes.some(t => t.includes("E-Scooter") || t.includes("Mülltonne") || t.includes("Baustelle"));
            if (r.needsCheck || isTempType) {
                content += `<button onclick="verifyByLocation('${r.id}')" style="background:#f39c12; color:white; border:none; padding:10px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📍 Hier einchecken & bestätigen</button>`;
            }
        }
        
        content += `</div>`;

        m.bindPopup(content);
        activeMarkers[index] = m;
    });
}

async function directDelete(id) {
    if (confirm("Diesen Punkt wirklich für alle löschen?")) {
        reportsData = reportsData.filter(r => r.id !== id);
        try {
            await fetch(`${DATA_URL_BASE}/${id}.json`, { method: 'DELETE' });
            updateStatus("Community Live ✅", "#27AE60");
        } catch(err) {
            console.error(err);
        }
        drawMarkersOnMap();
    }
}

function confirmByAdmin(id) {
    const report = reportsData.find(r => r.id === id);
    if (report) {
        report.status = "confirmed"; 
        drawMarkersOnMap();
        updateSingleMarkerInCommunity(report);
        alert("Eintrag erfolgreich verifiziert!");
    }
}

function askForCheck(id) {
    const r = reportsData.find(item => item.id === id);
    if (r) {
        r.needsCheck = true;
        r.status = "active"; 
        updateSingleMarkerInCommunity(r);
        drawMarkersOnMap();
        alert("Vor-Ort-Check wurde angefordert!");
    }
}

function verifyByLocation(id) {
    updateStatus("Prüfe Standort...", "#3498db");
    navigator.geolocation.getCurrentPosition((pos) => {
        const report = reportsData.find(r => r.id === id);
        if (!report) return;

        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, report.lat, report.lng);

        if (dist <= 0.05) { 
            let markerTypes = Array.isArray(report.typ) ? report.typ : [report.typ];
            const einTag = 24 * 60 * 60 * 1000;
            const siebenTage = 7 * einTag;
            const basisZeit = report.expiresAt && report.expiresAt > Date.now() ? report.expiresAt : Date.now();

            if (markerTypes.some(t => t.includes("E-Scooter") || t.includes("Mülltonne"))) {
                report.expiresAt = basisZeit + einTag;
                alert("Erfolgreich eingecheckt! Das Hindernis wurde um 24 Stunden verlängert.");
            } else if (markerTypes.some(t => t.includes("Baustelle"))) {
                report.expiresAt = basisZeit + siebenTage;
                alert("Erfolgreich eingecheckt! Die Baustelle wurde um 7 Tage verlängert.");
            } else {
                report.needsCheck = false;
                alert("Erfolgreich verifiziert!");
            }

            report.verifiedAt = new Date().toLocaleString('de-DE');
            updateSingleMarkerInCommunity(report);
            drawMarkersOnMap();
        } else {
            alert(`Check-In fehlgeschlagen! Du bist ${Math.round(dist * 1000)}m entfernt.`);
        }
        updateStatus("Community Live ✅", "#27AE60");
    }, () => alert("GPS-Zugriff verweigert!"));
}

function openSelectionPopup(latlng) {
  const content = `
    <div style="width: 280px; font-family: sans-serif; padding: 5px; max-height: 420px; overflow-y: auto;">
      <b style="display: block; text-align: center; margin-bottom: 10px; font-size:1.1em;">Eigenschaften auswählen</b>
      
      <form id="multiReportForm" onsubmit="finalizeMultiReport(event, ${latlng.lat}, ${latlng.lng})">
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.95em;">
          
          <strong>⚠️ Hindernisse</strong>
          <label><input type="checkbox" name="typ" value="Kein barrierefreier Zugang"> 🚫 Kein Zugang</label>
          <label><input type="checkbox" name="typ" value="Treppe"> 🪜 Treppe melden</label>
          <label><input type="checkbox" name="typ" value="Aufzug defekt"> 🛗 Aufzug defekt</label>
          <label><input type="checkbox" name="typ" value="Baustelle"> 🚧 Baustelle</label>
          <label><input type="checkbox" name="typ" value="E-Scooter"> 🛴 E-Scooter im Weg</label>
          <label><input type="checkbox" name="typ" value="Mülltonne"> 🗑️ Mülltonne blockiert</label>
          
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
          
          <strong>✨ Barrierefreiheit im Alltag</strong>
          <label><input type="checkbox" name="typ" value="Aufzug vorhanden"> 🛗 Aufzug vorhanden</label>
          <label><input type="checkbox" name="typ" value="Rampe vorhanden"> 📐 Rampe vorhanden</label>
          <label><input type="checkbox" name="typ" value="WC"> 🚽 WC vorhanden</label>
          <label><input type="checkbox" name="typ" value="Parkplatz"> 🅿️ Parkplatz</label>
          <label><input type="checkbox" name="typ" value="Barrierefreier Ort"> 📍 Barrierefreier Ort</label>
          
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
          
          <strong>🚉 Bahnsteig</strong>
          <label><input type="checkbox" name="typ" value="Höhenunterschied"> ⚠️ Stufe am Zug</label>
          <label><input type="checkbox" name="typ" value="Niveaugleicher Einstieg"> ✅ Einstieg eben</label>
          
          <hr style="margin: 8px 0; border: none; border-top: 1px solid #ccc;">
          
          <strong>Zusatzinformationen:</strong>
          <input type="text" id="multiDetails" placeholder="z.B. Rampe im 1. OG, WC im EG..." style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; width: 93%;">
          
          <button type="submit" style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px; font-size:1em;">💾 Eintrag speichern</button>
        </div>
      </form>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}

function finalizeMultiReport(event, lat, lng) {
    event.preventDefault();
    const checkboxes = document.querySelectorAll('#multiReportForm input[name="typ"]:checked');
    const gewaehlteTypen = Array.from(checkboxes).map(cb => cb.value);
    
    if (gewaehlteTypen.length === 0) {
        alert("Bitte wähle mindestens eine Eigenschaft aus!");
        return;
    }
    
    const kommentarText = document.getElementById('multiDetails').value;
    const einTag = 24 * 60 * 60 * 1000;
    const siebenTage = 7 * einTag;
    let ablaufZeit = null;

    if (gewaehlteTypen.some(t => t === "E-Scooter" || t === "Mülltonne")) {
        ablaufZeit = Date.now() + einTag;
    } else if (gewaehlteTypen.some(t => t === "Baustelle")) {
        ablaufZeit = Date.now() + siebenTage;
    }
    
    const neuerPunkt = {
        lat: lat, 
        lng: lng, 
        typ: gewaehlteTypen, 
        farbe: gewaehlteTypen.length > 1 ? "#2c3e50" : "#9B59B6", 
        kommentar: kommentarText || "", 
        id: "id_" + Date.now(), 
        votes: 0, 
        status: "new",
        expiresAt: ablaufZeit 
    };

    reportsData.push(neuerPunkt);
    drawMarkersOnMap();
    saveSingleMarkerToCommunity(neuerPunkt);
    map.closePopup();
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
    
    updateSingleMarkerInCommunity(report);
    drawMarkersOnMap();
}

function adminReviewDone(id) {
    const r = reportsData.find(item => item.id === id);
    if (r && r.status === "new") {
        r.status = "active";
        updateSingleMarkerInCommunity(r);
        drawMarkersOnMap();
    }
}

function downloadBackup() {
    if (typeof updateStatus === 'function') updateStatus("Erstelle Backup... ⏳", "#3498db");
    try {
        const datenQuelle = typeof reportsData !== 'undefined' ? reportsData : null;
        if (!datenQuelle) return;
        const dataStr = JSON.stringify(datenQuelle, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const dataUri = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const linkElement = document.createElement('a');
        linkElement.href = dataUri;
        linkElement.download = 'stepfree_backup_' + dateStr + '.json';
        linkElement.style.display = 'none';
        document.body.appendChild(linkElement);
        linkElement.click();
        setTimeout(() => {
            document.body.removeChild(linkElement);
            URL.revokeObjectURL(dataUri);
        }, 100);
        if (typeof updateStatus === 'function') updateStatus("Backup erfolgreich erstellt! 💾", "#2ecc71");
    } catch (fehler) {}
}
window.downloadBackup = downloadBackup;

function toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    menu.classList.toggle('open');
    overlay.classList.toggle('show');
}

function toggleLegend() {
    const legend = document.getElementById('map-legend');
    if (legend) legend.classList.toggle('collapsed');
}

window.onload = initApp;
