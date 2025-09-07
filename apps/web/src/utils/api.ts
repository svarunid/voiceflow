import { Contact, ContactCreate, CallAttempt, ContactWithAttempts } from '../types';

const API_BASE_URL = 'http://localhost:8080';

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Contact API functions
export const contactsApi = {
  getContacts: (skip = 0, limit = 20): Promise<Contact[]> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    return apiCall(`/api/contacts?${params}`);
  },

  searchContacts: (query: string, skip = 0, limit = 20): Promise<Contact[]> => {
    const params = new URLSearchParams({
      q: query,
      skip: skip.toString(),
      limit: limit.toString(),
    });
    return apiCall(`/api/contacts/search?${params}`);
  },

  getContact: (contact_id: string): Promise<ContactWithAttempts> => {
    return apiCall(`/api/contacts/${contact_id}`);
  },

  createContact: (contact: ContactCreate): Promise<Contact> => {
    return apiCall('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  deleteContact: (contact_id: string): Promise<void> => {
    return apiCall('/api/contacts', {
      method: 'DELETE',
      body: JSON.stringify({ contact_ids: [contact_id] }),
    });
  },

  deleteContacts: (contact_ids: string[]): Promise<void> => {
    return apiCall('/api/contacts', {
      method: 'DELETE',
      body: JSON.stringify({ contact_ids: contact_ids }),
    });
  },
};

// Calls API functions
export const callsApi = {
  getAttempts: (skip = 0, limit = 20, status?: string, phone_number?: string): Promise<CallAttempt[]> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(phone_number && { phone_number }),
    });
    return apiCall(`/api/calls/attempts?${params}`);
  },

  getAttempt: (attemptId: string): Promise<CallAttempt> => {
    return apiCall(`/api/calls/attempts/${attemptId}`);
  },

  initiateCall: (contact_id: string): Promise<{ attempt_id: string }> => {
    return apiCall('/api/calls/initiate', {
      method: 'POST',
      body: JSON.stringify({ contact_ids: [contact_id] }),
    });
  },

  initiateCalls: (contact_ids: string[]): Promise<{ attempt_ids: string[] }> => {
    return apiCall('/api/calls/initiate', {
      method: 'POST',
      body: JSON.stringify({ contact_ids }),
    });
  },
};
