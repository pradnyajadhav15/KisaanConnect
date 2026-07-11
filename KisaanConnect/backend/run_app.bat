@echo off
echo =====================================
echo   KisaanConnect Backend Startup
echo =====================================
echo.

REM Check Python is installed
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

REM Activate virtual environment if exists
IF EXIST venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo.
)

REM Check for .env (app requires JWT_SECRET to start)
IF NOT EXIST .env (
    echo ERROR: .env file not found in this folder.
    echo Create a .env next to main.py containing:
    echo     JWT_SECRET=^<run: python -c "import secrets; print(secrets.token_hex(32))"^>
    pause
    exit /b 1
)

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip -q
echo.

REM Install dependencies (prefer wheels, fall back to source if needed)
echo Installing dependencies...
pip install -r requirements.txt --prefer-binary
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)
echo.

REM Train ML model if not already trained
IF NOT EXIST price_prediction\models\crop_price_model.joblib (
    echo Training ML model for the first time...
    python price_prediction\models\train_model.py
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Model training failed.
        pause
        exit /b 1
    )
    echo.
)

REM Start server
echo Starting server...
echo.
python main.py
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Server failed to start.
    pause
    exit /b 1
)

echo.
echo Server running at   http://localhost:8000
echo API docs available  http://localhost:8000/docs
pause