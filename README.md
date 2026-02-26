# Voice Input for Claude Code

A VS Code extension that enables voice-to-text input using local OpenAI Whisper, optimized for use with Claude Code terminal.

## Features

- **Voice Recording**: Click the microphone button or press `Ctrl+Shift+V` to start/stop recording
- **Local Transcription**: Uses OpenAI Whisper running locally - no cloud API needed, works offline
- **Terminal Integration**: Transcribed text is sent directly to your terminal (prioritizes Claude Code terminals)
- **Review Before Execute**: Text is inserted without pressing Enter, allowing you to review before execution

## Requirements

### System Requirements

- **Windows 10/11** (primary supported platform)
- **Python 3.8-3.11** (Python 3.12+ may have compatibility issues)
- **FFmpeg** installed and in PATH
- **VS Code 1.85+**
- **1-10GB RAM** depending on Whisper model size

### Installing FFmpeg

FFmpeg is required by Whisper for audio processing.

**Option 1: Chocolatey (recommended)**
```powershell
choco install ffmpeg
```

**Option 2: Winget**
```powershell
winget install ffmpeg
```

**Option 3: Manual**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.

### Installing Python Dependencies

1. Create a virtual environment (recommended):
   ```powershell
   cd path\to\extension\python
   python -m venv venv
   .\venv\Scripts\Activate
   ```

2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

   This installs:
   - `openai-whisper` - OpenAI's speech recognition model
   - `sounddevice` - Audio recording library
   - `numpy` - Numerical computing

## Installation

### From VSIX Package

1. Download the `.vsix` file
2. In VS Code, press `Ctrl+Shift+P` and run "Extensions: Install from VSIX..."
3. Select the downloaded file

### From Source (Development)

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build
4. Press F5 to launch the extension in debug mode

## Usage

### Basic Workflow

1. **Start Recording**: Click the microphone button in the status bar OR press `Ctrl+Shift+V`
2. **Speak**: Dictate your instructions or notes
3. **Stop Recording**: Click the button again OR press `Ctrl+Shift+V`
4. **Review**: The transcribed text appears in your terminal (without pressing Enter)
5. **Execute**: Press Enter to run the command, or edit first if needed

### Status Bar States

| State | Icon | Description |
|-------|------|-------------|
| Idle | `$(mic) Voice` | Ready to record |
| Recording | `$(primitive-dot) Recording...` | Actively recording (red background) |
| Processing | `$(sync~spin) Processing...` | Transcribing audio |

### Keyboard Shortcut

- **Toggle Recording**: `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac)

## Configuration

Open VS Code Settings and search for "Voice Input" or add to `settings.json`:

```json
{
  "voiceInput.pythonPath": "python",
  "voiceInput.whisperModel": "base",
  "voiceInput.language": ""
}
```

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `voiceInput.pythonPath` | `python` | Path to Python interpreter with Whisper installed |
| `voiceInput.whisperModel` | `base` | Whisper model size: `tiny`, `base`, `small`, `medium`, `large` |
| `voiceInput.language` | (empty) | Language code (e.g., `en`). Empty for auto-detect |

### Model Sizes

| Model | RAM Usage | Speed | Accuracy |
|-------|-----------|-------|----------|
| `tiny` | ~1GB | Fastest | Basic |
| `base` | ~1GB | Fast | Good |
| `small` | ~2GB | Medium | Better |
| `medium` | ~5GB | Slow | High |
| `large` | ~10GB | Slowest | Best |

## Troubleshooting

### "Failed to start Python"
- Verify Python is installed: `python --version`
- Check the `voiceInput.pythonPath` setting
- Ensure Whisper is installed: `pip list | findstr whisper`

### "FFmpeg not found"
- Install FFmpeg using one of the methods above
- Verify it's in PATH: `ffmpeg -version`
- Restart VS Code after installation

### "No microphone detected"
- Check Windows audio settings
- Ensure microphone permissions are granted to VS Code
- Try selecting a different default input device

### First transcription is slow
- This is normal - Whisper loads the model on first use
- Subsequent transcriptions are faster
- Consider using the `tiny` or `base` model for speed

## Security

This extension uses only reputable, well-audited dependencies:

- **openai-whisper**: Official OpenAI package
- **sounddevice**: Established audio library
- **numpy**: Foundation Python package

All dependencies are scanned using:
- npm audit
- pip-audit
- Snyk (optional)
- Socket.dev (optional)

See `.github/workflows/security-scan.yml` for the CI/CD security pipeline.

## Development

### Building

```bash
npm install
npm run compile
```

### Watching for Changes

```bash
npm run watch
```

### Linting

```bash
npm run lint
```

### Running Security Scans

```bash
npm run security:npm
pip-audit -r python/requirements.txt
```

## License

MIT

## Credits

- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition
- [python-sounddevice](https://github.com/spatialaudio/python-sounddevice) - Audio recording
