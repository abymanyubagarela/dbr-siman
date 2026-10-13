# Room Inventory System

A modern web application for conducting room-based inventory counts with QR code scanning and photo capture capabilities.

## Features

- **Room Management**: Create and manage multiple rooms
- **QR Code Scanning**: Scan asset QR codes or manually enter asset IDs
- **Photo Capture**: Take photos of each asset using device camera
- **Cloud Storage**: Automatically upload photos to Supabase Storage
- **Session Tracking**: Track inventory sessions and items scanned
- **Real-time Updates**: Live inventory item counts during sessions

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Storage)
- **Database**: PostgreSQL with Row Level Security
- **Storage**: Supabase Storage for photo uploads

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account with project created

### Environment Variables

Set these in your Vercel project:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Installation

1. Install dependencies:

```bash
npm install
```

2. Initialize the database by running the SQL in `/scripts/01-create-schema.sql` in your Supabase SQL Editor

3. Create an `inventory-photos` bucket in Supabase Storage

4. Start the development server:

```bash
npm run dev
```

## Usage

1. **Start Session**: Select or create a room, then start an inventory session
2. **Scan Items**: Enter asset IDs manually or scan QR codes
3. **Capture Photos**: Take photos of each asset with device camera
4. **Upload**: Photos automatically upload to cloud storage
5. **End Session**: Complete when finished

## Database Schema

**rooms** - Room records with name and location
**inventory_sessions** - Track inventory count sessions per room
**inventory_items** - Individual asset scans with photo URLs and status
