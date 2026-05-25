@echo off
cd /d "%~dp0"
echo ============================================
echo  WealthOS API - Setup Git + GitHub
echo ============================================
echo.

:: Verificar git
where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado. Instala em https://git-scm.com
  pause
  exit /b 1
)
echo [OK] Git encontrado.

:: Verificar GitHub CLI
where gh >nul 2>&1
if errorlevel 1 (
  echo [INFO] GitHub CLI nao encontrado. A instalar via winget...
  winget install --id GitHub.cli -e --silent
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel instalar GitHub CLI automaticamente.
    echo Instala manualmente: https://cli.github.com
    pause
    exit /b 1
  )
)
echo [OK] GitHub CLI disponivel.

:: Criar .gitignore se nao existir
if not exist ".gitignore" (
  echo node_modules/>.gitignore
  echo .env>>.gitignore
  echo dist/>>.gitignore
  echo [OK] .gitignore criado.
) else (
  echo [OK] .gitignore ja existe.
)

:: Init git se nao existir
if not exist ".git" (
  git init
  echo [OK] Repositorio git inicializado.
) else (
  echo [OK] Repositorio git ja existe.
)

:: Add e commit
git add .
git commit -m "feat: wealthos-api com PIN auth" 2>nul || git commit --allow-empty -m "feat: wealthos-api com PIN auth"
echo [OK] Commit criado.

:: Login GitHub CLI
echo.
echo [INFO] A abrir login do GitHub no browser...
gh auth login --web --git-protocol https

:: Criar repo e push
echo.
echo [INFO] A criar repositorio privado no GitHub e a fazer push...
gh repo create wealthos-api --private --source=. --remote=origin --push

echo.
echo ============================================
echo  DONE! Repositorio em: https://github.com/$(gh api user --jq .login)/wealthos-api
echo ============================================
echo.
pause
