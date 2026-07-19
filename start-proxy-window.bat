@echo off
title DeepSeek Proxy - DO NOT CLOSE
cd /d "%~dp0"
echo Starting DeepSeek proxy...
echo Keep this window open while using AI analysis.
echo.

if exist "G:\NODE\node.exe" (
  "G:\NODE\node.exe" "%~dp0deepseek-proxy.js"
) else (
  node "%~dp0deepseek-proxy.js"
)

echo.
echo Proxy stopped.
pause
