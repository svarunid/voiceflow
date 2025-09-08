import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { apiService, TestRun } from '../services/api';

export default function TestsTab() {
  const [tests, setTests] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTests();
      setTests(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const getTestStatus = (test: TestRun) => {
    if (!test.metric || !test.feedback) {
      return { status: 'pending', label: 'Pending', color: 'text-yellow-600' };
    }

    const politeness = test.metric.politeness;
    const negotiation = test.metric.negotiation_level;

    if (politeness === 'polite' && negotiation !== 'hard') {
      return { status: 'passed', label: 'Passed', color: 'text-green-600' };
    }

    return { status: 'failed', label: 'Failed', color: 'text-red-600' };
  };

  const formatMetric = (metric: TestRun['metric']) => {
    if (!metric) return 'N/A';

    const parts = [];
    if (metric.politeness) {
      parts.push(`Politeness: ${metric.politeness.replace('_', ' ')}`);
    }
    if (metric.negotiation_level) {
      parts.push(`Negotiation: ${metric.negotiation_level}`);
    }

    return parts.join(', ') || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-700">{error}</div>
        <button
          onClick={loadTests}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Test Results</h2>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {tests.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No tests found. Run your first test to see results here.
            </li>
          ) : (
            tests.map((test) => {
              const testStatus = getTestStatus(test);
              return (
                <li key={test.id}>
                  <Link
                    to={`/tests/${test.id}`}
                    className="block hover:bg-gray-50 px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900">
                            {test.name || `Test #${test.id}`}
                          </h3>
                          <div className="flex items-center space-x-2">
                            {testStatus.status === 'passed' ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            ) : testStatus.status === 'failed' ? (
                              <XCircleIcon className="h-5 w-5 text-red-600" />
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-yellow-400"></div>
                            )}
                            <span className={`text-sm font-medium ${testStatus.color}`}>
                              {testStatus.label}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          <div>Persona: {test.persona_name}</div>
                          <div className="mt-1">Metrics: {formatMetric(test.metric)}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
