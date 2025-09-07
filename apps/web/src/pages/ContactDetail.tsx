import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { contactsApi, callsApi } from '../utils/api';
import { CallStatus } from '../types';

const ContactDetail: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const { data: contact, error } = useSWR(
    contactId ? `/api/contacts/${contactId}` : null,
    () => contactId ? contactsApi.getContact(contactId) : null,
    { revalidateOnFocus: false }
  );

  const getStatusBadge = (status: CallStatus) => {
    const statusClasses = {
      started: 'bg-blue-100 text-blue-800',
      dispatched: 'bg-yellow-100 text-yellow-800',
      call_ended: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      completed: 'bg-green-100 text-green-800'
    };

    const statusLabels = {
      started: 'Started',
      dispatched: 'Dispatched',
      call_ended: 'Call Ended',
      failed: 'Failed',
      completed: 'Completed'
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClasses[status]}`}>
        {statusLabels[status]}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const handleInitiateCall = async () => {
    if (!contact) return;

    try {
      await callsApi.initiateCall(contact.contact_id.toString());
      alert('Call initiated successfully');
      // Optionally refresh the data
      window.location.reload();
    } catch (error) {
      alert('Failed to initiate call');
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load contact details. Please try again.</p>
        <button
          onClick={() => navigate('/contacts')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Contacts
        </button>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading contact details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link
              to="/contacts"
              className="text-gray-400 hover:text-gray-500"
            >
              Contacts
            </Link>
          </li>
          <li>
            <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </li>
          <li>
            <span className="text-gray-700 font-medium">
              {contact.full_name}
            </span>
          </li>
        </ol>
      </nav>

      {/* Contact Information Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {contact.full_name}
            </h1>
            <button
              onClick={handleInitiateCall}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>Initiate Call</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contact.phone_number}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Language</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">
                {contact.language}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Amount Due</dt>
              <dd className="mt-1 text-sm text-gray-900 font-semibold">
                ₹{contact.debt?.amount_due ? (contact.debt.amount_due / 100).toFixed(2) : '0.00'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Due Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contact.debt?.due_date ? new Date(contact.debt.due_date).toLocaleDateString() : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contact.debt?.status || 'N/A'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Call Attempts */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Call Attempts ({contact.call_attempts?.length || 0})
          </h2>
        </div>

        {contact.call_attempts && contact.call_attempts.length > 0 ? (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contact.call_attempts.map((attempt) => {
                  const { date, time } = formatTimestamp(attempt.started_at);
                  return (
                    <tr key={attempt.attempt_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{date}</div>
                          <div className="text-gray-500">{time}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(attempt.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {attempt.outcome ? (
                          <div className="space-y-1">
                            <div className="font-medium">
                              {attempt.outcome.resolution}
                            </div>
                            {attempt.outcome.description && (
                              <div className="text-xs text-gray-500">
                                {attempt.outcome.description}
                              </div>
                            )}
                            {attempt.outcome.promised_amount && (
                              <div className="text-xs text-gray-500">
                                Promised: ₹{(attempt.outcome.promised_amount / 100).toFixed(2)}
                                {attempt.outcome.promised_date && (
                                  <> by {new Date(attempt.outcome.promised_date).toLocaleDateString()}</>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/attempt/${attempt.attempt_id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No call attempts</h3>
            <p className="mt-1 text-sm text-gray-500">
              This contact hasn't been called yet.
            </p>
            <div className="mt-6">
              <button
                onClick={handleInitiateCall}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Make First Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactDetail;
