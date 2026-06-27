@echo off
title Machub Attendance Capture v1.0
chcp 65001 > nul

echo ================================
echo   MACHUB ATTENDANCE CAPTURE
echo             v1.0
echo ================================
echo.

REM Change to the directory where this .bat file lives
cd /d %~dp0

REM Check Python is available
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ and add it to PATH.
    echo         Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check .env file exists
if not exist .env (
    echo [WARNING] .env file not found.
    echo           Copying .env.example to .env — please edit it before continuing.
    copy .env.example .env > nul
    echo.
    echo Open .env in a text editor and set your values, then re-run this script.
    notepad .env
    pause
    exit /b 1
)

echo Installing / verifying dependencies...
pip install -r requirements.txt -q --no-warn-script-location
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed. Check your internet connection and Python environment.
    pause
    exit /b 1
)
echo Dependencies OK.
echo.

echo Starting Machub Capture System...
echo Press Q in the camera preview window to stop cleanly.
echo.

python capture.py

echo.
echo ================================
echo  Capture system stopped.
echo ================================
pause
