
# Voice Q&A Assistant (音声Q&Aアシスタント)

An interactive voice assistant that allows users to ask questions in Japanese and receive spoken responses. Built with Flask, Socket.IO, and OpenAI's APIs.

## Features

- Real-time voice input/output
- Speech-to-text using OpenAI Whisper
- Natural language processing with GPT-4o
- Text-to-speech using OpenAI TTS
- Responsive web interface

## Technical Stack

- Backend: Python/Flask
- WebSocket: Flask-SocketIO
- Frontend: HTML/CSS/JavaScript
- AI Services: OpenAI (Whisper, GPT-4o, TTS)

## Setup

1. Set environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SESSION_SECRET`: Secret key for Flask sessions

2. Install dependencies from pyproject.toml

3. Run the application:
   ```bash
   python main.py
   ```

The application will be available at port 5000.
