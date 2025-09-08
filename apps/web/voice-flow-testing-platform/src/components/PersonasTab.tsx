import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, PlayIcon } from '@heroicons/react/24/outline';
import { apiService, Persona } from '../services/api';
import GeneratePersonaModal from './GeneratePersonaModal';

export default function PersonasTab() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPersonas();
      setPersonas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load personas');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaGenerated = (newPersona: Persona) => {
    setPersonas(prev => [newPersona, ...prev]);
    setShowModal(false);
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
      month: 'short',
      day: 'numeric',
    });
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
          onClick={loadPersonas}
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
        <h2 className="text-2xl font-bold text-gray-900">Personas</h2>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Generate Persona
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {personas.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No personas found. Generate your first persona to get started.
            </li>
          ) : (
            personas.map((persona) => (
              <li key={persona.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Link
                      to={`/personas/${persona.id}`}
                      className="block hover:bg-gray-50 -mx-6 -my-4 px-6 py-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {persona.full_name}
                          </h3>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <span>{persona.age} years old</span>
                            <span>{persona.gender}</span>
                          </div>
                          <div className="mt-2">
                            <div className="text-sm text-gray-900">
                              <strong>Debt:</strong> {formatCurrency(persona.debt_amount)}
                            </div>
                            <div className="text-sm text-gray-500">
                              <strong>Due:</strong> {formatDate(persona.due_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                  <div className="ml-4">
                    <Link
                      to={`/live-test/${persona.id}`}
                      className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <PlayIcon className="h-4 w-4 mr-1" />
                      Start Test
                    </Link>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {showModal && (
        <GeneratePersonaModal
          onClose={() => setShowModal(false)}
          onPersonaGenerated={handlePersonaGenerated}
        />
      )}
    </div>
  );
}
