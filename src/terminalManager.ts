/**
 * Terminal manager for Voice Input extension.
 * Handles finding the appropriate terminal and sending transcribed text.
 */

import * as vscode from 'vscode';

export class TerminalManager {
    /**
     * Get the target terminal for text injection.
     * Prioritizes terminals with "Claude" in the name, falls back to active terminal.
     */
    getTargetTerminal(): vscode.Terminal | undefined {
        const terminals = vscode.window.terminals;

        if (terminals.length === 0) {
            return undefined;
        }

        // First, try to find a Claude Code terminal
        const claudeTerminal = terminals.find((t) =>
            t.name.toLowerCase().includes('claude')
        );

        if (claudeTerminal) {
            return claudeTerminal;
        }

        // Then try to find any terminal with common shell names
        // that might be running Claude Code
        const shellTerminal = terminals.find((t) => {
            const name = t.name.toLowerCase();
            return (
                name.includes('powershell') ||
                name.includes('cmd') ||
                name.includes('bash') ||
                name.includes('zsh') ||
                name.includes('terminal')
            );
        });

        if (shellTerminal) {
            return shellTerminal;
        }

        // Fall back to active terminal
        if (vscode.window.activeTerminal) {
            return vscode.window.activeTerminal;
        }

        // Last resort: first terminal
        return terminals[0];
    }

    /**
     * Send transcribed text to the terminal.
     * Does NOT add a newline - user should review and press Enter.
     *
     * @param text The text to send to the terminal
     * @param addNewline Whether to add a newline (execute). Default false.
     * @returns true if text was sent successfully
     */
    sendToTerminal(text: string, addNewline: boolean = false): boolean {
        const terminal = this.getTargetTerminal();

        if (!terminal) {
            vscode.window.showWarningMessage(
                'Voice Input: No terminal found. Please open a terminal first.'
            );
            return false;
        }

        // Send text to terminal
        // Second parameter: addNewline - if false, text is typed but not executed
        terminal.sendText(text, addNewline);

        // Show the terminal but keep focus where it was
        terminal.show(true); // preserveFocus = true

        return true;
    }

    /**
     * Send text to terminal and execute (press Enter).
     */
    sendAndExecute(text: string): boolean {
        return this.sendToTerminal(text, true);
    }

    /**
     * Create a new terminal if none exists.
     */
    ensureTerminal(): vscode.Terminal {
        if (vscode.window.terminals.length === 0) {
            return vscode.window.createTerminal('Voice Input');
        }
        return this.getTargetTerminal()!;
    }

    /**
     * Get information about available terminals.
     */
    getTerminalInfo(): { name: string; isActive: boolean }[] {
        return vscode.window.terminals.map((t) => ({
            name: t.name,
            isActive: t === vscode.window.activeTerminal,
        }));
    }
}
