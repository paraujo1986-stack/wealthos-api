@echo off
cd /d "%~dp0"
echo ============================================
echo  WealthOS API - Arrancar servidor local
echo ============================================
echo.
echo [1/3] Instalar dependencias...
call npm install
echo.
echo [2/3] Gerar cliente Prisma...
call npx prisma generate
echo.
echo [3/3] A iniciar servidor em http://localhost:3000
echo       (deixa esta janela aberta enquanto usas o WealthOS)
echo.
node src/server.js
pause
