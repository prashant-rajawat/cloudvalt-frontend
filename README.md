# CloudVault Frontend

CloudVault is a secure cloud-based media file storage application with a modern Google Drive-style interface.

## Frontend

The frontend is built with:

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase Client
- Responsive UI

## Main Features

- User authentication
- Email verification
- Secure login and signup
- My Drive
- Folder navigation
- File upload
- File preview
- File download
- File rename
- File move
- Starred files
- Recent files
- Shared files
- Trash
- Search
- Storage usage
- Responsive file cards
- Image previews
- PDF previews
- Video previews
- Audio previews
- Document previews
- File-type-specific card designs

## UI

CloudVault uses a clean cloud-storage interface with:

- Responsive dashboard
- Sidebar navigation
- Search bar
- File and folder cards
- File previews
- File metadata
- Context menus
- Responsive layouts for desktop, tablet and mobile

## Environment Variables

The Vite frontend uses:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

These variables must be configured in the deployment environment.

Never expose the Supabase service-role key in frontend code.

## Development

Install dependencies:

npm install

Run the development server:

npm run dev

Build the production application:

npm run build

## Deployment

The frontend is deployed using Vercel.

Production URL:

https://cloud-vault-azure-chi.vercel.app

## Project Structure

src/       Frontend application
public/    Public assets
assets/    Application assets
index.html Frontend entry point
vite.config.ts Vite configuration
