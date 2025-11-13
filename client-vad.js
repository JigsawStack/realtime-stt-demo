// client-vad.js - VAD-based real-time STT
import { MicVAD } from "@ricky0123/vad-web";

const ws = new WebSocket("ws://localhost:8080/ws/stt");

ws.addEventListener("open", async () => {
  updateStatus("Initializing VAD...");

  // Send config
  ws.send(
    JSON.stringify({
      type: "config",
      config: {
        language: "en",
        encoding: "webm",
        interimResults: true,
        format: "text",
      },
    })
  );

  const vad = await MicVAD.new({
    onSpeechEnd: (audio) => {
      const audioBlob = convertToWebM(audio);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(audioBlob);
      }
    },
    onVADMisfire: () => {
      // Ignore misfires
    },
  });

  vad.start();
  updateStatus("Listening... Speak now!");

  window.stopRealtimeStt = () => {
    vad.pause();
    updateStatus("Stopped");
  };
});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "ready") {
    // Session ready
  } else if (msg.type === "partial") {
    updateTranscription(msg.text, false);
  } else if (msg.type === "final") {
    updateTranscription(msg.text, true);
  } else if (msg.type === "error") {
    console.error("Server error:", msg.error);
    updateStatus("Error: " + msg.error);
  }
});

ws.addEventListener("close", () => {
  updateStatus("WebSocket closed");
});

// Convert Float32Array audio to WebM Blob
function convertToWebM(float32Audio) {
  // Create AudioContext to encode to WebM
  const sampleRate = 16000;
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: sampleRate,
  });

  const audioBuffer = audioContext.createBuffer(
    1, // mono
    float32Audio.length,
    sampleRate
  );

  audioBuffer.copyToChannel(float32Audio, 0);

  // Use MediaRecorder to encode to WebM
  const mediaStream = audioContext.createMediaStreamDestination().stream;
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.createMediaStreamDestination());

  // For now, return the raw PCM data as a blob
  // JigsawStack can handle raw PCM
  const pcmBlob = new Blob([float32Audio], { type: "audio/pcm" });
  return pcmBlob;
}

function updateStatus(message) {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function updateTranscription(text, isFinal) {
  const transcriptionEl = document.getElementById("transcription");
  if (transcriptionEl) {
    if (isFinal) {
      const p = document.createElement("p");
      p.textContent = "[FINAL] " + text;
      p.style.fontWeight = "bold";
      transcriptionEl.appendChild(p);

      // Clear interim
      const interim = document.getElementById("interim");
      if (interim) {
        interim.remove();
      }
    } else {
      let interim = document.getElementById("interim");
      if (!interim) {
        interim = document.createElement("p");
        interim.id = "interim";
        interim.style.color = "#666";
        interim.style.fontStyle = "italic";
        transcriptionEl.appendChild(interim);
      }
      interim.textContent = "[INTERIM] " + text;
    }
    transcriptionEl.scrollTop = transcriptionEl.scrollHeight;
  }
}
