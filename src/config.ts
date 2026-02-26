/**
 * Configuration management for Voice Input extension.
 */

import * as vscode from 'vscode';

export interface VoiceInputConfig {
    pythonPath: string;
    whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    language: string;
}

export class ConfigManager {
    private static readonly SECTION = 'voiceInput';

    /**
     * Get all Voice Input configuration.
     */
    static getConfig(): VoiceInputConfig {
        const config = vscode.workspace.getConfiguration(this.SECTION);

        return {
            pythonPath: config.get<string>('pythonPath') || 'python',
            whisperModel: config.get<VoiceInputConfig['whisperModel']>('whisperModel') || 'base',
            language: config.get<string>('language') || '',
        };
    }

    /**
     * Get Python path setting.
     */
    static getPythonPath(): string {
        return vscode.workspace
            .getConfiguration(this.SECTION)
            .get<string>('pythonPath') || 'python';
    }

    /**
     * Get Whisper model setting.
     */
    static getWhisperModel(): string {
        return vscode.workspace
            .getConfiguration(this.SECTION)
            .get<string>('whisperModel') || 'base';
    }

    /**
     * Get language setting.
     */
    static getLanguage(): string {
        return vscode.workspace
            .getConfiguration(this.SECTION)
            .get<string>('language') || '';
    }

    /**
     * Watch for configuration changes.
     */
    static onConfigChange(callback: (config: VoiceInputConfig) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(this.SECTION)) {
                callback(this.getConfig());
            }
        });
    }

    /**
     * Open the settings UI for this extension.
     */
    static openSettings(): void {
        vscode.commands.executeCommand(
            'workbench.action.openSettings',
            `@ext:voice-claude.voice-for-claude-code`
        );
    }
}
