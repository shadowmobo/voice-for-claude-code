"""
Whisper transcriber module for Voice Input extension.
Handles local speech-to-text using OpenAI's Whisper model.
"""

import numpy as np
from typing import Optional
import warnings

# Suppress FP16 warnings on CPU
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")


class WhisperTranscriber:
    """
    Handles speech-to-text transcription using local Whisper model.
    Uses lazy loading to avoid slow startup times.
    """

    # Valid model sizes
    VALID_MODELS = ["tiny", "base", "small", "medium", "large"]

    def __init__(self, model_name: str = "base", language: Optional[str] = None):
        """
        Initialize the Whisper transcriber.

        Args:
            model_name: Model size - one of 'tiny', 'base', 'small', 'medium', 'large'.
                       Larger models are more accurate but slower and use more memory.
            language: Language code (e.g., 'en' for English).
                     None for auto-detection.
        """
        if model_name not in self.VALID_MODELS:
            raise ValueError(
                f"Invalid model name '{model_name}'. "
                f"Must be one of: {', '.join(self.VALID_MODELS)}"
            )

        self.model_name = model_name
        self.language = language
        self._model = None  # Lazy loaded

    @property
    def model(self):
        """
        Lazy load the Whisper model on first use.
        This avoids slow startup when the extension activates.
        """
        if self._model is None:
            import whisper

            self._model = whisper.load_model(self.model_name)
        return self._model

    def transcribe(self, audio: np.ndarray) -> str:
        """
        Transcribe audio to text.

        Args:
            audio: NumPy array of audio data (float32, 16kHz, mono).

        Returns:
            Transcribed text string.

        Raises:
            ValueError: If audio is empty or invalid format.
        """
        if audio is None or len(audio) == 0:
            raise ValueError("Audio data is empty")

        # Ensure correct dtype
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        # Ensure 1D array
        if len(audio.shape) > 1:
            audio = audio.flatten()

        # Build transcription options
        options = {
            "fp16": False,  # Use FP32 for CPU compatibility
        }

        if self.language:
            options["language"] = self.language

        # Transcribe
        result = self.model.transcribe(audio, **options)

        return result["text"].strip()

    def is_model_loaded(self) -> bool:
        """Check if the model has been loaded."""
        return self._model is not None

    def preload_model(self) -> None:
        """
        Preload the model to avoid delay on first transcription.
        Call this during initialization if fast first response is needed.
        """
        _ = self.model  # Trigger lazy load

    @staticmethod
    def check_whisper_available() -> bool:
        """Check if Whisper is properly installed (fast check without full import)."""
        import importlib.util
        return importlib.util.find_spec("whisper") is not None

    @staticmethod
    def check_ffmpeg_available() -> bool:
        """Check if FFmpeg is available (required by Whisper)."""
        import subprocess

        try:
            subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                check=True,
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
