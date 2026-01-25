# PaceLink

Refactored to Next.js App Router (v14+).

## Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Icons:** Material Symbols
- **Database:** Supabase (Client-side usage)

## Commands

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
# or
next dev
```

### Production Build
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Structure
- `/app`: Next.js App Router pages.
- `/components`: Reusable UI components.
- `/lib`: Helper libraries (Supabase, format, storage).
- `/types`: TypeScript definitions.

## Key Components
- `WorkoutCard`: Displays workout summary.
- `ExecutionBlock`: Interactive block for workout timeline.
- `ModalStudent`: Form for creating/editing students.
- `Topbar`: Global navigation header.

## Authentication
Used Supabase Auth. Login at `/login`. Redirects to `/students` upon success.
