/**
 * Python bridge for Voice Input extension.
 * Manages communication with the Python backend via JSON over stdio.
 */

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Message types received from Python backend.
 */
export interface PythonMessage {
    type: 'status' | 'transcription' | 'error' | 'ready' | 'pong';
    text?: string;
    state?: 'idle' | 'recording' | 'processing' | 'configured';
    message?: string;
}

/**
 * Callback type for handling messages from Python.
 */
export type MessageHandler = (msg: PythonMessage) => void;

export class PythonBridge {
    private process: ChildProcess | null = null;
    private messageHandler: MessageHandler;
    private isReady: boolean = false;
    private readyPromise: Promise<void> | null = null;
    private readyResolve: (() => void) | null = null;

    constructor(messageHandler: MessageHandler) {
        this.messageHandler = messageHandler;
    }

    /**
     * Start the Python backend process.
     */
    async start(extensionPath: string): Promise<void> {
        // Get Python path from settings
        const config = vscode.workspace.getConfiguration('voiceInput');
        const pythonPath = config.get<string>('pythonPath') || 'python';
        const scriptPath = path.join(extensionPath, 'python', 'main.py');

        // Create ready promise
        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = resolve;
        });

        // Spawn Python process
        this.process = spawn(pythonPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.join(extensionPath, 'python'),
        });

        // Handle stdout - parse JSON messages
        if (this.process.stdout) {
            const rl = readline.createInterface({
                input: this.process.stdout,
                crlfDelay: Infinity,
            });

            rl.on('line', (line) => {
                this.handleLine(line);
            });
        }

        // Handle stderr - log errors
        if (this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                console.error('[Voice Input Python]', data.toString());
            });
        }

        // Handle process exit
        this.process.on('exit', (code, signal) => {
            console.log(`[Voice Input] Python process exited with code ${code}, signal ${signal}`);
            this.isReady = false;
            this.process = null;
        });

        this.process.on('error', (err) => {
            console.error('[Voice Input] Failed to start Python process:', err);
            this.messageHandler({
                type: 'error',
                message: `Failed to start Python: ${err.message}. Check voiceInput.pythonPath setting.`,
            });
        });

        // Wait for ready signal
        await this.readyPromise;
    }

    /**
     * Handle a line of output from Python.
     */
    private handleLine(line: string): void {
        try {
            const msg = JSON.parse(line) as PythonMessage;

            // Handle ready signal
            if (msg.type === 'ready') {
                this.isReady = true;
                if (this.readyResolve) {
                    this.readyResolve();
                    this.readyResolve = null;
                }
            }

            // Forward to message handler
            this.messageHandler(msg);
        } catch (e) {
            console.error('[Voice Input] Failed to parse Python message:', line, e);
        }
    }

    /**
     * Send a message to the Python backend.
     */
    private send(message: object): void {
        if (this.process?.stdin) {
            this.process.stdin.write(JSON.stringify(message) + '\n');
        } else {
            console.error('[Voice Input] Cannot send message - Python process not running');
        }
    }

    /**
     * Start recording audio.
     */
    startRecording(): void {
        if (!this.isReady) {
            this.messageHandler({
                type: 'error',
                message: 'Python backend not ready. Please wait...',
            });
            return;
        }
        this.send({ type: 'start_recording' });
    }

    /**
     * Stop recording and start transcription.
     */
    stopRecording(): void {
        this.send({ type: 'stop_recording' });
    }

    /**
     * Send configuration to Python backend.
     */
    sendConfig(config: { model?: string; language?: string }): void {
        this.send({ type: 'config', config });
    }

    /**
     * Ping the Python backend to check if it's alive.
     */
    ping(): void {
        this.send({ type: 'ping' });
    }

    /**
     * Check if the Python backend is ready.
     */
    isBackendReady(): boolean {
        return this.isReady;
    }

    /**
     * Shutdown the Python backend.
     */
    shutdown(): void {
        if (this.process) {
            this.send({ type: 'shutdown' });

            // Force kill after timeout
            setTimeout(() => {
                if (this.process) {
                    this.process.kill();
                    this.process = null;
                }
            }, 2000);
        }
        this.isReady = false;
    }
}
