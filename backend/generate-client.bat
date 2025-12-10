@echo off
cd /d "%~dp0"
call npx prisma generate
pause
