

# Job Application Tracker

## 1. Authentication
- Sign up / Log in pages (email + password)
- Password reset flow
- Protected routes — only logged-in users access the app

## 2. Dashboard (Home)
- Summary cards: Total Applications, Interviews Scheduled, Offers Received, Rejection Rate
- Line/bar chart showing applications over time (using Recharts)
- Pie chart of applications by status

## 3. Applications List & Management
- Table view of all job applications with search and filter by status
- Add new application form: Company, Position, URL, Salary Range, Location, Date Applied
- Edit and delete applications
- Status progression: **Wishlist → Applied → Phone Screen → Interview → Offer → Accepted → Rejected**
- Color-coded status badges

## 4. Application Detail Page
- Full details of the application
- **Notes section**: Add timestamped notes per application
- **Contacts**: Store recruiter/interviewer name, email, phone
- **Reminders**: Set follow-up dates with visual indicators for upcoming/overdue items
- **File uploads**: Attach resumes and cover letters (stored in Supabase Storage)

## 5. Backend (Lovable Cloud / Supabase)
- **Database tables**: profiles, applications, notes, contacts, reminders
- **Storage bucket** for resume/document uploads
- **Row-Level Security** so each user only sees their own data

## 6. Layout & Navigation
- Sidebar navigation: Dashboard, Applications, (Settings)
- Responsive design for mobile and desktop
- Clean, professional UI with the existing shadcn/ui components

