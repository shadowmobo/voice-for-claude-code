/**
 * Voice Input for Claude Code - VS Code Extension
 *
 * Enables voice-to-text input using local Whisper, optimized for Claude Code terminal.
 */

import * as vscode from 'vscode';
import { StatusBarManager, RecordingState } from './statusBar';
import { PythonBridge, PythonMessage } from './pythonBridge';
import { TerminalManager } from './terminalManager';
import { ConfigManager } from './config';

let statusBar: StatusBarManager;
let pythonBridge: PythonBridge;
let terminalManager: TerminalManager;
let currentState: RecordingState = 'idle';

/**
 * Handle messages from the Python backend.
 */
function handlePythonMessage(msg: PythonMessage): void {
    switch (msg.type) {
        case 'status':
            if (msg.state) {
                const stateMap: Record<string, RecordingState> = {
                    'idle': 'idle',
                    'recording': 'recording',
                    'processing': 'processing',
                };
                const newState = stateMap[msg.state] || 'idle';
                currentState = newState;
                statusBar.setState(newState);
            }
            break;

        case 'transcription':
            if (msg.text) {
                // Send transcribed text to terminal
                const success = terminalManager.sendToTerminal(msg.text);
                if (success) {
                    // Show brief success notification
                    vscode.window.setStatusBarMessage(
                        `Voice: "${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}"`,
                        3000
                    );
                }
            }
            break;

        case 'error':
            vscode.window.showErrorMessage(`Voice Input: ${msg.message}`);
            statusBar.showError('Error');
            currentState = 'idle';
            statusBar.setState('idle');
            break;

        case 'ready':
            console.log('[Voice Input] Python backend ready');
            break;
    }
}

/**
 * Toggle recording on/off.
 */
function toggleRecording(): void {
    if (currentState === 'idle') {
        pythonBridge.startRecording();
    } else if (currentState === 'recording') {
        pythonBridge.stopRecording();
    }
    // If processing, ignore - wait for completion
}

/**
 * Start recording.
 */
function startRecording(): void {
    if (currentState === 'idle') {
        pythonBridge.startRecording();
    } else if (currentState === 'recording') {
        vscode.window.showInformationMessage('Voice Input: Already recording');
    } else {
        vscode.window.showInformationMessage('Voice Input: Processing in progress, please wait');
    }
}

/**
 * Stop recording.
 */
function stopRecording(): void {
    if (currentState === 'recording') {
        pythonBridge.stopRecording();
    } else {
        vscode.window.showInformationMessage('Voice Input: Not currently recording');
    }
}

/**
 * Extension activation.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('[Voice Input] Activating extension...');

    // Initialize components
    statusBar = new StatusBarManager();
    terminalManager = new TerminalManager();
    pythonBridge = new PythonBridge(handlePythonMessage);

    // Register commands
    const toggleCommand = vscode.commands.registerCommand(
        'voiceInput.toggleRecording',
        toggleRecording
    );

    const startCommand = vscode.commands.registerCommand(
        'voiceInput.startRecording',
        startRecording
    );

    const stopCommand = vscode.commands.registerCommand(
        'voiceInput.stopRecording',
        stopRecording
    );

    // Add to subscriptions for cleanup
    context.subscriptions.push(
        statusBar,
        toggleCommand,
        startCommand,
        stopCommand
    );

    // Watch for config changes
    const configWatcher = ConfigManager.onConfigChange((config) => {
        // Send updated config to Python
        pythonBridge.sendConfig({
            model: config.whisperModel,
            language: config.language,
        });
    });
    context.subscriptions.push(configWatcher);

    // Start Python backend
    statusBar.setState('loading');
    try {
        await pythonBridge.start(context.extensionPath);
        statusBar.setState('idle');

        // Send initial config
        const config = ConfigManager.getConfig();
        pythonBridge.sendConfig({
            model: config.whisperModel,
            language: config.language,
        });

        vscode.window.setStatusBarMessage('Voice Input ready', 3000);
    } catch (error) {
        statusBar.setState('idle');
        statusBar.showError('Setup Error', 5000);

        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
            `Voice Input: Failed to start. ${message}. ` +
            'Make sure Python and Whisper are installed.'
        );
    }

    console.log('[Voice Input] Extension activated');
}

/**
 * Extension deactivation.
 */
export function deactivate(): void {
    console.log('[Voice Input] Deactivating extension...');
    pythonBridge?.shutdown();
}
