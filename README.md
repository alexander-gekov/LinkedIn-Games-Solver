# LinkedIn Games Solver

Tampermonkey userscripts to auto-solve LinkedIn puzzle games.

## Supported Games

- **Queens** - Places queens on the board following color region and adjacency rules
- **Tango** - Fills in Sun/Moon symbols following the game constraints

## Installation

### 1. Install Tampermonkey

Install the Tampermonkey browser extension for your browser:

- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Safari](https://apps.apple.com/app/tampermonkey/id1482490089)

### 2. Create a New Script

1. Click the Tampermonkey icon in your browser toolbar
2. Select **"Create a new script..."**
3. Delete all the default template code
4. Copy and paste the contents of one of the scripts from this repo:
   - `queens.js` - for LinkedIn Queens game
   - `tango.js` - for LinkedIn Tango game
5. Press `Ctrl+S` (or `Cmd+S` on Mac) to save the script

### 3. Use the Solver

1. Go to the LinkedIn game page:
   - Queens: https://www.linkedin.com/games/queens
   - Tango: https://www.linkedin.com/games/tango
2. The solver will run automatically:
   - **Queens**: Solves immediately when the board loads
   - **Tango**: Shows a "Solve Tango" button - click it to solve

## Troubleshooting

If the solver doesn't work:

1. Open browser DevTools (F12) and check the Console tab
2. Look for `[Queens]` or `[Tango]` log messages
3. Make sure Tampermonkey is enabled for the LinkedIn site
4. Try refreshing the page

## Disclaimer

These scripts are for educational purposes. Use responsibly.
