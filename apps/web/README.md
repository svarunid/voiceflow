# Voice Flow - Debt Collection Portal

A modern web application for Voice Flow's AI voice calling platform that automates the process of collecting dues from customers.

## Features

### 📞 Contacts Management
- **Contact List**: View all contacts in a paginated table
- **Search**: Search contacts by name or phone number
- **Add Contact**: Create new contacts with comprehensive information
- **Bulk Operations**: Select multiple contacts for batch call initiation or deletion
- **Contact Details**: View detailed contact information and call history

### 📋 Call Management
- **Call Attempts**: View all call attempts with status and outcome information
- **Filtering**: Filter calls by status (started, dispatched, call_ended, failed, completed)
- **Phone Search**: Search for calls by phone number
- **Attempt Details**: View detailed information about each call attempt

### 📊 Dashboard Features
- **Status Statistics**: Real-time overview of call attempt statuses
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Navigation**: Intuitive tab-based navigation between contacts and calls
- **Breadcrumbs**: Clear navigation path on detail pages

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Data Fetching**: SWR for efficient data management
- **Styling**: Custom CSS with responsive design
- **State Management**: React hooks

## API Integration

The application integrates with the following backend endpoints:

- `GET /api/contacts` - Fetch paginated contacts with search
- `POST /api/contacts` - Create a new contact
- `DELETE /api/contacts/:id` - Delete a contact
- `DELETE /api/contacts` - Bulk delete contacts
- `GET /api/contacts/:id` - Get contact details with call attempts
- `GET /api/calls/attempts` - Fetch paginated call attempts with filtering
- `GET /api/calls/attempts/:id` - Get call attempt details
- `POST /api/calls/initiate` - Initiate a call for contact(s)

## Mock Data Demo

The application includes comprehensive mock data to demonstrate all features without requiring a backend API. This includes:

- **12 Sample Contacts** with diverse names, phone numbers, and debt amounts
- **15 Call Attempts** with various statuses and outcomes
- **Realistic Data** including resolved payments, partial agreements, and failed attempts
- **Interactive Features** - Add new contacts, initiate calls, and see data updates in real-time

When using mock data, you'll see a "Demo Mode" badge in the header.

### Switching Between Mock and Real API

To use a real backend API, update your `.env` file:
```bash
# Disable mock data and use real API
VITE_USE_MOCK_DATA=false
VITE_API_BASE_URL=https://your-api-server.com
```

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables** (optional):
   
   A default `.env` file is already provided. If you need to customize the API URL:
   ```bash
   # Edit the .env file to change the API base URL
   VITE_API_BASE_URL=http://your-api-server:port
   ```
   
   **Note**: Environment variables in Vite must be prefixed with `VITE_` to be accessible in the browser.

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   
   The application will start at `http://localhost:3000` with mock data enabled by default.

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Preview the production build**:
   ```bash
   npm run preview
   ```

## Usage

### Managing Contacts

1. **View Contacts**: Navigate to the Contacts tab to see all contacts
2. **Add New Contact**: Click "Add Contact" to create a new contact with:
   - Full name
   - Phone number and country code
   - Language preference
   - Amount due and due date

3. **Search Contacts**: Use the search bar to find contacts by name or phone
4. **Bulk Operations**: 
   - Select multiple contacts using checkboxes
   - Initiate calls for selected contacts
   - Delete multiple contacts at once

5. **View Contact Details**: Click on a contact name to see:
   - Complete contact information
   - Call attempt history
   - Ability to initiate new calls

### Managing Calls

1. **View Call Attempts**: Navigate to the Calls tab to see all call attempts
2. **Filter by Status**: Use the status dropdown to filter calls
3. **Search by Phone**: Use the search bar to find calls for a specific number
4. **View Attempt Details**: Click "View Details" to see:
   - Complete call information
   - Outcome details (if available)
   - Resolution status and promised payments
   - Call timeline

### Navigation

- **Breadcrumbs**: Use breadcrumbs on detail pages to navigate back
- **Direct Links**: Phone numbers link to contact details
- **Cross-references**: Move between contacts and their call attempts seamlessly

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── TabNavigation.tsx
│   ├── SearchBar.tsx
│   ├── Modal.tsx
│   └── Pagination.tsx
├── pages/               # Page components
│   ├── ContactsTab.tsx
│   ├── CallsTab.tsx
│   ├── ContactDetail.tsx
│   └── AttemptDetail.tsx
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   └── api.ts
├── App.tsx              # Main app component
├── main.tsx             # App entry point
└── index.css            # Global styles
```

## Key Features

### Responsive Design
- Mobile-first approach
- Responsive tables with horizontal scrolling on small screens
- Flexible button layouts for mobile devices
- Optimized spacing and typography for different screen sizes

### Accessibility
- Keyboard navigation support
- Focus indicators for interactive elements
- Semantic HTML structure
- ARIA labels where appropriate

### User Experience
- Loading states for API calls
- Error handling with user-friendly messages
- Confirmation dialogs for destructive actions
- Real-time data updates with SWR

### Data Management
- Efficient API calls with SWR caching
- Pagination for large datasets
- Search and filtering capabilities
- Optimistic updates for better UX

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary to Voice Flow.
