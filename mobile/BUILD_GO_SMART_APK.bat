@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GO SMART APK BUILDER - CLASSIC UI

echo ==============================================================
echo            GO SMART APK BUILDER - CLASSIC UI
echo ==============================================================
echo.

if exist "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)

if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

where node >nul 2>&1 || goto :NO_NODE
where npm >nul 2>&1 || goto :NO_NODE

echo Java:
java -version
echo Android SDK: %ANDROID_HOME%
echo.

if not exist node_modules (
  echo Installing app dependencies...
  call npm install
  if errorlevel 1 goto :FAILED
)

echo Preparing classic GO SMART UI connectivity...
node tools\prepare_go_smart_classic.js
if errorlevel 1 goto :FAILED

if not exist "%ANDROID_HOME%\platforms\android-34\android.jar" (
  echo Android API 34 is missing.
  if exist "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" (
    call "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-34" "build-tools;34.0.0" "platform-tools"
    if errorlevel 1 goto :FAILED
  ) else (
    echo Open Android Studio SDK Manager and install Android SDK Platform 34.
    goto :FAILED
  )
)

echo.
echo Building GO SMART APK... First build can take several minutes.
pushd android
call gradlew.bat --stop >nul 2>&1
call gradlew.bat assembleDebug --stacktrace
if errorlevel 1 (
  popd
  goto :FAILED
)
popd

if not exist "android\app\build\outputs\apk\debug\app-debug.apk" goto :FAILED
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "GO_SMART_CLASSIC.apk" >nul

echo.
echo ==============================================================
echo   APK READY
echo   %CD%\GO_SMART_CLASSIC.apk
echo ==============================================================
explorer /select,"%CD%\GO_SMART_CLASSIC.apk"
pause
exit /b 0

:NO_NODE
echo Node.js/npm not found. Install Node.js LTS once, then run this BAT again.
goto :FAILED

:FAILED
echo.
echo ==============================================================
echo   BUILD FAILED
echo   Send a photo of this window to ChatGPT.
echo ==============================================================
pause
exit /b 1
