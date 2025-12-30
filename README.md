**CivicAI Monorepo**
- Frontend: React + Vite app in frontend
- Backend API: FastAPI server in mlModel/CivicAI/backend
- ML Model: Training/inference utilities in mlModel/CivicAI/backend/ml

**Prerequisites**
- Node.js 18+ and npm
- Python 3.10+ (virtual env recommended)
- Optional: MongoDB running locally if you want IoT data persistence

**Project Structure**
- frontend: Vite React UI that calls the backend at http://localhost:8001
- mlModel/CivicAI/backend: FastAPI app serving AQI predictions and endpoints
- mlModel/CivicAI/backend/ml: scripts for training and sanity checks

**Start Backend API**
- Open a terminal
- Navigate to mlModel/CivicAI/backend
- Create and activate a virtual environment (Windows PowerShell)

```powershell
cd mlModel/CivicAI/backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
python main.py
```

- Alternative run command

```powershell
uvicorn main:app --host 0.0.0.0 --port 8001
```

- The API exposes endpoints such as:
  - GET /predict-latest-aqi
  - GET /city-data?city=Ahmedabad
  - GET /cities
  - GET /iot-data, POST /iot-data
  - POST /personal-risk
  - POST /recommend-actions
  - GET /simulate-actions

- Code reference:
  - Backend entrypoint: [main.py](file:///e:/CivicAi/CivicAi/mlModel/CivicAI/backend/main.py)

**Start Frontend**
- Open a new terminal
- Navigate to frontend
- Install and run

```powershell
cd frontend
npm install
npm run dev
```

- The frontend expects the backend at http://localhost:8001, configured in [api.ts](file:///e:/CivicAi/CivicAi/frontend/src/services/api.ts).

**Start ML Model Utilities**
- Training and utilities live under mlModel/CivicAI/backend/ml
- Typical usage (after activating your virtual env in mlModel/CivicAI/backend):

```powershell
python ml/train_model.py
python ml/train_bilstm.py
python sanity_check.py
```

- Artifacts are read from and written to mlModel/CivicAI/backend/artifacts

**Notes**
- If MongoDB is not running, the backend will still serve predictions and use mock data for IoT endpoints.
- Ports:
  - Backend API: 8001
  - Frontend dev: shown by Vite (typically 5173)
- Ensure the backend is running before launching the frontend, or the UI will show mock/fallback data.

