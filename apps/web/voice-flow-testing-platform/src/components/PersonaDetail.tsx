import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon } from '@heroicons/react/24/outline';
import { apiService, Persona, TestRun } from '../services/api';

export default function PersonaDetail() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [tests, setTests] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPersonaDetail(parseInt(id));
    }
  }, [id]);

  const loadPersonaDetail = async (personaId: number) => {
    try {
      setLoading(true);
      // Note: The API service needs to be extended to fetch persona by ID and related tests
      // For now, we'll fetch all personas and filter, and all tests and filter
      const [allPersonas, allTests] = await Promise.all([
        apiService.getPersonas(),
        apiService.getTests()
      ]);

      const foundPersona = allPersonas.find(p => p.id === personaId);
      const personaTests = allTests.filter(t => t.persona_id === personaId);

      if (!foundPersona) {
        throw new Error('Persona not found');
      }

      setPersona(foundPersona);
      setTests(personaTests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load persona details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-700">{error || 'Persona not found'}</div>
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
          <h1 className="text-2xl font-bold text-gray-900">{persona.full_name}</h1>
        </div>
        <Link
          to={`/live-test/${persona.id}`}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <PlayIcon className="h-4 w-4 mr-2" />
          Start New Test
        </Link>
      </div>

      {/* Persona Details */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Persona Details</h2>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Basic Information</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">Age:</span>{' '}
                  <span className="text-sm text-gray-700">{persona.age} years old</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900">Gender:</span>{' '}
                  <span className="text-sm text-gray-700">{persona.gender}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Debt Information</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">Amount:</span>{' '}
                  <span className="text-sm text-gray-700">{formatCurrency(persona.debt_amount)}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900">Due Date:</span>{' '}
                  <span className="text-sm text-gray-700">{formatDate(persona.due_date)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500">Description</h3>
            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
              {persona.description}
            </div>
          </div>
        </div>
      </div>

      {/* Test History */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Test History</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {tests.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No tests have been run for this persona yet.
            </div>
          ) : (
            tests.map((test) => {
              const testStatus = getTestStatus(test);
              return (
                <div key={test.id} className="px-6 py-4">
                  <Link
                    to={`/tests/${test.id}`}
                    className="block hover:bg-gray-50 -mx-6 -my-4 px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {test.name || `Test #${test.id}`}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {test.conversation ? `${test.conversation.length} messages` : 'No conversation data'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${testStatus.color}`}>
                          {testStatus.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
