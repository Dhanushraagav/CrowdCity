# CrowdCity AI

CrowdCity AI is an AI-powered civic issue reporting and management platform that helps citizens report public issues and enables authorities to manage them efficiently. The platform is designed to improve communication between citizens and local government by providing a simple and transparent reporting system.

## Project Overview

Citizens can report problems such as:

- Potholes
- Garbage accumulation
- Water leakage
- Broken streetlights
- Road damage
- Drainage issues
- Public property damage
- Other civic issues

Authorities can receive reports, verify them, assign work, monitor progress, and update the status until the issue is resolved.

The project focuses on improving public services using Artificial Intelligence and modern web technologies.

## Features

### Citizen Portal

- Secure Email and Google Authentication
- AI-powered issue reporting
- Image upload
- Location-based reporting
- Live issue tracking
- Complaint history
- Interactive map
- Notifications
- User profile
- English and Tamil language support

### Authority Portal

- Secure login
- Case management dashboard
- Assign reports
- Update report status
- Analytics dashboard
- Notification system
- Performance monitoring

### Admin Portal

- User management
- Authority management
- System analytics
- Category management
- Application settings

## AI Features

- AI-assisted civic issue reporting
- Smart response generation
- Intelligent report assistance
- Future-ready AI integration

## Technologies Used

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Node.js
- Express.js

### Database

- Supabase

### Authentication

- Supabase Authentication
- Google Sign-In
- Email OTP Authentication

### APIs

- Google Maps API
- Groq API

## Project Structure

```
CrowdCity/
│
├── client/
│   ├── css/
│   ├── images/
│   ├── js/
│   ├── locales/
│   └── *.html
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── app.js
│
├── supabase/
├── package.json
└── README.md
```

## Installation

Clone the repository.

```bash
git clone https://github.com/Dhanushraagav/CrowdCity.git
```

Move into the project folder.

```bash
cd CrowdCity
```

Install dependencies.

```bash
npm install
```

Create a `.env` file and add your environment variables.

Example:

```env
PORT=5000

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GROQ_API_KEY=your_groq_api_key

APP_URL=http://localhost:5000
```

Start the development server.

```bash
npm run dev
```

Open your browser.

```
http://localhost:5000
```

## Screens

- Authentication
- Citizen Dashboard
- Authority Dashboard
- Admin Dashboard
- Analytics
- Map View
- Report Management
- Notifications
- Profile
- Settings

## Future Improvements

- Mobile application
- Push notifications
- AI image verification
- Predictive analytics
- Live emergency alerts
- Voice-based reporting
- Offline reporting support

## License

This project was developed for educational and academic purposes.

## Author

**Dhanush Raagav S**

B.E. Computer Science and Engineering

Kalaignar Karunanidhi Institute of Technology

Coimbatore, Tamil Nadu

GitHub:
https://github.com/Dhanushraagav

---

Building Smarter Communities Across Tamil Nadu.
