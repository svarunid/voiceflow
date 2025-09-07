import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { callsApi } from '../utils/api';
import { CallStatus, ResolutionStatus } from '../types';

const AttemptDetail: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const { data: attempt, error } = useSWR(
    attemptId ? `/api/calls/attempts/${attemptId}` : null,
    () => attemptId ? callsApi.getAttempt(attemptId) : null,
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
      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusClasses[status]}`}>
        {statusLabels[status]}
      </span>
    );
  };

  const getResolutionStatusBadge = (status: ResolutionStatus) => {
    const statusClasses: Record<ResolutionStatus, string> = {
      promise_to_pay: 'bg-green-100 text-green-800',
      extension: 'bg-yellow-100 text-yellow-800',
      dispute: 'bg-orange-100 text-orange-800',
      dnc: 'bg-red-100 text-red-800',
      wrong_number: 'bg-purple-100 text-purple-800',
      no_answer: 'bg-gray-100 text-gray-800'
    };

    const statusLabels: Record<ResolutionStatus, string> = {
      promise_to_pay: 'Promise to Pay',
      extension: 'Extension',
      dispute: 'Dispute',
      dnc: 'Do Not Call',
      wrong_number: 'Wrong Number',
      no_answer: 'No Answer'
    };

    return (
      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusClasses[status]}`}>
        {statusLabels[status]}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      full: date.toLocaleString(),
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load attempt details. Please try again.</p>
        <button
          onClick={() => navigate('/calls')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Calls
        </button>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading attempt details...</p>
      </div>
    );
  }

  const { full: fullTimestamp, date, time } = formatTimestamp(attempt.started_at);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link
              to="/calls"
              className="text-gray-400 hover:text-gray-500"
            >
              Calls
            </Link>
          </li>
          <li>
            <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </li>
          <li>
            <span className="text-gray-700 font-medium">
              Attempt Details
            </span>
          </li>
        </ol>
      </nav>

      {/* Attempt Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Call Attempt Details
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Attempt ID: {attempt.attempt_id}
              </p>
            </div>
            {getStatusBadge(attempt.status)}
          </div>
        </div>

        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
              <dd className="mt-1 text-lg text-gray-900 font-semibold">
                <Link
                  to={`/contact/${attempt.contact_id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {attempt.phone_number}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Call Status</dt>
              <dd className="mt-1">
                {getStatusBadge(attempt.status)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {date}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Time</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {time}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Full Timestamp</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {fullTimestamp}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Outcome Details */}
      {attempt.outcome ? (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Call Outcome
            </h2>
          </div>

          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Resolution Status</dt>
                <dd className="mt-1">
                  {getResolutionStatusBadge(attempt.outcome.resolution)}
                </dd>
              </div>

              {attempt.outcome.promised_amount && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Promised Amount</dt>
                  <dd className="mt-1 text-lg text-gray-900 font-semibold">
                    ₹{(attempt.outcome.promised_amount / 100).toFixed(2)}
                  </dd>
                </div>
              )}

              {attempt.outcome.promised_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Promised Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(attempt.outcome.promised_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {attempt.outcome.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <div className="bg-gray-50 rounded-md p-3">
                      {attempt.outcome.description}
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Call Outcome
            </h2>
          </div>

          <div className="px-6 py-4 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No outcome available</h3>
            <p className="mt-1 text-sm text-gray-500">
              This call attempt doesn't have outcome details yet.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => navigate('/calls')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Calls
        </button>

        <Link
          to={`/contact/${attempt.contact_id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          View Contact
        </Link>
      </div>

      {/* Status Timeline */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Call Status Timeline
          </h2>
        </div>

        <div className="px-6 py-4">
          <div className="flow-root">
            <ul className="-mb-8">
              <li className="relative pb-8">
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">Call initiated</span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {fullTimestamp}
                      </p>
                    </div>
                  </div>
                </div>
              </li>

              <li className="relative">
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ${attempt.status === 'completed' ? 'bg-green-500' :
                      attempt.status === 'failed' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}>
                      {attempt.status === 'completed' ? (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : attempt.status === 'failed' ? (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">
                          Current status: {attempt.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {attempt.outcome ? 'Call completed with outcome' : 'Call in progress or ended without detailed outcome'}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttemptDetail;
