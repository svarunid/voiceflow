import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, UserIcon, CpuChipIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { apiService, TestRun, Persona } from '../services/api';

export default function TestDetail() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestRun | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [improveMessage, setImproveMessage] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadTestDetail(parseInt(id));
    }
  }, [id]);

  const loadTestDetail = async (testId: number) => {
    try {
      setLoading(true);
      // Fetch all tests and personas to find the specific ones
      const [allTests, allPersonas] = await Promise.all([
        apiService.getTests(),
        apiService.getPersonas()
      ]);
      
      const foundTest = allTests.find(t => t.id === testId);
      if (!foundTest) {
        throw new Error('Test not found');
      }
      
      const foundPersona = allPersonas.find(p => p.id === foundTest.persona_id);
      
      setTest(foundTest);
      setPersona(foundPersona || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test details');
    } finally {
      setLoading(false);
    }
  };

  const getTestStatus = (test: TestRun) => {
    if (!test.metric || !test.feedback) {
      return { status: 'pending', label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    }
    
    const politeness = test.metric.politeness;
    const negotiation = test.metric.negotiation_level;
    
    if (politeness === 'polite' && negotiation !== 'hard') {
      return { status: 'passed', label: 'Passed', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
    
    return { status: 'failed', label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const formatMetricValue = (value: string) => {
    return value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleImprovePrompt = async () => {
    if (!test) return;
    
    try {
      setImprovingPrompt(true);
      setImproveError(null);
      setImproveMessage(null);
      
      const response = await apiService.improvePrompt({ test_run_id: test.id });
      
      if (response.success) {
        setImproveMessage(response.message);
      } else {
        setImproveError('Failed to improve prompt');
      }
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : 'Failed to improve prompt');
    } finally {
      setImprovingPrompt(false);
    }
  };

  // Check if improve prompt button should be enabled
  const canImprovePrompt = test && test.metric && test.feedback && 
    (getTestStatus(test).status === 'failed');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-700">{error || 'Test not found'}</div>
        <Link
          to="/tests"
          className="mt-2 inline-flex items-center text-indigo-600 hover:text-indigo-500"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Tests
        </Link>
      </div>
    );
  }

  const testStatus = getTestStatus(test);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/tests"
            className="text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {test.name || `Test #${test.id}`}
            </h1>
            <p className="text-sm text-gray-500">
              {persona ? `Testing ${persona.full_name}` : 'Persona data not available'}
            </p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${testStatus.color} ${testStatus.bgColor}`}>
          {testStatus.label}
        </div>
      </div>

      {/* Test Overview */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Test Overview</h2>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {persona && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Persona Information</h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Name:</span>{' '}
                    <Link 
                      to={`/personas/${persona.id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      {persona.full_name}
                    </Link>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">Age:</span>{' '}
                    <span className="text-sm text-gray-700">{persona.age} years old</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">Debt:</span>{' '}
                    <span className="text-sm text-gray-700">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                      }).format(persona.debt_amount)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-500">Test Metrics</h3>
              <div className="mt-2 space-y-2">
                {test.metric ? (
                  <>
                    {test.metric.politeness && (
                      <div>
                        <span className="text-sm font-medium text-gray-900">Politeness:</span>{' '}
                        <span className="text-sm text-gray-700">
                          {formatMetricValue(test.metric.politeness)}
                        </span>
                      </div>
                    )}
                    {test.metric.negotiation_level && (
                      <div>
                        <span className="text-sm font-medium text-gray-900">Negotiation Level:</span>{' '}
                        <span className="text-sm text-gray-700">
                          {formatMetricValue(test.metric.negotiation_level)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Metrics not yet available</div>
                )}
                {test.prompt_version && (
                  <div>
                    <span className="text-sm font-medium text-gray-900">Prompt Version:</span>{' '}
                    <span className="text-sm text-gray-700 font-mono">
                      {test.prompt_version}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Conversation</h2>
        </div>
        <div className="px-6 py-4">
          {test.conversation && test.conversation.length > 0 ? (
            <div className="space-y-4">
              {test.conversation.map((entry, index) => {
                // Handle original format: [{"agent": "message"}, {"persona": "message"}]
                if ('agent' in entry) {
                  return (
                    <div key={index} className="flex justify-end">
                      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-500 text-white">
                        <div className="flex items-center space-x-2 mb-1">
                          <CpuChipIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">Agent</span>
                        </div>
                        <p className="text-sm">{entry.agent}</p>
                      </div>
                    </div>
                  );
                } else if ('persona' in entry) {
                  return (
                    <div key={index} className="flex justify-start">
                      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 text-gray-900">
                        <div className="flex items-center space-x-2 mb-1">
                          <UserIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">Persona</span>
                        </div>
                        <p className="text-sm">{entry.persona}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No conversation data available
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {test.feedback && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">AI Feedback</h2>
          </div>
          <div className="px-6 py-4">
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {test.feedback}
            </div>
          </div>
        </div>
      )}

      {/* Improve Prompt Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Prompt Improvement</h2>
        </div>
        <div className="px-6 py-4">
          {canImprovePrompt ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This test failed and has feedback available. You can use this data to improve the prompt automatically.
              </p>
              <button
                onClick={handleImprovePrompt}
                disabled={improvingPrompt}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SparklesIcon className="h-4 w-4 mr-2" />
                {improvingPrompt ? 'Improving Prompt...' : 'Improve Prompt'}
              </button>
              
              {/* Success Message */}
              {improveMessage && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="text-green-700 text-sm">{improveMessage}</div>
                </div>
              )}
              
              {/* Error Message */}
              {improveError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-red-700 text-sm">{improveError}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {!test.metric || !test.feedback ? (
                'Prompt improvement is only available for tests with metrics and feedback.'
              ) : getTestStatus(test).status !== 'failed' ? (
                'Prompt improvement is only available for failed tests.'
              ) : (
                'No improvement available for this test.'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
