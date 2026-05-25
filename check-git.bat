@echo off
echo === Git status ===
where git 2>nul && git --version || echo GIT NAO INSTALADO
echo.
echo === GitHub CLI status ===
where gh 2>nul && gh --version || echo GH CLI NAO INSTALADO
echo.
echo === Git config ===
git config --global user.name 2>nul || echo Nome nao configurado
git config --global user.email 2>nul || echo Email nao configurado
echo.
echo === Git credential helper ===
git config --global credential.helper 2>nul || echo Credential helper nao configurado
echo.
pause
