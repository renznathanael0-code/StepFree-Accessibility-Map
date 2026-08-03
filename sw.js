// --- SERVICE WORKER FOR INTERACTIVE PUSH NOTIFICATIONS ---
const DATA_URL_BASE = "https://stepfree-7c252-default-rtdb.europe-west1.firebasedatabase.app/mapdata/markers";

self.addEventListener('push', function(event) {
    let data = { titel: "Orts-Check", nachricht: "Stimmen die Angaben zu diesem Ort?", markerId: "unknown", typ: "Ort" };
    if (event.data) {
        try { data = event.data.json(); } catch(e) { data.nachricht = event.data.text(); }
    }
    const options = {
        body: data.nachricht,
        icon: 'favicon.ico',
        badge: 'favicon.ico',
        tag: data.markerId,
        data: { markerId: data.markerId, typ: data.typ },
        actions: [
            { action: 'still_there', title: '🔄 Richtig / Existiert noch', icon: '' },
            { action: 'resolved', title: '🗑️ Falsch / Ist behoben', icon: '' }
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
                { action: 'still_there', title: '🔄 Richtig', icon: '' },
                { action: 'resolved', title: '🗑️ Falsch / Behoben', icon: '' }
            ],
            requireInteraction: true
        };
        self.registration.showNotification("Orts-Check!", options);
    }
});

self.addEventListener('notificationclick', function(event) {
    const notification = event.notification;
    const action = event.action;
    const markerId = notification.data.markerId;
    const markerTyp = notification.data.typ;
    
    notification.close();

    if (!action) {
        event.waitUntil(clients.openWindow("index.html"));
        return;
    }

    event.waitUntil(
        fetch(`${DATA_URL_BASE}/${markerId}.json`)
        .then(response => response.json())
        .then(async (report) => {
            if (!report) return;

            const einTag = 24 * 60 * 60 * 1000;
            const siebenTage = 7 * einTag;
            const basisZeit = report.expiresAt && report.expiresAt > Date.now() ? report.expiresAt : Date.now();
            
            // Counter initialisieren, falls noch nicht vorhanden
            report.loeschCheckIns = report.loeschCheckIns || 0;
            report.votes = report.votes || 0;

            if (action === 'still_there') {
                // Positives Feedback (Richtig / Existiert noch)
                report.votes += 1;
                
                // Falls flüchtiges Hindernis, Zeit verlängern
                const istFluechtig = markerTyp.includes("Scooter") || markerTyp.includes("Müll");
                if (report.expiresAt) {
                    report.expiresAt = basisZeit + (istFluechtig ? einTag : siebenTage);
                }
                
                // Bei 3 richtigen Klicks -> Bereit für Admin-Bestätigung (Grüner Kranz)
                if (report.votes >= 3 && report.status !== "confirmed") {
                    report.status = "ready_for_confirm";
                }
                
                report.verifiedAt = new Date().toLocaleString('de-DE') + " (via Push: Richtig)";

            } else if (action === 'resolved') {
                // Negatives Feedback (Falsch / Behoben)
                report.loeschCheckIns += 1;
                
                // Bei 3 falschen Klicks -> Kritisch zur Admin-Prüfung (Roter Kranz)
                if (report.loeschCheckIns >= 3) {
                    report.status = "needs_review";
                }
                
                report.verifiedAt = new Date().toLocaleString('de-DE') + " (via Push: Falsch)";
            }

            return fetch(`${DATA_URL_BASE}/${markerId}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report)
            });
        })
        .catch(err => console.error("Hintergrund-Sync fehlgeschlagen:", err))
    );
});