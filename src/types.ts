export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Populated when the assistant turn failed; renders inline as an error bubble. */
  error?: string;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Per-chat override; falls back to global settings when undefined. */
  model?: string;
  systemPrompt?: string;
}

export interface Provider {
  id: string;
  name: string;
  /** Base URL up to and including /v1, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface Settings {
  providers: Provider[];
  activeProviderId: string | null;
  temperature: number;
  maxTokens: number | null;
  systemPrompt: string;
  theme: 'light' | 'dark' | 'system';
  streaming: boolean;
  sendOnEnter: boolean;
}

export interface ModelInfo {
  id: string;
  owned_by?: string;
}

/** Wire format for the OpenAI-compatible chat completions endpoint. */
export interface ChatCompletionMessage {
  role: Role;
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface StreamDelta {
  choices?: Array<{
    delta?: { content?: string; role?: Role };
    finish_reason?: string | null;
  }>;
}

export interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export const DEFAULT_SETTINGS: Settings = {
  providers: [],
  activeProviderId: null,
  temperature: 1,
  maxTokens: null,
  systemPrompt: '',
  theme: 'system',
  streaming: true,
  sendOnEnter: true,
};
