@echo off
rem Double-click launcher for HDBrain (no VS Code needed).
rem The site must be served over HTTP: it uses ES modules + fetch()ed JSON,
rem both of which browsers block under file:// . Any static server works;
rem this one uses Python's built-in http.server (same as SMOKE.md).
cd /d "%~dp0"
echo Serving HDBrain at http://localhost:8770/  (close this window to stop)
start "" "http://localhost:8770/"
where python >nul 2>nul && (python -m http.server 8770) || (py -m http.server 8770)
