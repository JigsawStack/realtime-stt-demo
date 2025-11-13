# JigsawStack Real-Time Speech-to-Text

Real-time speech-to-text with Voice Activity Detection (VAD), powered by JigsawStack's STT API.

## Features

- **Voice Activity Detection**: Automatically detects when you start/stop speaking
- **Audio Accumulation**: Sends growing audio clips every 1s for evolving transcriptions
- **Real-time Waveform**: Visual feedback showing speech activity with gradient animation
- **Segment Management**: Finalizes segments after 3 seconds of silence
- **Modern UI**: Clean interface with final (black) and interim (gray italic) text display

## Setup

1. Install dependencies:
```bash
npm install or yarn install
```

2. Set your JigsawStack API key in `.env`:
```env
JIGSAWSTACK_API_KEY=your_api_key_here
```

3. Run both servers in separate terminals:

**Terminal 1: WebSocket Server (Port 8080)**
```bash
npm start or yarn start
```

**Terminal 2: HTTP Server (Port 3000)**
```bash
npm run start:http or yarn start:http
```

4. Open `http://localhost:3000/index.html` and allow microphone access

## How It Works

1. **VAD monitors audio energy levels** to detect speech
2. When speech starts, **audio is accumulated** in a buffer
3. Every 1 second, **accumulated audio is sent** for transcription
4. Transcriptions **evolve and improve** as more audio context is added
5. After **3 seconds of silence**, the segment is finalized
6. Process **restarts fresh** for the next speech segment

## Configuration

Edit the config in `index.html` (line 382):

```javascript
{
  language: "en",        // Language code
  encoding: "wav",       // Audio format (wav, webm, pcm16)
  interimResults: true,  // Show evolving transcriptions
  format: "text"         // Output format (text or json)
}
```

## Project Structure

- `server.ts` - WebSocket server handling STT requests
- `http-server.ts` - Serves the web interface
- `index-vad.html` - VAD-based client with waveform visualization
- `index.html` - Simple interval-based client (no VAD)

## Tech Stack

- JigsawStack STT API
- Web Audio API for VAD and PCM capture
- WebSockets for real-time communication
- TypeScript + Node.js
