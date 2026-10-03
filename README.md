# JS Interview Vault

A MERN interview-preparation app generated from the supplied JavaScript question backlog. Exact duplicate question text is removed while distinct wording is preserved.

## Workflow

- **Organise** contains all unique questions, paginated at 50 questions per page. Choose a topic and optional subtopic in the header, then use the tick button to add questions to Main. The selection stays active for the next questions.
- Use the pencil to edit a question inline or the trash icon to delete it immediately.
- Use the dedicated **Topics** section to view every topic and its subtopics, create, rename, or delete either level, and add subtopics inside the selected topic card. Deleting a topic safely moves its questions to `Uncategorized`; deleting a subtopic keeps its questions under the parent topic.
- **Main** contains only approved questions and displays 50 questions per page.
- Changes persist in MongoDB when configured, or in `server/data/questions.state.json` during local development.

## Run locally

1. Copy `server/.env.example` to `server/.env` and add a MongoDB connection string if you want database persistence.
2. Install dependencies with `npm install`, `npm install --prefix client`, and `npm install --prefix server`.
3. Run `npm run dev` and open `http://localhost:5173`.

Without MongoDB, the API automatically serves the bundled question dataset. With MongoDB configured, run `npm run seed --prefix server` once to import it.

## Deploy to Vercel

1. Create a MongoDB database and copy `server/.env.example` to `server/.env` for local use.
2. Run `npm run seed --prefix server` once with `MONGODB_URI` configured. This imports the questions and topics.
3. Import this repository into Vercel. The included `vercel.json` builds the Vite client and exposes the Express API as a Vercel Function.
4. Add `MONGODB_URI` in Vercel under **Project Settings → Environment Variables** for Production, Preview, and Development.
5. Deploy. Requests under `/api` use MongoDB; all other routes fall back to the React application.

Vercel's filesystem is read-only at runtime, so production changes require `MONGODB_URI`. The local development fallback continues to use the JSON files when MongoDB is not configured.

## Data import

The generated dataset lives in `server/data/questions.generated.json`. To rebuild it from a source text file:

```powershell
npm run generate:data -- "C:\path\to\questions.txt"
```
