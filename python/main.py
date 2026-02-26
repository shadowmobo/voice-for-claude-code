"""
Main entry point for the Voice Input Python backend.
Handles JSON message communication with the VS Code extension.
"""

import sys
import json
from typing import Any

from audio_recorder import AudioRecorder
from transcriber import WhisperTranscriber


def send_message(msg_type: str, **kwargs: Any) -> None:
    """
    Send a JSON message to the VS Code extension via stdout.

    Args:
        msg_type: Type of message (status, transcription, error, ready).
        **kwargs: Additional fields to include in the message.
    """
    message = {"type": msg_type, **kwargs}
    print(json.dumps(message), flush=True)


def handle_start_recording(recorder: AudioRecorder) -> None:
    """Handle start_recording command."""
    try:
        recorder.start_recording()
        send_message("status", state="recording")
    except RuntimeError as e:
        send_message("error", message=f"Failed to start recording: {e}")
    except Exception as e:
        send_message("error", message=f"Microphone error: {e}")


def handle_stop_recording(
    recorder: AudioRecorder,
    transcriber: WhisperTranscriber,
) -> None:
    """Handle stop_recording command."""
    send_message("status", state="processing")

    try:
        audio = recorder.stop_recording()

        if audio is None or len(audio) == 0:
            send_message("error", message="No audio recorded")
            send_message("status", state="idle")
            return

        # Transcribe the audio
        text = transcriber.transcribe(audio)

        if text:
            send_message("transcription", text=text)
        else:
            send_message("error", message="Transcription returned empty text")

    except Exception as e:
        send_message("error", message=f"Transcription error: {e}")

    send_message("status", state="idle")


def handle_config(transcriber: WhisperTranscriber, config: dict) -> None:
    """Handle config update command."""
    try:
        model = config.get("model")
        language = config.get("language")

        if model and model != transcriber.model_name:
            # Model change requires creating a new transcriber
            # This will be handled by restarting the process
            send_message(
                "error",
                message="Model change requires restart. Please reload VS Code.",
            )
            return

        if language is not None:
            transcriber.language = language if language else None

        send_message("status", state="configured")
    except Exception as e:
        send_message("error", message=f"Config error: {e}")


def check_dependencies() -> list[str]:
    """Check if all dependencies are available."""
    issues = []

    # Check Whisper
    if not WhisperTranscriber.check_whisper_available():
        issues.append("Whisper not installed. Run: pip install openai-whisper")

    # Check FFmpeg
    if not WhisperTranscriber.check_ffmpeg_available():
        issues.append("FFmpeg not found. Install FFmpeg and add to PATH.")

    # Check microphone
    if not AudioRecorder.check_microphone_available():
        issues.append("No microphone detected. Check audio input settings.")

    return issues


def main() -> None:
    """Main entry point - message loop."""
    # Get configuration from environment or use defaults
    model_name = "base"
    language = None

    # Initialize components (transcriber uses lazy model loading)
    recorder = AudioRecorder()
    transcriber = WhisperTranscriber(model_name=model_name, language=language)

    # Signal ready FIRST - before slow dependency checks
    send_message("ready")

    # Check dependencies after ready (non-blocking for extension)
    issues = check_dependencies()
    if issues:
        for issue in issues:
            send_message("error", message=issue)
        # Continue anyway - some issues may be recoverable

    # Main message loop - read JSON commands from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
            msg_type = msg.get("type", "")

            if msg_type == "start_recording":
                handle_start_recording(recorder)

            elif msg_type == "stop_recording":
                handle_stop_recording(recorder, transcriber)

            elif msg_type == "config":
                handle_config(transcriber, msg.get("config", {}))

            elif msg_type == "ping":
                send_message("pong")

            elif msg_type == "shutdown":
                break

            else:
                send_message("error", message=f"Unknown command: {msg_type}")

        except json.JSONDecodeError as e:
            send_message("error", message=f"Invalid JSON: {e}")
        except Exception as e:
            send_message("error", message=f"Unexpected error: {e}")

    # Clean shutdown
    if recorder.is_recording():
        recorder.stop_recording()

    sys.exit(0)


if __name__ == "__main__":
    main()
