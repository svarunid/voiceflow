import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { CallStatus, ResolutionStatus } from '../types';
import { callsApi } from '../utils/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';

const CallsTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CallStatus | ''>('');
  const [phoneFilter, setPhoneFilter] = useState('');

  const limit = 20;
  const skip = (currentPage - 1) * limit;

  const { data: attempts, error } = useSWR(
    ['/api/calls/attempts', skip, statusFilter, phoneFilter],
    () => callsApi.getAttempts(
      skip,
      limit,
      statusFilter || undefined,
      phoneFilter || undefined
    ),
    { revalidateOnFocus: false }
  );

  const attemptsList = attempts || [];
  const handlePhoneSearch = useCallback((query: string) => {
    setPhoneFilter(query);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((status: CallStatus | '') => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

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

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load call attempts. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and search */}
      <div className="flex items-center space-x-4">
        <SearchBar
          placeholder="Search by phone number..."
          onSearch={handlePhoneSearch}
          className="w-80"
        />

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value as CallStatus | '')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="started">Started</option>
            <option value="dispatched">Dispatched</option>
            <option value="call_ended">Call Ended</option>
            <option value="failed">Failed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Call attempts table - Scrollable with fixed height */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
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
              {attemptsList.map((attempt) => {
                const { date, time } = formatTimestamp(attempt.started_at);
                return (
                  <tr key={attempt.attempt_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/contact/${attempt.contact_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {attempt.phone_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(attempt.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attempt.outcome ? (
                        <div className="space-y-1">
                          <div>
                            {getResolutionStatusBadge(attempt.outcome.resolution)}
                          </div>
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

          {attemptsList.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {statusFilter || phoneFilter
                  ? 'No call attempts match your filters.'
                  : 'No call attempts found.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        current_page={currentPage}
        onPageChange={setCurrentPage}
        hasNextPage={attemptsList.length >= limit}
      />

      {/* Summary stats */}
      {attemptsList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {(['started', 'dispatched', 'call_ended', 'failed', 'completed'] as CallStatus[]).map(status => {
            const count = attemptsList.filter(attempt => attempt.status === status).length;
            return (
              <div key={status} className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-sm text-gray-500 capitalize">
                  {status.replace('_', ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallsTab;
