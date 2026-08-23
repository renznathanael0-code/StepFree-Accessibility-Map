// --- SERVICE WORKER FOR INTERACTIVE PUSH NOTIFICATIONS ---
const DATA_URL_BASE = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata/markers";

// Hilfsfunktion: Prüft und speichert bereits gevotete Marker-IDs in IndexedDB
function checkAndSetVoted(markerId) {
    return new Promise((resolve) => {
        const request = indexedDB.open("StepFreeDB", 1);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("voted_markers")) {
                db.createObjectStore("voted_markers");
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction("voted_markers", "readwrite");
            const store = tx.objectStore("voted_markers");
            const getReq = store.get(markerId);
            
            getReq.onsuccess = () => {
                if (getReq.result) {
                    resolve(true); // Bereits abgestimmt
                } else {
                    store.put(true, markerId); // Neu eintragen & erlauben
                    resolve(false);
                }
            };
            getReq.onerror = () => resolve(false);
        };

        request.onerror = () => resolve(false);
    });
}

self.addEventListener('push', function(event) {
    let data = { titel: "Orts-Check", nachricht: "Stimmen die Angaben zu diesem Ort?", markerId: "unknown", typ: "Ort" };
    
    if (event.data) {
        try { 
            data = event.data.json(); 
        } catch(e) { 
            data.nachricht = event.data.text(); 
        }
    }

    const options = {
        body: data.nachricht,
        icon: 'favicon.ico',
        badge: 'favicon.ico',
        tag: data.markerId,
        data: { markerId: data.markerId, typ: data.typ },
        actions: [
            { action: 'still_there', title: '🔄 Richtig / Existiert noch' },
            { action: 'resolved', title: '🗑️ Falsch / Ist behoben' }
        ],
        requireInteraction: true
    };

    event.waitUntil(self.registration.showNotification(data.titel, options));
});

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'TRIGGER_PROMPT') {
        const data = event.data.payload;
        const options = {
            body: `Du bist bei: ${data.typ}. Stimmt diese Meldung vor Ort?`,
            icon: 'favicon.ico',
            badge: 'favicon.ico',
            tag: data.markerId,
            data: { markerId: data.markerId, typ: data.typ },
            actions: [
                { action: 'still_there', title: '🔄 Richtig' },
                { action: 'resolved', title: '🗑️ Falsch / Behoben' }
            ],
            requireInteraction: true
        };

        self.registration.showNotification("Orts-Check!", options);
    }
});

self.addEventListener('notificationclick', function(event) {
    const notification = event.notification;
    const action = event.action; 
    const markerId = notification.data ? notification.data.markerId : null;
    let markerTyp = notification.data ? notification.data.typ : "";
    
    notification.close();

    // 1. Klick auf Notification-Body (ohne Button-Action) -> App / Marker öffnen
    if (!action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(`index.html?marker=${markerId || ''}`);
                }
            })
        );
        return;
    }

    // 2. Ohne gültige ID Logik abbrechen
    if (!markerId || markerId === "unknown") return;

    // 3. Stimmabgabe verarbeiten (Interaktive Buttons)
    event.waitUntil(
        checkAndSetVoted(markerId).then(async (alreadyVoted) => {
            if (alreadyVoted) {
                console.log(`[Push] Marker ${markerId} wurde von diesem Gerät bereits verifiziert.`);
                return;
            }

            if (Array.isArray(markerTyp)) {
                markerTyp = markerTyp.join(" ");
            } else if (typeof markerTyp !== 'string') {
                markerTyp = "";
            }

            try {
                const response = await fetch(`${DATA_URL_BASE}/${markerId}.json`);
                const report = await response.json();
                
                if (!report) return;

                const einTag = 24 * 60 * 60 * 1000;
                const siebenTage = 7 * einTag;
                const basisZeit = report.expiresAt && report.expiresAt > Date.now() ? report.expiresAt : Date.now();
                
                report.loeschCheckIns = Number(report.loeschCheckIns) || 0;
                report.votes = Number(report.votes) || 0;

                if (action === 'still_there') {
                    report.votes += 1;
                    
                    const istFluechtig = markerTyp.includes("Scooter") || markerTyp.includes("Müll");
                    if (report.expiresAt) {
                        report.expiresAt = basisZeit + (istFluechtig ? einTag : siebenTage);
                    }
                    
                    if (report.votes >= 3 && report.status !== "confirmed") {
                        report.status = "ready_for_confirm";
                    }
                    
                    report.verifiedAt = new Date().toISOString() + " (via Push: Richtig)";

                } else if (action === 'resolved') {
                    report.loeschCheckIns += 1;
                    
                    if (report.loeschCheckIns >= 3) {
                        report.status = "needs_review";
                    }
                    
                    report.verifiedAt = new Date().toISOString() + " (via Push: Falsch)";
                }

                // Patch statt PUT, um versehentliches Überschreiben von Datenfeldern zu verhindern
                await fetch(`${DATA_URL_BASE}/${markerId}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(report)
                });
            } catch (err) {
                console.error("Hintergrund-Sync fehlgeschlagen:", err);
            }
        })
    );
});
