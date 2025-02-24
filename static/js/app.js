document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const timer = document.getElementById('timer');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let mediaRecorder;
    let audioChunks = [];
    let recording = false;
    let timerInterval;
    let startTime;
    let socket;

    // Enable button initially to allow user interaction
    recordButton.disabled = false;
    recordButton.innerHTML = '<i class="fas fa-microphone"></i> マイクを有効化';

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
            playAudioResponse(data.audio_base64);
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
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create MediaRecorder with mp3 format
            const options = {
                mimeType: 'audio/webm;codecs=opus', // Using WebM with Opus codec
                audioBitsPerSecond: 128000
            };

            mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    // Convert WebM to WAV before sending
                    const webmBlob = new Blob([event.data], { type: 'audio/webm' });
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuffer = await webmBlob.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                    // Create WAV format data
                    const wavBlob = await audioBufferToWav(audioBuffer);

                    // Process and send the WAV data
                    processStreamChunk(wavBlob);
                }
            };

            recordingStatus.textContent = '録音の準備ができました';
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';

            // Initialize Socket.IO after audio is ready
            initializeSocketIO();

            return true;
        } catch (error) {
            console.error('Error initializing audio:', error);
            recordingStatus.innerHTML = `エラー: ${error.message || 'マイクへのアクセスが許可されていません'}`;
            recordingStatus.classList.add('text-danger');
            return false;
        }
    }

    // Convert AudioBuffer to WAV format
    function audioBufferToWav(buffer) {
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numberOfChannels * bytesPerSample;

        const wav = new ArrayBuffer(44 + buffer.length * bytesPerSample);
        const view = new DataView(wav);

        // Write WAV header
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + buffer.length * bytesPerSample, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, buffer.length * bytesPerSample, true);

        // Write audio data
        const offset = 44;
        const bufferData = buffer.getChannelData(0);
        for (let i = 0; i < bufferData.length; i++) {
            const sample = Math.max(-1, Math.min(1, bufferData[i]));
            view.setInt16(offset + i * bytesPerSample, sample * 0x7FFF, true);
        }

        return new Blob([wav], { type: 'audio/wav' });
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

    // Start recording
    function startRecording() {
        try {
            audioChunks = [];
            mediaRecorder.start(1000); // Stream mode: chunk every second
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
            recordingStatus.textContent = '録音の準備ができました';
            recordingStatus.classList.remove('recording');
            clearInterval(timerInterval);
            timer.style.display = 'none';
        } catch (error) {
            console.error('Error stopping recording:', error);
            recordingStatus.textContent = 'エラー: 録音を停止できませんでした';
            recordingStatus.classList.add('text-danger');
        }
    }

    // Play audio response
    async function playAudioResponse(base64Data) {
        try {
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

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timer.textContent = `${minutes}:${seconds}`;
    }

    // Set up event listeners
    recordButton.addEventListener('click', async () => {
        if (!mediaRecorder) {
            // First click: Initialize audio
            const initialized = await initializeAudio();
            if (!initialized) {
                recordButton.innerHTML = '<i class="fas fa-microphone"></i> マイクを有効化';
                return;
            }
        } else if (!recording) {
            startRecording();
        } else {
            stopRecording();
        }
    });
});