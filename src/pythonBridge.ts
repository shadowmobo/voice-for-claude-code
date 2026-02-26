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
     * Find the best Python path to use.
     */
    private findPythonPath(extensionPath: string): string {
        const config = vscode.workspace.getConfiguration('voiceInput');
        const configuredPath = config.get<string>('pythonPath');

        // If user configured a specific path, use it
        if (configuredPath && configuredPath !== 'python') {
            return configuredPath;
        }

        // Check for bundled venv in extension directory
        const fs = require('fs');
        const venvPaths = [
            path.join(extensionPath, 'python', 'venv', 'Scripts', 'python.exe'), // Windows
            path.join(extensionPath, 'python', 'venv', 'bin', 'python'), // Unix
            path.join(extensionPath, 'python', '.venv', 'Scripts', 'python.exe'), // Windows alt
            path.join(extensionPath, 'python', '.venv', 'bin', 'python'), // Unix alt
        ];

        for (const venvPath of venvPaths) {
            if (fs.existsSync(venvPath)) {
                console.log(`[Voice Input] Found bundled venv: ${venvPath}`);
                return venvPath;
            }
        }

        // Fall back to system Python
        return configuredPath || 'python';
    }

    /**
     * Start the Python backend process.
     */
    async start(extensionPath: string): Promise<void> {
        // Find the best Python path
        const pythonPath = this.findPythonPath(extensionPath);
        const scriptPath = path.join(extensionPath, 'python', 'main.py');

        console.log(`[Voice Input] Starting Python: ${pythonPath}`);
        console.log(`[Voice Input] Script path: ${scriptPath}`);

        // Create ready promise with timeout
        let readyReject: ((err: Error) => void) | null = null;
        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = resolve;
            readyReject = reject;
        });

        // Set timeout for ready signal (10 seconds)
        const timeoutId = setTimeout(() => {
            if (!this.isReady) {
                const err = new Error('Python backend timed out. Check Debug Console for errors.');
                if (readyReject) {
                    readyReject(err);
                }
                this.shutdown();
            }
        }, 10000);

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
                console.log('[Voice Input] Python stdout:', line);
                this.handleLine(line);
            });
        }

        // Handle stderr - log errors
        if (this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                console.error('[Voice Input Python stderr]', data.toString());
            });
        }

        // Handle process exit
        this.process.on('exit', (code, signal) => {
            console.log(`[Voice Input] Python process exited with code ${code}, signal ${signal}`);
            clearTimeout(timeoutId);
            this.isReady = false;
            this.process = null;

            // If we haven't received ready yet, reject the promise
            if (this.readyResolve && readyReject) {
                readyReject(new Error(`Python process exited unexpectedly (code: ${code})`));
            }
        });

        this.process.on('error', (err) => {
            console.error('[Voice Input] Failed to start Python process:', err);
            clearTimeout(timeoutId);
            if (readyReject) {
                readyReject(err);
            }
            this.messageHandler({
                type: 'error',
                message: `Failed to start Python: ${err.message}. Check voiceInput.pythonPath setting.`,
            });
        });

        // Wait for ready signal (with timeout)
        try {
            await this.readyPromise;
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
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
