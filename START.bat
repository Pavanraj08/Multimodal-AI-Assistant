@echo off
echo Starting Multimodal AI Assistant...
echo.
echo Opening http://localhost:8080 in your browser...
start http://localhost:8080
cd /d "%~dp0"
python -m http.server 8080
