const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const audioPlayer = document.getElementById('audioPlayer');

let mediaRecorder;
let audioChunks = [];

recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = sendAudioToServer;

        mediaRecorder.start();

        // UI Updates
        recordBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        stopBtn.classList.add('pulse');
        statusText.textContent = 'Recording...';
        audioPlayer.style.display = 'none';

    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusText.textContent = 'Error: could not access microphone';
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();

        // UI Updates
        recordBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        stopBtn.classList.remove('pulse');
        statusText.textContent = 'Processing...';
    }
}

async function sendAudioToServer() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
        const response = await fetch('/api/talk', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const audioBlobResponse = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlobResponse);

        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block';
        audioPlayer.play();

        statusText.textContent = 'Playing response...';

    } catch (error) {
        console.error('Error sending audio:', error);
        statusText.textContent = 'Error processing request.';
    }
}
