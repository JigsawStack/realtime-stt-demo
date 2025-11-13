// client.js

const ws = new WebSocket("ws://localhost:8080/ws/stt"); // or ws://localhost:8080/ws/stt

let selectedMimeType = "";

ws.addEventListener("open", () => {
  startMicStreaming().catch((err) => {
    console.error("Mic error", err);
  });
});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "ready") {
    updateStatus("Session ready: " + msg.sessionId);
  } else if (msg.type === "partial" || msg.type === "final") {
    const text = msg.text ?? JSON.stringify(msg.result);
    addToTranscript(text);
  } else if (msg.type === "error") {
    console.error("Server error:", msg.error);
    updateStatus("Error: " + msg.error);
  }
});

ws.addEventListener("close", () => {
  updateStatus("WebSocket closed");
});

async function startMicStreaming() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Use WebM without codec specification - simpler and more compatible
  const mimeType = "audio/webm";

  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error(`WebM is not supported by this browser.`);
  }

  selectedMimeType = mimeType;

  // Send config now that we know the mime type
  const encoding = "webm";
  ws.send(
    JSON.stringify({
      type: "config",
      config: {
        language: "en",        // -> lang
        encoding: encoding,    // "wav" or "webm_opus"
        sampleRate: 48_000,    // for PCM paths if you add them later
        interimResults: true,  // ask server to stream partials
        diarization: false,    // future-proof, may be ignored
        profanityFilter: false,
        punctuation: true,
        format: "text",        // "text" | "json"
      },
    })
  );

  let recorder = new MediaRecorder(stream, { mimeType });
  let isRecording = true;

  const startRecording = () => {
    if (!isRecording) return;

    recorder = new MediaRecorder(stream, { mimeType });

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        // Send complete WebM file chunk
        ws.send(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      // Restart recording for next segment immediately
      if (isRecording) {
        setTimeout(startRecording, 50);
      }
    });

    // Record for 1.5 seconds, creating a complete WebM file
    recorder.start();
    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, 1500);
  };

  startRecording();

  window.stopRealtimeStt = () => {
    isRecording = false;
    if (recorder.state === "recording") {
      recorder.stop();
    }
    stream.getTracks().forEach((t) => t.stop());
    updateStatus("Recording stopped");
  };

  updateStatus("Recording... Click 'Stop Recording' to stop");
}

// Helper functions to update the UI
function updateStatus(message) {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function addToTranscript(text) {
  const transcriptionEl = document.getElementById("transcription");
  if (!transcriptionEl) return;

  // Skip empty transcriptions
  if (!text || text.trim() === "") return;

  // Add each segment as a new line to build ongoing transcript
  const segment = document.createElement("span");
  segment.textContent = text + " ";
  segment.style.display = "inline";

  transcriptionEl.appendChild(segment);

  // Auto-scroll to bottom
  transcriptionEl.scrollTop = transcriptionEl.scrollHeight;
}
