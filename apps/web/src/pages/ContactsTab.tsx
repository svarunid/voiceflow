import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { ContactFormData, ContactCreate } from '../types';
import { contactsApi, callsApi } from '../utils/api';
import SearchBar from '../components/SearchBar';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const ContactsTab: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const limit = 20;
  const skip = (currentPage - 1) * limit;

  // Separate data fetching for normal contacts and search results
  const { data: contactsData, error: contactsError, mutate: mutateContacts } = useSWR(
    searchQuery ? null : ['/api/contacts', skip, limit],
    () => searchQuery ? null : contactsApi.getContacts(skip, limit),
    { revalidateOnFocus: false }
  );

  const { data: searchData, error: searchError, mutate: mutateSearch } = useSWR(
    searchQuery ? ['/api/contacts/search', searchQuery, skip, limit] : null,
    () => searchQuery ? contactsApi.searchContacts(searchQuery, skip, limit) : null,
    { revalidateOnFocus: false }
  );

  // Use search data when searching, otherwise use regular contacts data
  const contacts = searchQuery ? (searchData || []) : (contactsData || []);
  const error = searchQuery ? searchError : contactsError;


  // Unified mutate function that refreshes both datasets
  const mutate = useCallback(() => {
    mutateContacts();
    if (searchQuery) {
      mutateSearch();
    }
  }, [mutateContacts, mutateSearch, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedContacts(new Set(contacts.map(contact => contact.contact_id.toString())));
    } else {
      setSelectedContacts(new Set());
    }
  }, [contacts]);

  const handleSelectContact = useCallback((contact_id: string, checked: boolean) => {
    const newSelected = new Set(selectedContacts);
    if (checked) {
      newSelected.add(contact_id);
    } else {
      newSelected.delete(contact_id);
    }
    setSelectedContacts(newSelected);
  }, [selectedContacts]);

  const handleDeleteSelected = async () => {
    if (selectedContacts.size === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)?`)) {
      return;
    }

    try {
      await contactsApi.deleteContacts(Array.from(selectedContacts));
      setSelectedContacts(new Set());
      mutate();
    } catch (error) {
      alert('Failed to delete contacts');
    }
  };

  const handleInitiateCalls = async () => {
    if (selectedContacts.size === 0) return;

    try {
      await callsApi.initiateCalls(Array.from(selectedContacts));
      setSelectedContacts(new Set());
      alert(`Initiated calls for ${selectedContacts.size} contact(s)`);
    } catch (error) {
      alert('Failed to initiate calls');
    }
  };

  const AddContactForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // Get current date in YYYY-MM-DD format
    const getCurrentDate = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const [formData, setFormData] = useState<ContactFormData>({
      full_name: '',
      phone_number: '',
      country_code: '+1',
      language: 'en-US',
      amount_due: '',
      due_date: getCurrentDate()
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        const amountDue = parseFloat(formData.amount_due) || 0;
        const submissionData: ContactCreate = {
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          language: formData.language,
          country_code: formData.country_code,
          debt: {
            amount_due: Math.round(amountDue * 100),
            due_date: formData.due_date,
            status: 'overdue'
          }
        };
        await contactsApi.createContact(submissionData);
        mutate();
        onClose();
      } catch (error) {
        alert('Failed to create contact');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={formData.phone_number}
              onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country Code
            </label>
            <select
              value={formData.country_code}
              onChange={(e) => setFormData(prev => ({ ...prev, country_code: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="+1">+1 (US/CA)</option>
              <option value="+44">+44 (UK)</option>
              <option value="+49">+49 (DE)</option>
              <option value="+33">+33 (FR)</option>
              <option value="+91">+91 (IN)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en-US">English (US)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount Due (₹)
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.amount_due}
              onChange={(e) => setFormData(prev => ({ ...prev, amount_due: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              required
              value={formData.due_date}
              onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
          >
            {isSubmitting ? 'Creating...' : 'Create Contact'}
          </button>
        </div>
      </form>
    );
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load contacts. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <SearchBar
          placeholder="Search contacts by name or phone..."
          onSearch={handleSearch}
          className="w-96"
        />
        <div className="flex items-center space-x-3">
          {selectedContacts.size > 0 && (
            <>
              <span className="text-sm text-gray-600">
                {selectedContacts.size} selected
              </span>
              <button
                onClick={handleInitiateCalls}
                className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center space-x-1"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>Initiate Calls</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center space-x-1"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
            </>
          )}
          <button
            onClick={() => {
              setShowAddModal(true);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center space-x-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Contacts table - Scrollable with fixed height */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === contacts.length && contacts.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.contact_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.contact_id.toString())}
                      onChange={(e) => handleSelectContact(contact.contact_id.toString(), e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/contact/${contact.contact_id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {contact.full_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.phone_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{contact.debt?.amount_due ? (contact.debt.amount_due / 100).toFixed(2) : '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.debt?.due_date ? new Date(contact.debt.due_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => callsApi.initiateCall(contact.contact_id.toString())}
                        className="text-green-600 hover:text-green-800 flex items-center space-x-1"
                        title="Initiate call for this contact"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>Call</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this contact?')) {
                            try {
                              await contactsApi.deleteContact(contact.contact_id.toString());
                              mutate();
                            } catch (error) {
                              alert('Failed to delete contact');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                        title="Delete this contact"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {contacts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No contacts found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        current_page={currentPage}
        onPageChange={setCurrentPage}
        hasNextPage={contacts.length >= limit}
      />


      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Contact"
        maxWidth="lg"
      >
        <AddContactForm onClose={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
};

export default ContactsTab;
