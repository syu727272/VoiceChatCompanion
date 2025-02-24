# Configure eventlet before importing any other modules
import eventlet
eventlet.monkey_patch()

import os
import logging
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from openai import OpenAI
import tempfile
import base64

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

# Initialize OpenAI client
# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

# WebSocket events for real-time voice chat
@socketio.on('stream-audio')
def handle_stream_audio(audio_data):
    try:
        # Process the incoming audio stream
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            audio_bytes = base64.b64decode(audio_data)
            temp_audio.write(audio_bytes)
            temp_audio.flush()

            # Transcribe audio using Whisper
            with open(temp_audio.name, 'rb') as audio:
                transcript = openai.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="text"
                )

            # Get response from GPT-4o
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant providing concise and informative answers."},
                    {"role": "user", "content": transcript}
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

        # Remove temporary file
        os.unlink(temp_audio.name)

        # Send the audio response back through WebSocket
        audio_base64 = base64.b64encode(speech_response.content).decode('utf-8')
        emit('stream-response', {
            'audio_base64': audio_base64
        })

    except Exception as e:
        logging.error(f"Error in stream processing: {str(e)}")
        emit('stream-error', {'error': str(e)})

if __name__ == '__main__':
    # ALWAYS serve the app on port 5000
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, log_output=True)