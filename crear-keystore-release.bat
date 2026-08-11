@echo off
cd /d "%~dp0"

echo.
echo MemoraBet - crear keystore de subida para Google Play
echo.
echo IMPORTANTE: Guarda muy bien la clave que escribas. La necesitaras para subir nuevas versiones.
echo.

where keytool >nul 2>nul
if errorlevel 1 (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)

keytool -genkeypair -v -keystore android\memorabet-upload-keystore.jks -alias memorabet-upload -keyalg RSA -keysize 2048 -validity 10000
if errorlevel 1 (
  echo.
  echo No se pudo crear la keystore.
  pause
  exit /b 1
)

echo.
echo Ahora crea este archivo local:
echo android\key.properties
echo.
echo Copia android\key.properties.example, renombralo a key.properties y reemplaza las claves por las que acabas de escribir.
echo.
pause
