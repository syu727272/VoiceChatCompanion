document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const timer = document.getElementById('timer');
    const messagesContainer = document.getElementById('messages');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const normalMode = document.getElementById('normalMode');
    const streamMode = document.getElementById('streamMode');

    let mediaRecorder;
    let audioChunks = [];
    let recording = false;
    let timerInterval;
    let startTime;
    let audioContext;
    let socket;
    let isStreamMode = false;

    // Initialize Socket.IO
    function initializeSocketIO() {
        socket = io();

        socket.on('connect', () => {
            console.log('Connected to server');
            recordingStatus.textContent = '録音の準備ができました';
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            recordingStatus.textContent = 'サーバー接続エラー';
            recordingStatus.classList.add('text-danger');
        });

        socket.on('stream-response', (data) => {
            addMessage(data.transcript, 'user');
            addMessage(data.response, 'assistant', data.audio_base64);
        });

        socket.on('stream-error', (data) => {
            console.error('Stream error:', data.error);
            recordingStatus.textContent = 'エラー: ' + data.error;
            recordingStatus.classList.add('text-danger');
        });
    }

    // Initialize audio devices
    async function initializeAudio() {
        try {
            // Initialize audio context for output
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
                if (isStreamMode && event.data.size > 0) {
                    processStreamChunk(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (!isStreamMode) {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    await processAudio(audioBlob);
                }
            };

            recordButton.disabled = false;
            recordingStatus.textContent = '録音の準備ができました';
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';

            // Initialize Socket.IO after audio is ready
            initializeSocketIO();

        } catch (error) {
            console.error('Error initializing audio:', error);
            recordingStatus.innerHTML = `エラー: ${error.message || 'オーディオデバイスの初期化に失敗しました'}`;
            recordingStatus.classList.add('text-danger');
        }
    }

    // Process streaming audio chunk
    async function processStreamChunk(chunk) {
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result.split(',')[1];
                socket.emit('stream-audio', base64Audio);
            };
            reader.readAsDataURL(chunk);
        } catch (error) {
            console.error('Error processing stream chunk:', error);
            recordingStatus.textContent = 'エラー: 音声データの処理に失敗しました';
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
        try {
            audioChunks = [];
            mediaRecorder.start(isStreamMode ? 1000 : undefined);
            recording = true;
            startTime = Date.now();
            recordButton.innerHTML = '<i class="fas fa-stop"></i> 録音停止';
            recordButton.classList.add('btn-danger');
            recordingStatus.textContent = '録音中...';
            recordingStatus.classList.add('recording');
            timer.style.display = 'block';
            timerInterval = setInterval(updateTimer, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
            recordingStatus.textContent = 'エラー: 録音を開始できませんでした';
            recordingStatus.classList.add('text-danger');
        }
    }

    // Stop recording
    function stopRecording() {
        try {
            mediaRecorder.stop();
            recording = false;
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';
            recordButton.classList.remove('btn-danger');
            recordingStatus.textContent = '処理中...';
            recordingStatus.classList.remove('recording');
            clearInterval(timerInterval);
            timer.style.display = 'none';
        } catch (error) {
            console.error('Error stopping recording:', error);
            recordingStatus.textContent = 'エラー: 録音を停止できませんでした';
            recordingStatus.classList.add('text-danger');
        }
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
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const binaryData = atob(base64Data);
            const audioData = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                audioData[i] = binaryData.charCodeAt(i);
            }

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

    // Mode change handler
    function handleModeChange() {
        isStreamMode = streamMode.checked;
        if (recording) {
            stopRecording();
        }
        recordingStatus.textContent = `録音の準備ができました (${isStreamMode ? 'チャット' : '通常'}モード)`;
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

    normalMode.addEventListener('change', handleModeChange);
    streamMode.addEventListener('change', handleModeChange);

    // Initialize audio
    initializeAudio();
});