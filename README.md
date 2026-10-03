# JS Interview Vault

A MERN interview-preparation app generated from the supplied JavaScript question backlog. Exact duplicate question text is removed while distinct wording is preserved.

## Run locally

1. Copy `server/.env.example` to `server/.env` and add a MongoDB connection string if you want database persistence.
2. Install dependencies with `npm install`, `npm install --prefix client`, and `npm install --prefix server`.
3. Run `npm run dev` and open `http://localhost:5173`.

Without MongoDB, the API automatically serves the bundled question dataset. With MongoDB configured, run `npm run seed --prefix server` once to import it.

## Data import

The generated dataset lives in `server/data/questions.generated.json`. To rebuild it from a source text file:

```powershell
npm run generate:data -- "C:\path\to\questions.txt"
```
