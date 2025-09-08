import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon, StopIcon, UserIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { apiService, Persona } from '../services/api';

interface Message {
  role: string;
  content: string;
  timestamp?: number;
}

interface TestResults {
  metric: {
    politeness?: string;
    negotiation_level?: string;
  } | null;
  feedback: string | null;
}

export default function LiveTesting() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Test configuration
  const [testName, setTestName] = useState('');
  const [iterations, setIterations] = useState(6);
  const [testRunning, setTestRunning] = useState(false);

  // WebSocket and conversation
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [testCompleted, setTestCompleted] = useState(false);
  const [currentTestRunId, setCurrentTestRunId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (personaId) {
      loadPersona(parseInt(personaId));
    }
  }, [personaId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Cleanup WebSocket on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadPersona = async (id: number) => {
    try {
      setLoading(true);
      const allPersonas = await apiService.getPersonas();
      const foundPersona = allPersonas.find(p => p.id === id);

      if (!foundPersona) {
        throw new Error('Persona not found');
      }

      setPersona(foundPersona);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load persona');
    } finally {
      setLoading(false);
    }
  };

  const startTest = async () => {
    if (!persona || testRunning) return;

    try {
      setTestRunning(true);
      setMessages([]);
      setTestResults(null);
      setTestCompleted(false);
      setError(null);

      // Start the test
      const response = await apiService.startTest({
        persona_id: persona.id,
        iterations,
        name: testName
      });

      setCurrentTestRunId(response.test_run_id);

      // Connect to WebSocket
      const websocket = apiService.createWebSocket(response.test_run_id);
      setWs(websocket);

      websocket.onopen = () => {
        console.log('WebSocket connected');
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data);

          switch (data.type) {
            case 'start':
              setMessages(prev => [...prev, {
                role: 'system',
                content: `Test started for ${data.persona?.full_name}`,
                timestamp: Date.now()
              }]);
              break;

            case 'message':
              setMessages(prev => [...prev, {
                role: data.role,
                content: data.content,
                timestamp: Date.now()
              }]);
              break;

            case 'end':
              setTestResults({
                metric: data.metric,
                feedback: data.feedback
              });
              setTestCompleted(true);
              setTestRunning(false);
              setMessages(prev => [...prev, {
                role: 'system',
                content: 'Test completed!',
                timestamp: Date.now()
              }]);
              websocket.close();
              break;

            case 'error':
              setError(data.message);
              setTestRunning(false);
              setMessages(prev => [...prev, {
                role: 'system',
                content: `Error: ${data.message}`,
                timestamp: Date.now()
              }]);
              break;

            default:
              console.warn('Unknown message type:', data.type);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setTestRunning(false);
      };

      websocket.onclose = () => {
        console.log('WebSocket closed');
        setWs(null);
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start test');
      setTestRunning(false);
    }
  };

  const stopTest = () => {
    if (ws) {
      ws.close();
    }
    setTestRunning(false);
  };

  const viewTestDetails = () => {
    if (currentTestRunId) {
      navigate(`/tests/${currentTestRunId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error && !persona) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-700">{error}</div>
        <Link
          to="/personas"
          className="mt-2 inline-flex items-center text-indigo-600 hover:text-indigo-500"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Personas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/personas"
            className="text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Testing</h1>
            {persona && (
              <p className="text-sm text-gray-500">Testing {persona.full_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Test Configuration */}
      {!testRunning && !testCompleted && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Test Configuration</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="testName" className="block text-sm font-medium text-gray-700">
                Test Name (Optional)
              </label>
              <input
                type="text"
                id="testName"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter a name for this test..."
              />
            </div>
            <div>
              <label htmlFor="iterations" className="block text-sm font-medium text-gray-700">
                Number of Iterations
              </label>
              <select
                id="iterations"
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value={3}>3 turns</option>
                <option value={6}>6 turns</option>
                <option value={10}>10 turns</option>
                <option value={15}>15 turns</option>
              </select>
            </div>
            <button
              onClick={startTest}
              disabled={!persona}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayIcon className="h-4 w-4 mr-2" />
              Start Test
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-700">{error}</div>
        </div>
      )}

      {/* Live Conversation */}
      {(testRunning || messages.length > 0) && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Live Conversation</h2>
            {testRunning && (
              <button
                onClick={stopTest}
                className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
              >
                <StopIcon className="h-4 w-4 mr-2" />
                Stop Test
              </button>
            )}
          </div>
          <div className="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'agent' ? 'justify-end' :
                  message.role === 'system' ? 'justify-center' : 'justify-start'
                }`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === 'agent'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'system'
                      ? 'bg-gray-300 text-gray-700 text-sm'
                      : 'bg-white text-gray-900 shadow'
                  }`}>
                  {message.role !== 'system' && (
                    <div className="flex items-center space-x-2 mb-1">
                      {message.role === 'agent' ? (
                        <CpuChipIcon className="h-4 w-4" />
                      ) : (
                        <UserIcon className="h-4 w-4" />
                      )}
                      <span className="text-xs font-medium">
                        {message.role === 'agent' ? 'Agent' : 'Persona'}
                      </span>
                    </div>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            {testRunning && (
              <div className="flex justify-center">
                <div className="bg-gray-200 px-4 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-gray-600">Test in progress...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Test Results */}
      {testCompleted && testResults && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Test Results</h2>
            </div>
            <div className="px-6 py-4">
              {testResults.metric ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {testResults.metric.politeness && (
                    <div>
                      <span className="text-sm font-medium text-gray-900">Politeness:</span>{' '}
                      <span className="text-sm text-gray-700">
                        {testResults.metric.politeness.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {testResults.metric.negotiation_level && (
                    <div>
                      <span className="text-sm font-medium text-gray-900">Negotiation Level:</span>{' '}
                      <span className="text-sm text-gray-700">
                        {testResults.metric.negotiation_level}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No metrics available</div>
              )}
            </div>
          </div>

          {/* Feedback */}
          {testResults.feedback && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">AI Feedback</h2>
              </div>
              <div className="px-6 py-4">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {testResults.feedback}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              Run Another Test
            </button>
            {currentTestRunId && (
              <button
                onClick={viewTestDetails}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
              >
                View Full Details
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
