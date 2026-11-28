# Gypsy Desk

Studio book for Gypsy Coder. It keeps the same fields as `Project details.xlsx`: client, lead, server, operating system, status, software payment, balance, IP, username, password, server due day, and URL.

Projects sit in the three sections from the sheet:

- Live
- Under Development
- Under Discussion

Sign-in is required. Server passwords are encrypted in the database. The desk also watches server renewal days, open balances, and live or in-build records that are missing a server, login, or URL.

## Run it

From this folder:

```powershell
npm install
npm run dev
```

Open the address Vite prints. That is http://localhost:5173 unless that port is already in use.

First login:

- Email: `muthu@gypsycoder.local`
- Password: `Desk@2026`

Change that password under Account after you sign in. The nine clients from the spreadsheet are loaded the first time the database is empty. Sri Mobilers had a blank status and sat in the Under Development block, so it is filed there. `nil` cells were stored as empty.

PostgreSQL starts inside the app and saves data in `server/data`. You do not need a separate database install for this.

## Your own PostgreSQL server

Docker is included for a normal PostgreSQL 16 database.

```powershell
docker compose up -d
```

In `server/.env`, set:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gypsy_desk
```

Restart `npm run dev`. The API uses that server instead of the embedded database. The same tables and seed run there when the database is empty.

## Roles

There are two roles. Admins add people and set roles under **Team**.

| | Admin | Sales |
| --- | --- | --- |
| Desk | Money, servers, renewals, calls | Pipeline, calls, open balances |
| Follow-ups and Log a call | Yes | Yes |
| Projects | All fields | Client, lead, status, budget, URL, notes. No server, IP, login, password, due day, or hosting cost |
| Delete project, export sheet, reveal password | Yes | No |
| Payments, Server log, Timeline, Automation, Team | Yes | No |

The API enforces this too, so a sales login never receives server details.

Open sign-up only works while the desk has no users. After that, an admin adds each person from Team. When this version first runs, the earliest account becomes admin and everyone else becomes sales.

## What you can do

- Sign in, create another studio login, and change your password
- Add, edit, and delete projects
- See contracted, collected, and open money
- Reveal a saved server password only when you ask for it
- Export a CSV in the original column order, including passwords
- Copy a short digest of renewals and unpaid balances

The export file contains server passwords. Keep this folder private. Do not publish it.

## Sheet fields

| Sheet column | In the app |
| --- | --- |
| Client | Client |
| Lead By | Lead by |
| Server name | Server name |
| Server OS | Server OS |
| Project status | Live, Under Development, Under Discussion |
| Payment (for software) | Payment |
| Balance | Balance still open |
| IP | IP |
| username | Username |
| Password | Password, encrypted at rest |
| Server due date | Day of the month (17, 23, …). The next due date is calculated. |
| Url | URL. Several sites can be separated by commas. |

# gypsy-backend
