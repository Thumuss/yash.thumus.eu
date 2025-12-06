/**
 * YASH Web Terminal - Main Application
 * 
 * This is the main JavaScript file that handles the terminal interface,
 * integrating with @yash/website for the shell functionality.
 */

import { createWebTerminal } from '../src/index.ts';

// ==========================================
// State Management
// ==========================================
let terminal;
let historyIndex = -1;
let commandHistory = [];
let pythonReplMode = false;  // Track if we're in Python REPL mode
let pythonReplBuffer = [];   // For multi-line Python input

// DOM Elements
const terminalOutput = document.getElementById('terminalOutput');
const terminalInput = document.getElementById('terminalInput');
const promptText = document.getElementById('promptText');
const terminalPath = document.getElementById('terminalPath');
const terminalBody = document.getElementById('terminalBody');
const fileTree = document.getElementById('fileTree');
const historyList = document.getElementById('historyList');
const infoUser = document.getElementById('infoUser');
const infoProcesses = document.getElementById('infoProcesses');

// ==========================================
// Terminal Initialization
// ==========================================
let pyodideReady = false;
let pyodideInstance = null;

async function initPyodide() {
    try {
        // Check if loadPyodide is available (from pyodide.js CDN)
        if (typeof loadPyodide === 'undefined') {
            console.warn('Pyodide not loaded yet, waiting...');
            // Retry after a short delay
            setTimeout(initPyodide, 1000);
            return;
        }
        
        console.log('Loading Pyodide...');
        pyodideInstance = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });
        pyodideReady = true;
        window.pyodide = pyodideInstance;
        console.log('✓ Pyodide loaded successfully - Python is ready!');
        
        // Show notification in terminal if visible
        const statusEl = document.querySelector('.terminal-status');
        if (statusEl) {
            const pythonStatus = document.createElement('span');
            pythonStatus.textContent = ' | Python ✓';
            pythonStatus.style.color = '#4ade80';
            statusEl.appendChild(pythonStatus);
        }
    } catch (e) {
        console.error('Failed to load Pyodide:', e);
    }
}

async function initTerminal() {
    terminal = createWebTerminal({
        welcomeMessage: null, // We have our own welcome message
        onOutput: (data) => {
            appendOutput(data, 'result');
        },
        onError: (data) => {
            appendOutput(data, 'error');
        },
        onClear: () => {
            clearOutput();
        }
    });
    
    // Add Python command to the bridge
    terminal.bridge.global_functions.python = async (bridge, vars) => {
        // Collect all arguments as Python code
        const args = [];
        let i = 1;
        while (vars[String(i)] !== undefined) {
            args.push(String(vars[String(i)]));
            i++;
        }
        
        // No arguments = start interactive REPL
        if (args.length === 0) {
            if (!pyodideReady || !pyodideInstance) {
                await bridge.err("Python is still loading... Please wait a moment and try again.");
                return 1;
            }
            startPythonRepl();
            return null;
        }
        
        // Handle -c flag for inline code
        if (args[0] === '-c' && args[1]) {
            const code = args.slice(1).join(' ');
            return await executePython(code, bridge);
        }
        
        // Handle --version
        if (args[0] === '--version' || args[0] === '-V') {
            await bridge.out("Python 3.11.0 (Pyodide)");
            return null;
        }
        
        // Handle -h / --help
        if (args[0] === '-h' || args[0] === '--help') {
            await bridge.out("Python 3.11.0 (Pyodide in browser)");
            await bridge.out("");
            await bridge.out("Usage: python [option] ... [-c cmd | file]");
            await bridge.out("");
            await bridge.out("Options:");
            await bridge.out("  -c cmd    Execute Python code directly");
            await bridge.out("  -V        Print version and exit");
            await bridge.out("  -h        Print this help message");
            await bridge.out("");
            await bridge.out("Without arguments, starts interactive REPL.");
            await bridge.out("Type exit() or Ctrl+D to exit REPL mode.");
            return null;
        }
        
        // Try to run a file
        const filename = args[0];
        try {
            const content = await bridge.fs.readFile(filename, 'utf-8');
            return await executePython(content, bridge);
        } catch (e) {
            await bridge.err(`python: can't open file '${filename}': ${e.message}`);
            return 1;
        }
    };
    
    // Add python3 as alias
    terminal.bridge.global_functions.python3 = terminal.bridge.global_functions.python;
    
    // Add pip (mock)
    terminal.bridge.global_functions.pip = async (bridge, vars) => {
        await bridge.out("pip 23.0 (python 3.11 - PyScript/Pyodide)");
        await bridge.out("Note: pip install is limited in the browser environment.");
        await bridge.out("Many packages are pre-installed via Pyodide.");
        return null;
    };
    
    // Initialize Pyodide in background
    initPyodide();
    
    // Initial updates
    updatePrompt();
    updateFileTree();
    updateSystemInfo();
    
    // Focus input
    terminalInput.focus();
}

// Execute Python code using PyScript/Pyodide
async function executePython(code, bridge) {
    try {
        // Create a hidden py-script element to execute code
        const outputLines = [];
        
        // Try using Pyodide directly if available
        if (window.pyodide || pyodideInstance) {
            const py = window.pyodide || pyodideInstance;
            
            // Redirect stdout
            py.runPython(`
import sys
from io import StringIO
_stdout_backup = sys.stdout
sys.stdout = StringIO()
`);
            
            try {
                const result = py.runPython(code);
                const stdout = py.runPython('sys.stdout.getvalue()');
                
                // Restore stdout
                py.runPython('sys.stdout = _stdout_backup');
                
                if (stdout) {
                    await bridge.out(stdout.trim());
                }
                if (result !== undefined && result !== null && String(result) !== 'None') {
                    await bridge.out(String(result));
                }
                return null;
            } catch (e) {
                py.runPython('sys.stdout = _stdout_backup');
                await bridge.err(e.message);
                return 1;
            }
        } else {
            // Fallback: use eval for simple expressions (very limited)
            await bridge.err("Python environment is loading... Please try again in a moment.");
            return 1;
        }
    } catch (e) {
        await bridge.err(`Python error: ${e.message}`);
        return 1;
    }
}

// ==========================================
// Python REPL Mode
// ==========================================
function startPythonRepl() {
    pythonReplMode = true;
    pythonReplBuffer = [];
    
    // Show Python banner
    appendOutput('Python 3.11.0 (Pyodide)', 'result');
    appendOutput('[Pyodide runtime in browser]', 'result');
    appendOutput('Type "exit()" or press Ctrl+D to exit.', 'result');
    appendOutput('', 'result');
    
    // Update prompt to Python style
    updatePythonPrompt(false);
    terminalInput.focus();
}

function exitPythonRepl() {
    pythonReplMode = false;
    pythonReplBuffer = [];
    updatePrompt();
    terminalInput.focus();
}

function updatePythonPrompt(continuation = false) {
    if (continuation) {
        promptText.innerHTML = '<span class="python-prompt">...</span>';
    } else {
        promptText.innerHTML = '<span class="python-prompt">&gt;&gt;&gt;</span>';
    }
}

async function executePythonReplLine(line) {
    const py = window.pyodide || pyodideInstance;
    if (!py) {
        appendOutput('Python not loaded', 'error');
        exitPythonRepl();
        return;
    }
    
    // Check for exit commands
    if (line.trim() === 'exit()' || line.trim() === 'quit()') {
        exitPythonRepl();
        return;
    }
    
    // Add line to buffer
    pythonReplBuffer.push(line);
    const code = pythonReplBuffer.join('\n');
    
    // Check if we need more input (multi-line)
    const needsMore = checkNeedsMoreInput(code);
    
    if (needsMore) {
        updatePythonPrompt(true);
        return;
    }
    
    // Execute the complete code
    pythonReplBuffer = [];
    
    try {
        // Redirect stdout/stderr
        py.runPython(`
import sys
from io import StringIO
_stdout_backup = sys.stdout
_stderr_backup = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()
`);
        
        let result;
        let error = null;
        
        try {
            // Try to evaluate as expression first (for REPL behavior)
            try {
                result = py.runPython(`
try:
    _result = eval(${JSON.stringify(code)})
except SyntaxError:
    exec(${JSON.stringify(code)})
    _result = None
_result
`);
            } catch (e) {
                // If eval fails, try exec
                py.runPython(code);
                result = undefined;
            }
        } catch (e) {
            error = e;
        }
        
        const stdout = py.runPython('sys.stdout.getvalue()');
        const stderr = py.runPython('sys.stderr.getvalue()');
        
        // Restore stdout/stderr
        py.runPython(`
sys.stdout = _stdout_backup
sys.stderr = _stderr_backup
`);
        
        // Display output
        if (stdout) {
            stdout.split('\n').forEach(line => {
                if (line) appendOutput(line, 'result');
            });
        }
        
        if (stderr) {
            stderr.split('\n').forEach(line => {
                if (line) appendOutput(line, 'error');
            });
        }
        
        if (error) {
            appendOutput(error.message, 'error');
        } else if (result !== undefined && result !== null && String(result) !== 'None') {
            appendOutput(String(result), 'result');
        }
        
    } catch (e) {
        appendOutput(e.message, 'error');
    }
    
    updatePythonPrompt(false);
}

function checkNeedsMoreInput(code) {
    // Check if code needs more input (incomplete statements)
    const trimmed = code.trim();
    
    // Ends with : (if, for, def, class, etc.)
    if (trimmed.endsWith(':')) return true;
    
    // Unclosed brackets/parens
    let parens = 0, brackets = 0, braces = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < code.length; i++) {
        const c = code[i];
        const prev = i > 0 ? code[i-1] : '';
        
        if (!inString) {
            if (c === '"' || c === "'") {
                inString = true;
                stringChar = c;
            } else if (c === '(') parens++;
            else if (c === ')') parens--;
            else if (c === '[') brackets++;
            else if (c === ']') brackets--;
            else if (c === '{') braces++;
            else if (c === '}') braces--;
        } else {
            if (c === stringChar && prev !== '\\') {
                inString = false;
            }
        }
    }
    
    if (parens > 0 || brackets > 0 || braces > 0) return true;
    
    // Line continuation
    if (trimmed.endsWith('\\')) return true;
    
    // Inside a block (indented code after :)
    const lines = code.split('\n');
    if (lines.length > 1) {
        const lastLine = lines[lines.length - 1];
        const prevLine = lines[lines.length - 2];
        if (prevLine.trim().endsWith(':') && lastLine.trim() === '') {
            return false; // Empty line after block = execute
        }
        if (prevLine.trim().endsWith(':') || (lastLine.startsWith(' ') || lastLine.startsWith('\t'))) {
            if (lastLine.trim() !== '') return true;
        }
    }
    
    return false;
}

// ==========================================
// Terminal Output
// ==========================================
function appendOutput(text, type = 'result') {
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = text;
    terminalOutput.appendChild(line);
    scrollToBottom();
}

function appendCommand(command) {
    const line = document.createElement('div');
    line.className = 'output-line command';
    
    if (pythonReplMode) {
        // Python REPL style prompt
        const promptSpan = document.createElement('span');
        promptSpan.className = 'python-prompt';
        promptSpan.textContent = pythonReplBuffer.length > 0 ? '... ' : '>>> ';
        line.appendChild(promptSpan);
        line.appendChild(document.createTextNode(command));
    } else {
        // Normal shell prompt
        const promptSpan = document.createElement('span');
        promptSpan.className = 'prompt';
        promptSpan.textContent = `${terminal.bridge.users.whoami()}@yash:`;
        
        const pathSpan = document.createElement('span');
        pathSpan.className = 'path';
        pathSpan.textContent = formatPath(terminal.getCwd());
        
        line.appendChild(promptSpan);
        line.appendChild(pathSpan);
        line.appendChild(document.createTextNode('$ ' + command));
    }
    
    terminalOutput.appendChild(line);
    scrollToBottom();
}

function clearOutput() {
    terminalOutput.innerHTML = '';
}

function scrollToBottom() {
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// ==========================================
// Command Execution
// ==========================================
async function executeCommand(command) {
    // In Python REPL mode, handle differently
    if (pythonReplMode) {
        // Display Python command
        appendCommand(command);
        
        // Execute Python line
        await executePythonReplLine(command);
        
        // Clear input
        terminalInput.value = '';
        scrollToBottom();
        return;
    }
    
    if (!command.trim()) return;
    
    // Add to history
    commandHistory.push(command);
    historyIndex = commandHistory.length;
    updateHistoryList();
    
    // Display command
    appendCommand(command);
    
    // Handle special commands
    if (command.trim() === 'clear') {
        clearOutput();
        terminalInput.value = '';
        updatePrompt();
        return;
    }
    
    // Execute through YASH
    try {
        await terminal.execute(command);
    } catch (error) {
        appendOutput(`Error: ${error.message}`, 'error');
    }
    
    // Update UI
    terminalInput.value = '';
    updatePrompt();
    updateFileTree();
    updateSystemInfo();
}

// ==========================================
// UI Updates
// ==========================================
function updatePrompt() {
    const user = terminal?.bridge?.users?.whoami() || 'user';
    const cwd = formatPath(terminal?.getCwd() || '/home/user');
    
    promptText.innerHTML = `<span class="user">${user}@yash</span>:<span class="path">${cwd}</span>$`;
    terminalPath.textContent = terminal?.getCwd() || '/home/user';
}

function formatPath(path) {
    const home = '/home/user';
    if (path.startsWith(home)) {
        return '~' + path.slice(home.length);
    }
    return path;
}

async function updateFileTree() {
    if (!terminal?.bridge?.fs) return;
    
    const cwd = terminal.getCwd();
    
    try {
        const items = await terminal.bridge.fs.readDir(cwd);
        const sortedItems = [];
        
        // Get stats for each item
        for (const item of items) {
            try {
                const itemPath = cwd === '/' ? `/${item}` : `${cwd}/${item}`;
                const stats = await terminal.bridge.fs.stat(itemPath);
                sortedItems.push({
                    name: item,
                    isDirectory: stats.isDirectory()
                });
            } catch {
                sortedItems.push({ name: item, isDirectory: false });
            }
        }
        
        // Sort: directories first, then alphabetically
        sortedItems.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Render
        fileTree.innerHTML = sortedItems.map(item => `
            <div class="file-item ${item.isDirectory ? 'folder' : 'file'}" 
                 data-name="${item.name}" 
                 data-is-dir="${item.isDirectory}">
                ${item.name}${item.isDirectory ? '/' : ''}
            </div>
        `).join('');
        
        // Add click handlers
        fileTree.querySelectorAll('.file-item').forEach(el => {
            el.addEventListener('click', () => {
                const name = el.dataset.name;
                const isDir = el.dataset.isDir === 'true';
                
                if (isDir) {
                    executeCommand(`cd "${name}"`);
                } else {
                    executeCommand(`cat "${name}"`);
                }
            });
        });
        
    } catch (error) {
        fileTree.innerHTML = '<p class="empty-state">Unable to read directory</p>';
    }
}

function updateSystemInfo() {
    if (!terminal?.bridge) return;
    
    const user = terminal.bridge.users?.whoami() || 'user';
    const processes = terminal.bridge.process?.listProcesses()?.length || 2;
    
    infoUser.textContent = user;
    infoProcesses.textContent = processes;
}

function updateHistoryList() {
    if (commandHistory.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No commands yet</p>';
        return;
    }
    
    // Show last 20 commands
    const recent = commandHistory.slice(-20).reverse();
    historyList.innerHTML = recent.map((cmd, i) => `
        <div class="history-item" data-index="${commandHistory.length - 1 - i}">
            ${escapeHtml(cmd)}
        </div>
    `).join('');
    
    // Add click handlers
    historyList.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            terminalInput.value = commandHistory[parseInt(el.dataset.index)];
            terminalInput.focus();
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// Event Handlers
// ==========================================
terminalInput.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'Enter':
            executeCommand(terminalInput.value);
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                terminalInput.value = commandHistory[historyIndex] || '';
            }
            break;
            
        case 'ArrowDown':
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                terminalInput.value = commandHistory[historyIndex] || '';
            } else {
                historyIndex = commandHistory.length;
                terminalInput.value = '';
            }
            break;
            
        case 'Tab':
            e.preventDefault();
            // TODO: Implement tab completion
            break;
            
        case 'c':
            if (e.ctrlKey) {
                e.preventDefault();
                if (pythonReplMode) {
                    // In Python REPL, Ctrl+C cancels current input
                    appendOutput('^C', 'result');
                    appendOutput('KeyboardInterrupt', 'error');
                    pythonReplBuffer = [];
                    updatePythonPrompt(false);
                } else {
                    appendOutput('^C', 'result');
                }
                terminalInput.value = '';
            }
            break;
            
        case 'd':
            if (e.ctrlKey) {
                e.preventDefault();
                if (pythonReplMode) {
                    // Ctrl+D exits Python REPL (like EOF)
                    if (terminalInput.value === '') {
                        appendOutput('', 'result');
                        exitPythonRepl();
                    }
                } else {
                    // In shell, Ctrl+D on empty line could exit (optional)
                    if (terminalInput.value === '') {
                        appendOutput('logout', 'result');
                    }
                }
            }
            break;
            
        case 'l':
            if (e.ctrlKey) {
                e.preventDefault();
                clearOutput();
                if (pythonReplMode) {
                    updatePythonPrompt(pythonReplBuffer.length > 0);
                }
            }
            break;
    }
});

// Click to focus terminal
terminalBody.addEventListener('click', (e) => {
    if (e.target === terminalBody || e.target === terminalOutput) {
        terminalInput.focus();
    }
});

// Clear button
document.getElementById('clearBtn').addEventListener('click', () => {
    clearOutput();
    terminalInput.focus();
});

// Download session button
document.getElementById('downloadBtn').addEventListener('click', () => {
    const content = Array.from(terminalOutput.querySelectorAll('.output-line'))
        .map(el => el.textContent)
        .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yash-session-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});

// Fullscreen button
document.getElementById('fullscreenBtn').addEventListener('click', () => {
    const section = document.querySelector('.terminal-section');
    section.classList.toggle('fullscreen');
    terminalInput.focus();
});

// Theme toggle
document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Scroll to terminal function (global)
window.scrollToTerminal = () => {
    document.getElementById('terminal').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => terminalInput.focus(), 500);
};

// Navigation highlighting
const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// ==========================================
// Initialize
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTerminal();
});

// Export for debugging
window.yashTerminal = () => terminal;
