/**
 * Status bar manager for Voice Input extension.
 * Displays microphone button with visual state feedback.
 */

import * as vscode from 'vscode';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'loading';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private state: RecordingState = 'idle';

    constructor() {
        // Create status bar item on the right side
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'voiceInput.toggleRecording';
        this.updateDisplay();
        this.statusBarItem.show();
    }

    /**
     * Update the current recording state.
     */
    setState(state: RecordingState): void {
        this.state = state;
        this.updateDisplay();
    }

    /**
     * Get the current recording state.
     */
    getState(): RecordingState {
        return this.state;
    }

    /**
     * Update the status bar display based on current state.
     */
    private updateDisplay(): void {
        switch (this.state) {
            case 'idle':
                this.statusBarItem.text = '$(mic) Voice';
                this.statusBarItem.tooltip = 'Click to start voice recording (Ctrl+Shift+V)';
                this.statusBarItem.backgroundColor = undefined;
                break;

            case 'recording':
                this.statusBarItem.text = '$(primitive-dot) Recording...';
                this.statusBarItem.tooltip = 'Click to stop recording (Ctrl+Shift+V)';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                break;

            case 'processing':
                this.statusBarItem.text = '$(sync~spin) Processing...';
                this.statusBarItem.tooltip = 'Transcribing audio with Whisper...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                break;

            case 'loading':
                this.statusBarItem.text = '$(sync~spin) Loading...';
                this.statusBarItem.tooltip = 'Loading Whisper model...';
                this.statusBarItem.backgroundColor = undefined;
                break;
        }
    }

    /**
     * Show an error state temporarily.
     */
    showError(message: string, durationMs: number = 3000): void {
        const previousState = this.state;
        this.statusBarItem.text = `$(error) ${message}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
            'statusBarItem.errorBackground'
        );

        setTimeout(() => {
            this.setState(previousState);
        }, durationMs);
    }

    /**
     * Dispose of the status bar item.
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}
