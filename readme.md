# Contact Identification API

A simple REST API that identifies and consolidates contact information based on email and phone number.

## Setup

```bash
# Install dependencies
npm install

# Initialize database
npx prisma migrate dev

# Start development server
npm run dev
```

## API Endpoints

### POST /api/v1/identify

Identifies a contact based on email and/or phone number, consolidating related contacts.

**Request Body:**

```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com", "secondary@example.com"],
    "phoneNumbers": ["1234567890", "9876543210"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Features

- Creates new primary contacts when no match is found
- Creates secondary contacts when partial information matches
- Consolidates multiple primary contacts when they're linked by a request
- Returns complete contact information including all related emails and phone numbers
