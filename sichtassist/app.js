const BACKEND_URL = "https://sichtassist-backend.onrender.com/api/analyze";


const video = document.getElementById('cameraFeed');
const statusBox = document.getElementById('appStatus');
let isAnalyzing = false;

// 1. SPRACHAUSGABE (TTS)
function speak(text, callback) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 1.0;
    utterance.onend = () => { if (callback) callback(); };
    statusBox.textContent = text;
    window.speechSynthesis.speak(utterance);
}

// 2. SPRACHERKENNUNG (STT)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.continuous = false;

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        handleCommand(command);
    };

    recognition.onerror = () => setTimeout(startListening, 1000);
    recognition.onend = () => {
        if (!window.speechSynthesis.speaking && !isAnalyzing) startListening();
    };
}

function startListening() {
    if (recognition && !isAnalyzing) {
        try { recognition.start(); } catch (e) {}
    }
}

// 3. BEFEHLE VERARBEITEN
function handleCommand(command) {
    if (command.includes('ampel')) triggerAnalysis('traffic');
    else if (command.includes('hindernis') || command.includes('weg')) triggerAnalysis('obstacle');
    else if (command.includes('farbe')) triggerAnalysis('color');
    else if (command.includes('text') || command.includes('lesen')) triggerAnalysis('text');
    else speak("Nicht verstanden. Bitte sage Ampel, Hindernis, Farbe oder Text.", () => startListening());
}

// 4. BILD CAPTUREN
function captureImageBase64() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
}

// 5. ANFRAGE AN DEIN RENDER-BACKEND SCHICKEN
async function triggerAnalysis(mode) {
    if (isAnalyzing) return;
    isAnalyzing = true;
    speak("Analysiere Bild, bitte warten...", null);

    try {
        const imageBase64 = captureImageBase64();

        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, mode })
        });

        const data = await response.json();
        const textResult = data.result || data.error || "Keine Antwort erhalten.";

        speak(textResult, () => {
            isAnalyzing = false;
            startListening();
        });

    } catch (err) {
        console.error(err);
        speak("Verbindungsfehler zum Backend.", () => {
            isAnalyzing = false;
            startListening();
        });
    }
}

// 6. KAMERA STARTEN
async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        speak("SichtAssist bereit. Sage einen Befehl wie Ampel, Hindernis, Farbe oder Text.", () => startListening());
    } catch (err) {
        speak("Kamera-Zugriff verweigert.");
    }
}

// Event Listener für Knöpfe & Touch
document.getElementById('btnObstacle').addEventListener('click', () => triggerAnalysis('obstacle'));
document.getElementById('btnTraffic').addEventListener('click', () => triggerAnalysis('traffic'));
document.getElementById('btnText').addEventListener('click', () => triggerAnalysis('text'));
document.getElementById('btnColor').addEventListener('click', () => triggerAnalysis('color'));

document.body.addEventListener('click', () => { init(); }, { once: true });
