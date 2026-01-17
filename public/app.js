const orb = document.getElementById('orb');
const orbIcon = document.getElementById('orbIcon');
const statusText = document.getElementById('statusText');
const subStatusText = document.getElementById('subStatusText');
const audioPlayer = document.getElementById('audioPlayer');
const vadRing = document.getElementById('vadRing');

// State Machine
const STATE = {
    IDLE: 'IDLE',
    LISTENING: 'LISTENING',
    THINKING: 'THINKING',
    SPEAKING: 'SPEAKING'
};

let currentState = STATE.IDLE;
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let microphone;
let javascriptNode;

// VAD Parameters
const VAD_THRESHOLD = 0.02; // Volume threshold
const SILENCE_DURATION = 1500; // ms to wait before sending
let silenceStart = Date.now();
let isSpeaking = false;
let checkSilenceInterval;

// Start on Click
orb.addEventListener('click', () => {
    if (currentState === STATE.IDLE) {
        initAudio();
    } else {
        // Manual interrupt/stop
        stopEverything();
    }
});

function setState(newState) {
    currentState = newState;
    orb.className = 'orb'; // reset
    orbIcon.textContent = '';

    switch (newState) {
        case STATE.IDLE:
            orbIcon.textContent = '🎙️';
            statusText.textContent = 'Tap to Start';
            subStatusText.textContent = '';
            break;
        case STATE.LISTENING:
            orb.classList.add('listening');
            orbIcon.textContent = '👂';
            statusText.textContent = 'Listening...';
            break;
        case STATE.THINKING:
            orb.classList.add('thinking');
            orbIcon.textContent = '🧠';
            statusText.textContent = 'Thinking...';
            subStatusText.textContent = 'Asking the AI...';
            break;
        case STATE.SPEAKING:
            orb.classList.add('speaking');
            orbIcon.textContent = '🗣️';
            statusText.textContent = 'Reseller Agent';
            subStatusText.textContent = 'Speaking...';
            break;
    }
}

async function initAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Setup MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = sendAudioToServer;

        // Setup VAD (Analysis)
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);

        javascriptNode.onaudioprocess = processVolume;

        startListening();

    } catch (err) {
        console.error("Mic Error:", err);
        statusText.textContent = "Mic Error";
    }
}

function startListening() {
    audioChunks = [];
    silenceStart = Date.now();
    isSpeaking = false;

    mediaRecorder.start();
    setState(STATE.LISTENING);

    // Start VAD Check Loop
    clearInterval(checkSilenceInterval);
    checkSilenceInterval = setInterval(checkSilence, 100);
}

function processVolume() {
    if (currentState !== STATE.LISTENING) return;

    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    let values = 0;
    const length = array.length;
    for (let i = 0; i < length; i++) {
        values += array[i];
    }
    const average = values / length;
    const volume = average / 255; // 0.0 to 1.0

    // Visualizer
    const size = 150 + (volume * 100);
    vadRing.style.width = `${size}px`;
    vadRing.style.height = `${size}px`;

    // VAD Logic
    if (volume > VAD_THRESHOLD) {
        // User is speaking
        silenceStart = Date.now();
        isSpeaking = true;
        subStatusText.textContent = "I hear you...";
    } else {
        // Silence
        subStatusText.textContent = "";
    }
}

function checkSilence() {
    if (currentState !== STATE.LISTENING) return;
    if (!isSpeaking) return; // Don't stop if we haven't heard anything yet

    if (Date.now() - silenceStart > SILENCE_DURATION) {
        // Silence detected for X seconds -> STOP
        console.log("Silence detected. Stopping...");
        mediaRecorder.stop(); // triggers onstop -> sendAudioToServer
        setState(STATE.THINKING);
        clearInterval(checkSilenceInterval);
    }
}

async function sendAudioToServer() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'input.webm');

    try {
        const response = await fetch('/api/talk', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Network error');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        audioPlayer.src = url;
        setState(STATE.SPEAKING);

        audioPlayer.play();

        audioPlayer.onended = () => {
            // Loop back to listening
            startListening();
        };

    } catch (err) {
        console.error(err);
        statusText.textContent = "Error";
        setTimeout(stopEverything, 2000);
    }
}

function stopEverything() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (checkSilenceInterval) clearInterval(checkSilenceInterval);
    audioPlayer.pause();
    setState(STATE.IDLE);
}
