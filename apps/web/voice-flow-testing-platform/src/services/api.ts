export interface Persona {
  id: number;
  full_name: string;
  age: number;
  gender: string;
  debt_amount: number;
  due_date: string;
  description: string;
}

export interface TestRun {
  id: number;
  name: string;
  persona_id: number;
  persona_name: string;
  conversation: Array<{ agent?: string; persona?: string }> | null;
  metric: { 
    politeness?: string; 
    negotiation_level?: string; 
  } | null;
  feedback: string | null;
  prompt_version: string | null;
}

export interface GeneratePersonaRequest {
  prompt: string;
}

export interface TestStartRequest {
  persona_id: number;
  iterations: number;
  name?: string;
}

export interface TestStartResponse {
  test_run_id: number;
  ws_url: string;
}

export interface PromptImproveRequest {
  test_run_id: number;
}

export interface PromptImproveResponse {
  success: boolean;
  new_version: string | null;
  message: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Personas
  async getPersonas(skip = 0, limit = 100): Promise<Persona[]> {
    return this.request(`/personas?skip=${skip}&limit=${limit}`);
  }

  async getPersona(id: number): Promise<Persona> {
    return this.request(`/personas/${id}`);
  }

  async generatePersona(request: GeneratePersonaRequest): Promise<Persona> {
    return this.request('/personas/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Tests
  async getTests(skip = 0, limit = 100): Promise<TestRun[]> {
    return this.request(`/tests?skip=${skip}&limit=${limit}`);
  }

  async getTest(id: number): Promise<TestRun> {
    return this.request(`/tests/${id}`);
  }

  async startTest(request: TestStartRequest): Promise<TestStartResponse> {
    return this.request('/tests/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async improvePrompt(request: PromptImproveRequest): Promise<PromptImproveResponse> {
    return this.request('/prompts/improve', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // WebSocket
  createWebSocket(testRunId: number): WebSocket {
    const wsUrl = API_BASE.replace('http', 'ws');
    return new WebSocket(`${wsUrl}/ws/tests/${testRunId}`);
  }
}

export const apiService = new ApiService();
