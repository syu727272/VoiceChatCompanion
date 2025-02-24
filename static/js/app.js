document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const timer = document.getElementById('timer');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let audioContext;
    let mediaStream;
    let sourceNode;
    let processorNode;
    let recording = false;
    let timerInterval;
    let startTime;

    async function initializeAudio() {
        try {
            // Initialize AudioContext on user interaction
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.resume();

            // Load audio worklet
            await audioContext.audioWorklet.addModule('/static/js/audio-processor.js');

            // Get microphone access
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            sourceNode = audioContext.createMediaStreamSource(mediaStream);

            // Create audio processor node
            processorNode = new AudioWorkletNode(audioContext, 'audio-processor');

            // Connect nodes but don't output yet
            sourceNode.connect(processorNode);

            recordButton.disabled = false;
            recordingStatus.textContent = '録音の準備ができました';
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';

        } catch (error) {
            console.error('Error initializing audio:', error);
            recordingStatus.innerHTML = `エラー: ${error.message || 'オーディオデバイスの初期化に失敗しました'}`;
            recordingStatus.classList.add('text-danger');
        }
    }

    function startRecording() {
        try {
            // Connect to output for real-time processing
            processorNode.connect(audioContext.destination);

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

    function stopRecording() {
        try {
            // Disconnect from output
            processorNode.disconnect(audioContext.destination);

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

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timer.textContent = `${minutes}:${seconds}`;
    }

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
            //This function is no longer needed.
        });

        socket.on('stream-error', (data) => {
            console.error('Stream error:', data.error);
            recordingStatus.textContent = 'エラー: ' + data.error;
            recordingStatus.classList.add('text-danger');
        });
    }


    recordButton.addEventListener('click', () => {
        if (!audioContext) {
            initializeAudio().then(() => {
                if (!recording) {
                    startRecording();
                    initializeSocketIO(); // Initialize Socket.IO after audio is ready
                }
            });
        } else {
            if (!recording) {
                startRecording();
            } else {
                stopRecording();
            }
        }
    });
});