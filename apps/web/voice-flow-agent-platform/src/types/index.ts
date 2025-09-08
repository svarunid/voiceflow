export interface Debt {
  debt_id: number;
  amount_due: number;
  due_date: string | null;
  status: string;
}

export interface Contact {
  contact_id: number;
  full_name: string;
  phone_number: string;
  language: string;
  debt?: Debt;
}

// Schema interfaces matching backend
export interface DebtCreate {
  amount_due: number;
  due_date: string; // Required datetime
  status: string;
}

export interface ContactCreate {
  full_name: string;
  phone_number: string;
  language: string;
  country_code?: string; // Optional
  debt?: DebtCreate; // Optional nested debt
}

// Form data interface for UI state management
export interface ContactFormData {
  full_name: string;
  phone_number: string;
  country_code: string;
  language: string;
  amount_due: string; // String to allow empty input
  due_date: string;
}

export interface CallAttempt {
  attempt_id: string;
  contact_id: string;
  started_at: string;
  phone_number: string;
  status: 'started' | 'dispatched' | 'call_ended' | 'failed' | 'completed';
  outcome?: {
    resolution: 'promise_to_pay' | 'extension' | 'dispute' | 'dnc' | 'wrong_number' | 'no_answer';
    description: string;
    promised_amount?: number;
    promised_date?: string;
  };
}

export interface ContactWithAttempts extends Contact {
  call_attempts: CallAttempt[];
}

export type CallStatus = CallAttempt['status'];
export type ResolutionStatus = NonNullable<CallAttempt['outcome']>['resolution'];
