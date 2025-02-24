import os
import logging
from flask import Flask, render_template, request, jsonify, send_file
from openai import OpenAI
import tempfile
import io

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")

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

        # Save speech to a temporary file
        audio_data = io.BytesIO(speech_response.content)
        audio_data.seek(0)

        return jsonify({
            'transcript': transcript.text,
            'response': answer,
            'audio_base64': speech_response.content.decode('latin1')  # Send binary data as base64
        })

    except Exception as e:
        logging.error(f"Error processing audio: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)