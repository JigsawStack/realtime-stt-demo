// server.ts
import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { JigsawStack } from "jigsawstack";
import { randomUUID } from "crypto";
import { Blob } from "buffer";

const jigsaw = JigsawStack({
  apiKey: process.env.JIGSAWSTACK_API_KEY!,
});

type SttRealtimeConfig = {
  language?: string;
  encoding?: "webm_opus" | "webm" | "pcm16" | "wav";
  sampleRate?: number;
  interimResults?: boolean;
  model?: string;
  diarization?: boolean;
  profanityFilter?: boolean;
  punctuation?: boolean;
  format?: "text" | "json";
};

type ClientConfigMessage = {
  type: "config";
  config: SttRealtimeConfig;
};

type ClientStopMessage = {
  type: "stop";
};

type ServerReadyMessage = {
  type: "ready";
  sessionId: string;
};

type ServerTranscriptionMessage = {
  type: "partial" | "final";
  text?: string;
  result?: any;
};

type ServerErrorMessage = {
  type: "error";
  error: string;
};

type SessionState = {
  id: string;
  ws: WebSocket;
  config: SttRealtimeConfig;
  chunks: Buffer[];
  isTranscribing: boolean;
  lastText: string;
};

const PORT = Number(process.env.PORT || 8080);

const wss = new WebSocketServer({
  port: PORT,
  path: "/ws/stt",
});

console.log(`🔊 STT WebSocket server listening on ws://localhost:${PORT}/ws/stt`);

wss.on("connection", (ws: WebSocket) => {
  const session: SessionState = {
    id: randomUUID(),
    ws,
    config: {},
    chunks: [],
    isTranscribing: false,
    lastText: "",
  };

  console.log(`⚡ New STT session: ${session.id}`);

  ws.on("message", async (data, isBinary) => {
    try {
      if (!isBinary) {
        const msg = JSON.parse(data.toString());

        if (msg.type === "config") {
          const cfgMsg = msg as ClientConfigMessage;
          session.config = cfgMsg.config || {};

          // Accept WebM and WAV encoding
          const validEncodings = ["webm", "webm_opus", "wav", "pcm16"];
          if (session.config.encoding && !validEncodings.includes(session.config.encoding)) {
            const errorMsg: ServerErrorMessage = {
              type: "error",
              error: `Encoding '${session.config.encoding}' is not supported. Supported: ${validEncodings.join(", ")}`,
            };
            ws.send(JSON.stringify(errorMsg));
            ws.close();
            return;
          }

          const ready: ServerReadyMessage = {
            type: "ready",
            sessionId: session.id,
          };
          ws.send(JSON.stringify(ready));
        } else if (msg.type === "stop") {
          const stopMsg = msg as ClientStopMessage;
          console.log(`🛑 Stop received for session ${session.id}`);
          // No need to transcribe on stop - all audio already transcribed
        }
      } else {
        // Binary audio - this is a complete WebM file from the client
        // Don't accumulate - transcribe immediately
        if (!session.isTranscribing) {
          const audioBuffer = Buffer.from(data as Buffer);
          await transcribeAudio(session, audioBuffer, false);
        }
      }
    } catch (err) {
      console.error("WS message error:", err);
      const msg: ServerErrorMessage = {
        type: "error",
        error: (err as Error).message,
      };
      ws.send(JSON.stringify(msg));
    }
  });

  ws.on("close", () => {
    console.log(`👋 Session closed: ${session.id}`);
    session.chunks = [];
  });
});

async function transcribeAudio(
  session: SessionState,
  audioBuffer: Buffer,
  isFinal: boolean
) {
  session.isTranscribing = true;

  try {
    console.log(`🎤 Transcribing audio (${audioBuffer.length} bytes)`);

    // Determine MIME type from encoding config
    let mimeType = "audio/webm"; // default
    if (session.config.encoding === "wav" || session.config.encoding === "pcm16") {
      mimeType = "audio/wav";
    } else if (session.config.encoding === "webm_opus") {
      mimeType = "audio/webm;codecs=opus";
    }

    const audioBlob = new Blob([audioBuffer], { type: mimeType });

    const sttParams: Record<string, any> = {};
    if (session.config.language) {
      sttParams.language = session.config.language;
    }

    const result = await jigsaw.audio.speech_to_text(audioBlob, sttParams);
    const text = result?.text ?? "";

    console.log(`✅ Transcription: "${text}"`);

    const msg: ServerTranscriptionMessage = {
      type: isFinal ? "final" : "partial",
      text: session.config.format === "json" ? undefined : text,
      result: session.config.format === "json" ? result : undefined,
    };

    const msgStr = JSON.stringify(msg);
    console.log(`📤 Sending to client:`, msgStr);
    session.ws.send(msgStr);
  } catch (err: any) {
    console.error("Transcription error:", err);
    const msg: ServerErrorMessage = {
      type: "error",
      error: err.message || "Transcription failed",
    };
    session.ws.send(JSON.stringify(msg));
  } finally {
    session.isTranscribing = false;
  }
}
