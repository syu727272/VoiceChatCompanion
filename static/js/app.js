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
    let audioContext;

    // Initialize audio devices
    async function initializeAudio() {
        try {
            // Check microphone permission status
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });

            if (permissionStatus.state === 'denied') {
                throw new Error('マイクの使用が拒否されています。ブラウザの設定でマイクへのアクセスを許可してください。');
            }

            // Initialize audio context for output
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await processAudio(audioBlob);
            };

            // Test audio output
            const oscillator = audioContext.createOscillator();
            oscillator.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);

            recordButton.disabled = false;
            recordingStatus.textContent = '録音の準備ができました';
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';
        } catch (error) {
            console.error('Error initializing audio:', error);
            recordingStatus.textContent = error.message || 'オーディオデバイスへのアクセスが許可されていません';
            recordingStatus.classList.add('text-danger');
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
        recordButton.innerHTML = '<i class="fas fa-stop"></i> 録音停止';
        recordButton.classList.add('btn-danger');
        recordingStatus.textContent = '録音中...';
        recordingStatus.classList.add('recording');
        timer.style.display = 'block';
        timerInterval = setInterval(updateTimer, 1000);
    }

    // Stop recording
    function stopRecording() {
        mediaRecorder.stop();
        recording = false;
        recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';
        recordButton.classList.remove('btn-danger');
        recordingStatus.textContent = '処理中...';
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
                addMessage(data.response, 'assistant', data.audio_base64);
                recordingStatus.textContent = '録音の準備ができました';
            } else {
                throw new Error(data.error || 'Failed to process audio');
            }
        } catch (error) {
            console.error('Error:', error);
            recordingStatus.textContent = 'エラー: ' + error.message;
            recordingStatus.classList.add('text-danger');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    // Play audio response
    async function playAudioResponse(base64Data) {
        try {
            // Resume audio context if it was suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Convert base64 to binary data
            const binaryData = atob(base64Data);
            const audioData = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                audioData[i] = binaryData.charCodeAt(i);
            }

            // Create audio blob and play
            const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                alert('音声の再生中にエラーが発生しました。');
            };

            await audio.play();
        } catch (error) {
            console.error('Error playing audio:', error);
            alert('音声の再生中にエラーが発生しました。');
        }
    }

    // Add message to conversation
    function addMessage(text, role, audioData = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        let playButtonHtml = '';
        if (audioData) {
            playButtonHtml = `
                <button class="btn btn-sm btn-primary play-response" onclick="playAudioResponse('${audioData}')">
                    <i class="fas fa-play"></i> 回答を再生
                </button>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-content">
                <p class="mb-0">${text}</p>
                ${playButtonHtml}
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Make functions available globally
    window.playAudioResponse = playAudioResponse;

    // Set up event listeners
    recordButton.addEventListener('click', () => {
        if (!recording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    // Initialize audio on page load
    initializeAudio();
});