# E-Commerce Frontend

This is the frontend application for the E-Commerce microservices project. It provides user interface for authentication (login and register) and will later include product browsing and shopping cart functionality.

## Technologies Used

- React
- TypeScript
- React Router for navigation
- Axios for API communication
- Bootstrap for styling

## Features

- User Registration
- User Login
- Authentication with JWT

## Getting Started

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the frontend directory:
```
cd frontend
```
3. Install dependencies:
```
npm install
```
4. Start the development server:
```
npm start
```

The application will be available at http://localhost:3000.

## Project Structure

- `src/components/` - Reusable UI components
- `src/pages/` - Page components
- `src/services/` - API services and utilities

## API Configuration

By default, the API URL is set to `http://localhost:3001/api`. 
To change the API URL, update the `API_URL` constant in `src/services/auth.service.ts` 
and the `baseURL` in `src/services/api.ts`.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Runs tests
- `npm eject` - Ejects from Create React App configuration 