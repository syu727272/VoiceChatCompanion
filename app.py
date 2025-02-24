import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from openai import OpenAI
import tempfile
import io
import base64
import eventlet

# Configure eventlet before importing any other modules
eventlet.monkey_patch()

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")
socketio = SocketIO(app, async_mode='eventlet')

# Initialize OpenAI client
# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process-audio', methods=['POST'])
def process_audio():
    try:
        # Get audio file from request
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({'error': 'No audio file received'}), 400

        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            audio_file.save(temp_audio.name)

            # Transcribe audio
            with open(temp_audio.name, 'rb') as audio:
                transcript = openai.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio
                )

        # Remove temporary file
        os.unlink(temp_audio.name)

        # Get response from GPT-4o
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant providing concise and informative answers."},
                {"role": "user", "content": transcript.text}
            ],
            max_tokens=150
        )

        answer = response.choices[0].message.content

        # Convert answer to speech
        speech_response = openai.audio.speech.create(
            model="tts-1",
            voice="shimmer",
            input=answer
        )

        # Convert binary audio data to base64
        audio_base64 = base64.b64encode(speech_response.content).decode('utf-8')

        return jsonify({
            'transcript': transcript.text,
            'response': answer,
            'audio_base64': audio_base64
        })

    except Exception as e:
        logging.error(f"Error processing audio: {str(e)}")
        return jsonify({'error': str(e)}), 500

# WebSocket events for real-time voice chat
@socketio.on('stream-audio')
def handle_stream_audio(audio_data):
    try:
        # Process the incoming audio stream
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            audio_bytes = base64.b64decode(audio_data)
            temp_audio.write(audio_bytes)
            temp_audio.flush()

            # Transcribe streaming audio
            with open(temp_audio.name, 'rb') as audio:
                transcript = openai.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio
                )

        # Remove temporary file
        os.unlink(temp_audio.name)

        # Get real-time response from GPT-4o
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant in a real-time voice chat."},
                {"role": "user", "content": transcript.text}
            ],
            max_tokens=50  # Shorter responses for real-time chat
        )

        answer = response.choices[0].message.content

        # Convert answer to speech
        speech_response = openai.audio.speech.create(
            model="tts-1",
            voice="shimmer",
            input=answer
        )

        # Send the response back through WebSocket
        audio_base64 = base64.b64encode(speech_response.content).decode('utf-8')
        emit('stream-response', {
            'transcript': transcript.text,
            'response': answer,
            'audio_base64': audio_base64
        })

    except Exception as e:
        logging.error(f"Error in stream processing: {str(e)}")
        emit('stream-error', {'error': str(e)})

if __name__ == '__main__':
    # ALWAYS serve the app on port 5000
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, log_output=True)