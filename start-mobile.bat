@echo off
REM Get the local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    set "IP=%%a"
    goto :got_ip
)

:got_ip
set IP=%IP:~1%
echo.
echo ========================================
echo Your Machine IP: %IP%
echo ========================================
echo.

REM Update .env with machine IP
powershell -Command "(Get-Content .env) -replace 'REACT_APP_API_URL=.*', 'REACT_APP_API_URL=http://%IP%:5001/api' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'REACT_APP_SOCKET_URL=.*', 'REACT_APP_SOCKET_URL=http://%IP%:5001' | Add-Content .env"

echo Building React app for production...
call npm run build

echo.
echo ========================================
echo Starting mobile-friendly server...
echo ========================================
echo.
echo On your mobile device, open:
echo http://%IP%:3005
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the server
call serve -s build -l 3005

pause
