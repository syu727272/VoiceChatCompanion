document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const timer = document.getElementById('timer');
    const messagesContainer = document.getElementById('messages');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let mediaRecorder;
    let audioChunks = [];
    let recording = false;
    let timerInterval;
    let startTime;

    // Initialize audio recording
    async function initializeRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await processAudio(audioBlob);
            };
        } catch (error) {
            console.error('Error accessing microphone:', error);
            recordingStatus.textContent = 'Error: Could not access microphone';
        }
    }

    // Update timer display
    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timer.textContent = `${minutes}:${seconds}`;
    }

    // Start recording
    function startRecording() {
        audioChunks = [];
        mediaRecorder.start();
        recording = true;
        startTime = Date.now();
        recordButton.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
        recordButton.classList.add('btn-danger');
        recordingStatus.textContent = 'Recording...';
        recordingStatus.classList.add('recording');
        timer.style.display = 'block';
        timerInterval = setInterval(updateTimer, 1000);
    }

    // Stop recording
    function stopRecording() {
        mediaRecorder.stop();
        recording = false;
        recordButton.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
        recordButton.classList.remove('btn-danger');
        recordingStatus.textContent = 'Processing...';
        recordingStatus.classList.remove('recording');
        clearInterval(timerInterval);
        timer.style.display = 'none';
    }

    // Process audio and get response
    async function processAudio(audioBlob) {
        loadingOverlay.style.display = 'flex';
        
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob);

            const response = await fetch('/process-audio', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                // Add messages to conversation
                addMessage(data.transcript, 'user');
                addMessage(data.response, 'assistant');
                recordingStatus.textContent = 'Ready to record';
            } else {
                throw new Error(data.error || 'Failed to process audio');
            }
        } catch (error) {
            console.error('Error:', error);
            recordingStatus.textContent = 'Error: ' + error.message;
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    // Add message to conversation
    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <p class="mb-0">${text}</p>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Initialize and set up event listeners
    initializeRecording();

    recordButton.addEventListener('click', () => {
        if (!recording) {
            startRecording();
        } else {
            stopRecording();
        }
    });
});
