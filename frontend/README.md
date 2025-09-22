# InternLink — Careers Hub (Internship Platform)

A small full-stack internship platform built with **Flask + MongoDB backend** and **React + Vite frontend**.  
InternLink allows students to browse and apply for internships, upload resumes, and track applications, while companies can post internships and verify profiles.

---

## 🚀 Quick Status
- **Backend**: Flask + PyMongo (`backend/app.py`)
- **Frontend**: React + TypeScript + Vite (`frontend/`)
- **Database**: MongoDB (local or remote via `MONGO_URI`)
- **File Storage**: Resumes stored in `backend/uploads/` and served at `/uploads/<filename>`
- **Resume Metadata**: Stored in MongoDB `resumes` collection

---

## 📦 Prerequisites
- **Python**: 3.10+ (3.8+ works)
- **Node.js**: 18+ (or [Bun](https://bun.sh/))
- **MongoDB**: Running locally or remotely
- **PowerShell**: Development instructions use Windows PowerShell

---

## ⚙️ Environment Variables
| Variable        | Description                          | Default                   |
|-----------------|--------------------------------------|---------------------------|
| `MONGO_URI`     | MongoDB connection string            | `mongodb://localhost:27017` |
| `ADMIN_EMAIL`   | Seeded admin email                   | `admin@internlink.local` |
| `ADMIN_PASSWORD`| Seeded admin password                | `adminpass`              |

---

## 📂 Repository Layout
```
backend/
 ├─ app.py              # Flask API and upload handlers
 ├─ uploads/            # Stored resume/verification files
frontend/
 ├─ src/
 │   ├─ CompanyDashboard.tsx
 │   ├─ StudentDashboard.tsx
 ├─ package.json
 ├─ bun.lockb (optional)
```

---

## ▶️ How to Run (Development)

### 1. Start MongoDB
Ensure MongoDB is running locally or via connection string.

### 2. Backend (Flask)
```powershell
# Option A: Inline variable
$env:MONGO_URI = 'mongodb://localhost:27017'; python app.py

# Option B: Using .env
python app.py
```

Notes:
- Backend prints registered routes on startup.
- Auto-reloader disabled (`use_reloader=False`) for Windows socket stability.

### 3. Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
```

Or using Bun:
```powershell
cd frontend
bun install
bun dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🔑 Key API Endpoints

### Internships
- `GET /api/internships` — list internships  
- `POST /api/internships` — create internship  
- `PUT /api/internships/:id` — update internship  

### Applications
- `GET /api/applications?company=<company>` — list by company  
- `GET /api/applications?studentEmail=<email>` — list by student  
- `POST /api/applications` — create application  
- `GET /api/applications/:id` — fetch single application  
- `PUT /api/applications/:id` — update status  
- `DELETE /api/applications/:id` — delete application  

### Resume Upload
- `POST /api/upload_resume` — upload resume (`multipart/form-data` or JSON base64)  
- `DELETE /api/upload_resume` — delete by `{ email }`  
- `GET /api/resume?email=<email>` — fetch resume metadata  
- `GET /uploads/<filename>` — serve uploaded file  

### Companies
- `POST /api/company/verify` — upload verification doc or LinkedIn URL  
- `GET /api/companies/by-email?email=...` — fetch company  

### Auth
- `POST /api/login` — login, returns user object  

---

## 🗄️ Database Collections
- `users`
- `companies`
- `internships`
- `applications`
- `resumes` — `{ email, resumeFilename, storedFilename, resumeUrl, uploadedAt }`

---

## 💻 Frontend Behavior Notes
- **Company Dashboard**: Fetches resumes via `/api/resume?email=<studentEmail>` and previews in an iframe.  
- **Student Dashboard**: Uploads resumes with fallback to `localStorage`.  
- **LocalStorage Keys**:  
  - `platform_internships`  
  - `platform_applications`  
  - `student_resume_<email>`  

---

## 🛠️ Troubleshooting

### Resume Upload 404
- Restart backend and confirm `/api/upload_resume` route exists.  
- Ensure frontend calls the backend origin (`http://localhost:5000`).  
- For CORS preflight issues, confirm Flask CORS is configured.

### Resume Metadata Exists but File Missing
- Check returned `resumeUrl`. Should be absolute: `http://localhost:5000/uploads/...`.  
- Open URL directly to debug.

### Resumes Not Saved
- Inspect backend logs during POST.  
- Verify documents in `db.resumes` collection.

---

## 🧑‍💻 Development Tips
- Restart backend after code changes (no auto-reloader).  
- Use browser DevTools > Network tab for OPTIONS/POST debugging.  
- On backend startup, check route map for available endpoints.

---

## 🤝 Contributing
1. Create a feature branch.  
2. Commit your changes.  
3. Open a Pull Request.  

Keep APIs backward-compatible where possible.

---

## 📜 License
MIT License (recommended for open-source). Add `LICENSE` file if needed.

---

## ⚡ Example (Quick Start)

Backend:
```powershell
$env:MONGO_URI='mongodb://localhost:27017'; python app.py
```

Frontend:
```powershell
cd frontend
npm install
npm run dev
```
