@echo off
echo ============================================
echo  WealthOS - Git Deploy para GitHub
echo ============================================
echo.

cd /d "%~dp0"
echo Pasta: %CD%
echo.

echo [1/6] Limpar git anterior...
rmdir /s /q .git 2>nul
echo OK

echo.
echo [2/6] git init...
git init
git config user.email "paraujo1986@gmail.com"
git config user.name "Pedro Araujo"
git branch -M main

echo.
echo [3/6] Adicionar ficheiros...
git add .

echo.
echo [4/6] Commit...
git commit -m "feat: WealthOS API + frontend SPA"

echo.
echo [5/6] Configurar remote GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/paraujo1986-stack/wealthos-api.git

echo.
echo [6/6] Push para GitHub...
echo (Pode abrir janela de login GitHub no browser)
echo.
git push -u origin main

echo.
if %errorlevel% == 0 (
    echo ============================================
    echo  SUCESSO! Codigo no GitHub.
    echo  Proximos passos:
    echo  1. Vai a render.com
    echo  2. New - Web Service
    echo  3. Selecciona repo: paraujo1986-stack/wealthos-api
    echo  4. Build: npm install ^&^& npx prisma generate
    echo  5. Start: npx prisma migrate deploy ^&^& node src/server.js
    echo  6. Adiciona env vars (ver .env.example)
    echo ============================================
) else (
    echo ERRO no push. Verifica as credenciais GitHub.
)
echo.
pause
