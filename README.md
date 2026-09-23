# JobSeek CRM

JobSeek CRM is a full-stack job application tracker and outreach automation platform built with Next.js, Prisma, and PostgreSQL. It helps you manage job applications, store your professional profile (including a resume PDF on S3), and send automated outreach emails directly via Gmail API or SMTP.

## Features

- **Job Pipeline Kanban Board**: Drag-and-drop board to track jobs across different stages (Sourced, Applied, Interviewing, Offer, Rejected).
- **Candidate Profile Management**: Maintain your professional headline, bio, skills, projects, and target roles in a central location.
- **S3 Resume Integration**: Automatically store your resume in an S3/MinIO bucket. Every outreach email sent will pull and attach the latest resume from this bucket.
- **Automated Email Outreach**: Send structured outreach emails directly to recruiters or HR from the platform using Gmail OAuth (or SMTP fallback), complete with PDF attachments.
- **Responsive Dashboard**: Quick metrics on your job search performance, recent applications, and upcoming interviews.

## Tech Stack

- **Frontend/Framework**: [Next.js 15](https://nextjs.org/) (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend**: Next.js Server Actions & API Routes.
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/).
- **Storage**: Amazon S3 / MinIO via `@aws-sdk/client-s3`.
- **Email Delivery**: Google API (`googleapis`) / `nodemailer`.

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL Database
- S3 Bucket (AWS, MinIO, or compatible)
- Google Cloud Project (for Gmail API OAuth)

### 1. Clone the repository

```bash
git clone https://github.com/khawarahemad/jobseek.git
cd jobseek
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and populate it with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/dbname?schema=public"

# S3 Storage Configuration
S3_ENDPOINT="https://s3.yourdomain.com"
S3_BUCKET="your-bucket-name"
S3_ACCESS_KEY_ID="your_access_key"
S3_SECRET_ACCESS_KEY="your_secret_key"

# Gmail Integration (OAuth2)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REFRESH_TOKEN="your_refresh_token"

# Gmail Integration (Fallback SMTP)
GMAIL_USER="your.email@gmail.com"
GMAIL_APP_PASSWORD="your_app_password"
```

### 4. Database Setup

Push the Prisma schema to your PostgreSQL database and generate the Prisma client:

```bash
npx prisma db push
npx prisma generate
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage Guide

1. **Set Up Profile**: Go to the **Profile** section and fill out your details. Upload your PDF resume (it will be saved to your configured S3 bucket).
2. **Add Jobs**: Navigate to the **Pipeline** or **Dashboard** to add new job prospects.
3. **Send Outreach**: Use the "Send Email" action on a job card to compose an email. The system will automatically fetch your S3 resume and attach it to the email before sending it via your configured Gmail account.

## License

This project is licensed under the MIT License.
