@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
 echo Instale Python 3.10 ou superior e marque Add Python to PATH.
 pause
 exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
 python -m venv .venv
 if errorlevel 1 goto falha
)
".venv\Scripts\python.exe" -c "import pypdf" >nul 2>nul
if errorlevel 1 (
 ".venv\Scripts\python.exe" -m pip install -r requirements.txt
 if errorlevel 1 goto falha
)
".venv\Scripts\python.exe" launch.py
if errorlevel 1 goto falha
exit /b 0
:falha
echo Nao foi possivel iniciar o Lume. Confira a mensagem acima.
pause
exit /b 1
