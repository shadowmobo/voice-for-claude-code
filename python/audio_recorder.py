"""
Audio recorder module for Voice Input extension.
Uses sounddevice for cross-platform microphone recording.
"""

import numpy as np
import sounddevice as sd
from typing import Optional
import threading


class AudioRecorder:
    """
    Handles microphone audio recording using sounddevice.
    Records at 16kHz mono float32 format required by Whisper.
    """

    def __init__(self, sample_rate: int = 16000, channels: int = 1):
        """
        Initialize the audio recorder.

        Args:
            sample_rate: Audio sample rate in Hz. Whisper requires 16000.
            channels: Number of audio channels. Whisper requires 1 (mono).
        """
        self.sample_rate = sample_rate
        self.channels = channels
        self.recording = False
        self.audio_chunks: list[np.ndarray] = []
        self.stream: Optional[sd.InputStream] = None
        self._lock = threading.Lock()

    def _audio_callback(
        self,
        indata: np.ndarray,
        frames: int,
        time_info: dict,
        status: sd.CallbackFlags,
    ) -> None:
        """
        Callback function for audio stream.
        Accumulates audio data into chunks.
        """
        if status:
            # Log any stream errors (overflow, underflow)
            pass  # Status errors are handled silently for now

        with self._lock:
            if self.recording:
                # Copy the data to avoid reference issues
                self.audio_chunks.append(indata.copy())

    def start_recording(self) -> None:
        """
        Start recording audio from the default microphone.

        Raises:
            RuntimeError: If already recording.
            sd.PortAudioError: If no microphone is available.
        """
        if self.recording:
            raise RuntimeError("Already recording")

        with self._lock:
            self.audio_chunks = []
            self.recording = True

        # Create and start the input stream
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype=np.float32,
            callback=self._audio_callback,
        )
        self.stream.start()

    def stop_recording(self) -> Optional[np.ndarray]:
        """
        Stop recording and return the recorded audio.

        Returns:
            NumPy array of audio data (float32, mono, 16kHz),
            or None if no audio was recorded.
        """
        if not self.recording:
            return None

        # Stop the stream
        if self.stream is not None:
            self.stream.stop()
            self.stream.close()
            self.stream = None

        with self._lock:
            self.recording = False
            chunks = self.audio_chunks
            self.audio_chunks = []

        if not chunks:
            return None

        # Concatenate all chunks into a single array
        audio = np.concatenate(chunks, axis=0)

        # Flatten to 1D array (Whisper expects this)
        return audio.flatten()

    def is_recording(self) -> bool:
        """Check if currently recording."""
        return self.recording

    @staticmethod
    def get_default_device_info() -> dict:
        """Get information about the default input device."""
        try:
            device_info = sd.query_devices(kind='input')
            return {
                'name': device_info['name'],
                'sample_rate': device_info['default_samplerate'],
                'channels': device_info['max_input_channels'],
            }
        except Exception as e:
            return {'error': str(e)}

    @staticmethod
    def check_microphone_available() -> bool:
        """Check if a microphone is available."""
        try:
            sd.query_devices(kind='input')
            return True
        except sd.PortAudioError:
            return False
