# IntelliClip - Your Smart Clipboard Helper

IntelliClip is a desktop app that helps you manage the content you choose to save. It's like a super-smart clipboard that remembers your past copies, helps you organize them, and even uses **AI magic** to understand your content and answer questions!

## What It Does

- **Saves What You Choose:** Instead of saving *everything* you copy, IntelliClip only remembers content when you specifically tell it to (by pressing a shortcut like shift+cmd+C).
- **Knows Code:** Figures out what programming language your code snippets are in (like JavaScript, Python, etc.).
- **AI Smarts:**
    - **Quick Summaries:** Gets a short summary of what your copied text is about.
    - **Ask Anything:** You can ask the AI questions about any saved snippet!
- **Easy to Find:** Search through all your saved items quickly.
- **Keep Organized:** Add custom tags (labels) to your snippets.
- **Looks Good:** A clean, dark design that's easy on the eyes.
- **Edit & Reuse:** Change your saved snippets or copy them back to your clipboard.

## See It In Action!

*(Put your app screenshots here!)*

- **Main Screen:** Show what it looks like when you open it.
- **A Saved Item:** Show a snippet with its language, tags, and summary.
- **Talking to AI:** Show the panel where you ask questions and get answers.

## What You Need

To run IntelliClip, you'll need:

- **Node.js:** (A program that runs JavaScript outside your web browser)
- **npm:** (Comes with Node.js, helps manage project parts)

## How to Get Started

1. **Get the Code:** Download or clone this project from GitHub.
2. **Install Parts:** Open your computer's terminal (like Command Prompt or PowerShell on Windows, or Terminal on Mac/Linux), go to the project folder, and type:
    
    ```
    npm install
    ```
    
3. **Get Your AI Key (IMPORTANT!):**
    - Go to [Google AI Studio](https://aistudio.google.com/).
    - Follow their steps to get a **Gemini API Key**.
    - In your project folder, create a new file named `.env` (just `.env`, no name before the dot!).
    - Inside the `.env` file, put your key like this:
        
        ```
        API_KEY=YOUR_GEMINI_API_KEY_HERE
        ```
        
        **Replace `YOUR_GEMINI_API_KEY_HERE` with the key you got from Google AI Studio.**
        

## How to Use It

- **Start in Development:**
    
    ```
    npm run transpile:electron
    ```
    
    This runs the app on your computer for testing.
    
- **Build the App (for Mac, Windows, Linux):**
    
    ```
    npm run dist:mac   # For macOS (or dist:win, dist:linux)
    ```
    
    This creates a full app that you can install and run like any other program.
    
    **Important Note for AI Features in Built App:**
    
    Since the **.env** file (which holds my AI key) is usually ignored by version control, you'll need to make sure it's included in the final packaged app. If AI features don't work after building, please refer to the "Having Trouble" section below for steps on how to configure your build tool (electron-builder) to include the **.env** file.
    
- **Save Clips:** Just copy text or code to your clipboard and then press `Shift + Command + C` (on Mac, or `Shift + Control + C` on Windows/Linux).
- **Find Things:** Use the search box to find anything by its content, language, or tags.
- **Ask AI:** Click the "Ask AI" button on any snippet to get summaries or ask questions.

## Having Trouble?

- **"AI API key not configured." Error:** This usually means your `.env` file isn't set up right or isn't being found when the app is built.
    - Make sure you created the `.env` file at the very top level of your project folder.
    - Double-check that `API_KEY=YOUR_KEY` is written correctly in `.env`.
    - If you built the app, make sure you followed the steps to include `.env` in `electron-builder.json` and adjusted your main Electron file (`main.ts` or `main.js`) to find it.

## Built With

- [Electron](https://www.electronjs.org/) - For making desktop apps
- [React](https://react.dev/) - For building the user interface
- [TypeScript](https://www.typescriptlang.org/) - For writing safer code
- [Google Gemini API](https://ai.google.dev/gemini-api) - The AI brains
- [highlight.js](https://highlightjs.org/) - For making code look pretty
- [Fuse.js](https://fusejs.io/) - For smart searching
- [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) - For local data storage
- [dotenv](https://www.npmjs.com/package/dotenv) - For managing secret keys

## Want to Help?

Feel free to suggest improvements or raise an issue or contribute to the code!

MADE BY GAUTAM <3 .
