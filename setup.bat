@echo off
echo.
echo  NavProfit — Project Setup
echo  Organising your files in E:\boats
echo.

cd /d E:\boats

:: Create folder structure
echo Creating folders...
mkdir src\components 2>nul
mkdir src\pages 2>nul
mkdir src\services 2>nul
mkdir src\hooks 2>nul
mkdir src\utils 2>nul
mkdir docs 2>nul
mkdir public 2>nul

:: Move service files
echo Moving service files...
if exist ais.js         move /Y ais.js         src\services\ais.js
if exist fuel.js        move /Y fuel.js         src\services\fuel.js
if exist invoices.js    move /Y invoices.js     src\services\invoices.js

:: Move utility files
echo Moving utility files...
if exist voyage.js      move /Y voyage.js       src\utils\voyage.js
if exist format.js      move /Y format.js       src\utils\format.js

:: Move docs
echo Moving documentation...
if exist ROADMAP.md     move /Y ROADMAP.md      docs\ROADMAP.md
if exist API_SETUP.md   move /Y API_SETUP.md    docs\API_SETUP.md
if exist BUSINESS.md    move /Y BUSINESS.md     docs\BUSINESS.md

:: Root files stay in root (README, package.json, .gitignore, .env.example)
echo.
echo  Done! Your project is now organised:
echo.
echo  E:\boats\
echo  +-- src\
echo  ^|   +-- services\   (ais.js, fuel.js, invoices.js)
echo  ^|   +-- utils\      (voyage.js, format.js)
echo  ^|   +-- components\
echo  ^|   +-- pages\
echo  ^|   +-- hooks\
echo  +-- docs\            (ROADMAP.md, API_SETUP.md, BUSINESS.md)
echo  +-- public\
echo  +-- README.md
echo  +-- package.json
echo  +-- .env.example
echo  +-- .gitignore
echo.
echo  Next step: Open E:\boats in VS Code
echo  then run:  npm install
echo.
pause