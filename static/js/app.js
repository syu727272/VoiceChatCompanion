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

    // Enable button initially to allow user interaction
    recordButton.disabled = false;
    recordButton.innerHTML = '<i class="fas fa-microphone"></i> マイクを有効化';

    async function initializeAudio() {
        try {
            // Create AudioContext on user interaction
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.resume();

            // Request microphone access
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            sourceNode = audioContext.createMediaStreamSource(mediaStream);

            // Load audio worklet
            await audioContext.audioWorklet.addModule('/static/js/audio-processor.js');

            // Create audio processor node
            processorNode = new AudioWorkletNode(audioContext, 'audio-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 1,
                processorOptions: {
                    bufferSize: 2048
                }
            });

            // Connect nodes but don't connect to destination yet
            sourceNode.connect(processorNode);
            // processorNode will be connected to destination when recording starts

            recordingStatus.textContent = '録音の準備ができました';
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> 録音開始';

            return true;
        } catch (error) {
            console.error('Error initializing audio:', error);
            recordingStatus.innerHTML = `エラー: ${error.message || 'マイクへのアクセスが許可されていません'}`;
            recordingStatus.classList.add('text-danger');
            return false;
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

    // Set up event listeners
    recordButton.addEventListener('click', async () => {
        if (!audioContext) {
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