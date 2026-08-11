@echo off
cd /d "%~dp0"

echo.
echo MemoraBet - generar AAB release para Google Play
echo.

if not exist android\key.properties (
  echo Falta android\key.properties.
  echo Primero ejecuta crear-keystore-release.bat y configura android\key.properties.
  pause
  exit /b 1
)

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

npm.cmd install
if errorlevel 1 (
  echo Fallo npm install.
  pause
  exit /b 1
)

npx.cmd cap sync android
if errorlevel 1 (
  echo Fallo npx cap sync android.
  pause
  exit /b 1
)

android\gradlew.bat -p android app:bundleRelease
if errorlevel 1 (
  echo Fallo la generacion del AAB release.
  pause
  exit /b 1
)

echo.
echo AAB listo:
echo android\app\build\outputs\bundle\release\app-release.aab
echo.
pause
