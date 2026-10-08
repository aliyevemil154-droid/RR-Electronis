@echo off
setlocal
title Dubai Electronics - Local Website
pushd "%~dp0"
if errorlevel 1 goto folder_error

echo Dubai Electronics - Windows launcher
echo Keep this window open while using the website.
echo.

powershell.exe -NoLogo -NoProfile -Command "try { $page=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 3; if ($page.StatusCode -eq 200 -and $page.Content.Contains('Dubai Electronics') -and $page.Content.Contains('Your next upgrade')) { Start-Process 'http://localhost:3000'; exit 0 }; exit 1 } catch { exit 1 }"
if not errorlevel 1 goto already_running

node -e "process.exit(process.versions.node.split('.')[0] === '24' ? 0 : 1)" >nul 2>&1
if not errorlevel 1 goto node_ready

set "DE_NODE_ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "DE_NODE_ARCH=arm64"
if /i "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "DE_NODE_ARCH=arm64"
if /i "%PROCESSOR_ARCHITECTURE%"=="x86" if not defined PROCESSOR_ARCHITEW6432 goto architecture_error
set "DE_SITE_DIR=%CD%"
set "DE_NODE_HASH=57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73"
if "%DE_NODE_ARCH%"=="arm64" set "DE_NODE_HASH=8502f4a50b458d4cc38ed8f2001556c2cd239d464920f74017926ccb1e1c157f"
set "PATH=%CD%\.local-runtime\node-v24.19.0-win-%DE_NODE_ARCH%;%PATH%"
node -e "process.exit(process.versions.node.split('.')[0] === '24' ? 0 : 1)" >nul 2>&1
if not errorlevel 1 goto node_ready

echo Preparing a private Node.js 24 runtime. No administrator access is needed.
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $folder=Join-Path $env:DE_SITE_DIR '.local-runtime'; New-Item -ItemType Directory -Force -Path $folder | Out-Null; $name='node-v24.19.0-win-'+$env:DE_NODE_ARCH+'.zip'; $zip=Join-Path $folder $name; Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/v24.19.0/'+$name) -OutFile $zip; if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $env:DE_NODE_HASH) { Remove-Item -LiteralPath $zip -Force; throw 'Node.js download failed checksum verification.' }; Expand-Archive -LiteralPath $zip -DestinationPath $folder -Force; Remove-Item -LiteralPath $zip -Force; exit 0 } catch { Write-Host ('Runtime setup failed: '+$_.Exception.Message); exit 1 }"
if errorlevel 1 goto setup_error
node -e "process.exit(process.versions.node.split('.')[0] === '24' ? 0 : 1)" >nul 2>&1
if errorlevel 1 goto setup_error

:node_ready
echo Installing the locked website dependencies. The first run may take a few minutes.
call npm.cmd ci --no-audit
if errorlevel 1 goto setup_error
node scripts\preview.mjs --open
if errorlevel 1 goto server_error
popd
exit /b 0

:already_running
echo Dubai Electronics is already running. Your browser has been opened.
popd
exit /b 0

:folder_error
echo Extract the ZIP with Windows "Extract All" before running this file.
goto failed
:architecture_error
echo A 64-bit Windows installation is required.
goto failed
:setup_error
echo Setup could not finish. Check the error above and your Internet connection.
goto failed
:server_error
echo The website could not start. Check the error above, then run this launcher again.
:failed
echo.
pause
exit /b 1
