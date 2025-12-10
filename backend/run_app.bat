@echo off
echo =====================================
echo   KisaanConnect Backend Startup
echo =====================================
echo.

REM Optional: activate virtual environment if exists
IF EXIST venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo.
)

echo Installing dependencies...
pip install --upgrade pip
pip install -r requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    echo Error installing dependencies. Exiting...
    pause
    exit /b 1
)

echo.
echo Setting up the database...
python -c "from auth.db_setup import create_tables, add_test_users; create_tables(); add_test_users()"
IF %ERRORLEVEL% NEQ 0 (
    echo Error setting up database. Exiting...
    pause
    exit /b 1
)

echo.
echo Starting the server...
python main.py
IF %ERRORLEVEL% NEQ 0 (
    echo Error starting server. Exiting...
    pause
    exit /b 1
)

echo.
echo Server is running at http://localhost:8000
echo API documentation available at http://localhost:8000/docs
pause
