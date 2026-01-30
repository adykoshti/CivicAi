# CivicAI Monorepo

## Project Components
- **Frontend**: React + Vite app in `frontend`
- **Backend API**: FastAPI server in `backend`
- **ML Model**: Training/inference utilities in `backend/ml`

## Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (virtual env recommended)
- Optional: MongoDB running locally if you want IoT data persistence

## Project Structure
- `frontend`: Vite React UI that calls the backend at http://localhost:8001
- `backend`: FastAPI app serving AQI predictions and endpoints
- `backend/ml`: Scripts for training and sanity checks

---

## 🚀 Start Backend API

1. Open a terminal
2. Navigate to `backend`
3. Create and activate a python 3.10.11 virtual environment (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
python main.py
```

**Alternative run command:**
```powershell
uvicorn main:app --host 0.0.0.0 --port 8001
```

**Key Endpoints:**
- `GET /predict-latest-aqi`
- `GET /city-data?city=Ahmedabad`
- `GET /cities`
- `GET /iot-data`, `POST /iot-data`
- `POST /personal-risk`
- `POST /recommend-actions`
- `GET /simulate-actions`

**Code Reference:**
- Backend entrypoint: [main.py](backend/main.py)

---

## 🎨 Start Frontend

1. Open a new terminal
2. Navigate to `frontend`
3. Install and run

```powershell
cd frontend
npm install
npm run dev
```

- The frontend expects the backend at http://localhost:8001, configured in [api.ts](frontend/src/services/api.ts).

---

## 🤖 Start ML Model Utilities

Training and utilities live under `backend/ml`.
Typical usage (after activating your virtual env in `backend`):

```powershell
cd backend
.\.venv\Scripts\Activate
```

**Train Main AQI Model:**
```powershell
python ml/train_model.py
```

**Train Forecast (Min/Max) Models:**
```powershell
python ml/train_forecast.py
```

**Other Utilities:**
```powershell
python ml/dataset_utils.py
```

- Artifacts are read from and written to `backend/artifacts`

---

## Notes
- If MongoDB is not running, the backend will still serve predictions and use mock data for IoT endpoints.
- **Ports**:
  - Backend API: 8001
  - Frontend dev: shown by Vite (typically 5173)
- Ensure the backend is running before launching the frontend, or the UI will show mock/fallback data.
