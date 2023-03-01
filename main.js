'use strict';
const pkg = require('./package.json');
let options;
if (pkg.hasOwnProperty("NRelectron")) { options = pkg["NRelectron"] }

const editable = options.editable || false;      // set this to false to create a run only application - no editor/no console
const addNodes = options.addNodes || false;      // set to false to block installing extra nodes
let flowfile = options.flowFile || 'flows.json'; // default Flows file name - loaded at start

const urledit = "/red";             // url for the editor page
const urlconsole = "/console.htm";  // url for the console page
const nrIcon = "nodered.png"        // Icon for the app in root dir (usually 256x256)

const listenPort = "18880";                           // fix it if you like

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require("express");
const electron = require('electron');
const Store = require('electron-store');
const store = new Store();

const {app, TouchBar} = electron;
const ipc = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const { TouchBarButton } = TouchBar;

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) { console.log("Second instance - quitting."); app.quit(); }

var RED = require("node-red");
var red_app = express();

// Create a server
var server = http.createServer(red_app);

// Setup user directory and flowfile (if editable)
var userdir = __dirname;
if (editable === true) {
    // if running as raw electron use the current directory (mainly for dev)
    if (process.argv[1] && (process.argv[1] === "main.js")) {
        userdir = __dirname;
        if ((process.argv.length > 2) && ((process.argv[process.argv.length-1].indexOf(".json") > -1)||(process.argv[process.argv.length-1].indexOf(".flow") > -1))) {
            if (path.isAbsolute(process.argv[process.argv.length-1])) {
                flowfile = process.argv[process.argv.length-1];
            }
            else {
                flowfile = path.join(process.cwd(),process.argv[process.argv.length-1]);
            }
            store.set("flows",flowfile)
        }
        else { flowfile = path.join(userdir,flowfile); }
    }
    else { // We set the user directory to be in the users home directory...
        console.log("ARG",process.argv)
        userdir = os.homedir() + '/.node-red';
        if (!fs.existsSync(userdir)) {
            fs.mkdirSync(userdir);
        }
        if ((process.argv.length > 1) && ((process.argv[process.argv.length-1].indexOf(".json") > -1) || (process.argv[process.argv.length-1].indexOf(".flow") > -1))) {
            if (path.isAbsolute(process.argv[process.argv.length-1])) {
                flowfile = process.argv[process.argv.length-1];
            }
            else {
                flowfile = path.join(process.cwd(),process.argv[process.argv.length-1]);
            }
            store.set("flows",flowfile)
        }
        else {
            if (!fs.existsSync(userdir+"/"+flowfile)) {
                fs.writeFileSync(userdir+"/"+flowfile, fs.readFileSync(__dirname+"/"+flowfile));
            }
            let credFile = flowfile.replace(".json","_cred.json");
            if (fs.existsSync(__dirname+"/"+credFile) && !fs.existsSync(userdir+"/"+credFile)) {
                fs.writeFileSync(userdir+"/"+credFile, fs.readFileSync(__dirname+"/"+credFile));
            }
            flowfile = path.join(userdir,flowfile);
        }
    }
}
else { store.clear(); }

flowfile = store.get('flows',flowfile);

console.log("Store",app.getPath('userData'))
console.log("FlowFile :",flowfile);

// Keep a global reference of the window objects, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let conWindow;
let logBuffer = [];
let logLength = 250;    // No. of lines of console log to keep.
const levels = [ "", "fatal", "error", "warn", "info", "debug", "trace" ];

ipc.on('clearLogBuffer', function() { logBuffer = []; });

process.env.MW_CONTRIB_AMQP_USERNAME = '';
process.env.MW_CONTRIB_AMQP_PASSWORD = '';

// Create the settings object - see default settings.js file for other options
var settings = {
    MW_CONTRIB_AMQP_USERNAME: 'guest',
    MW_CONTRIB_AMQP_PASSWORD: 'guest',

    uiHost: "localhost",    // only allow local connections, remove if you want to allow external access
    uiPort: listenPort,
    httpAdminRoot: "/red",  // set to false to disable editor and deploy
    httpNodeRoot: "/",
    userDir: userdir,
    flowFile: flowfile,
    flowFilePretty: true,
    autoInstallModules: true,
    editorTheme: {
        projects:{ enabled:false },
        header: { title: options.productName },
        palette: { editable:addNodes }
    },    // enable projects feature
    functionGlobalContext: {
        dipSystem: '55d311a3-3cc3-4e34-a8be-e6f0820722a7',
        dipCategory: '96487241-babb-4eb3-bbf4-3f2d86f9aba7'
    },
    functionExternalModules: true,
    logging: {
        websock: {
            level: 'info',
            metrics: false,
            handler: function() {
                return function(msg) {
                    if (editable) {  // No logging if not editable
                        var ts = (new Date(msg.timestamp)).toISOString();
                        ts = ts.replace("Z"," ").replace("T"," ");
                        var line = "";
                        if (msg.type && msg.id) {
                            line = ts+" : ["+levels[msg.level/10]+"] ["+msg.type+":"+msg.id+"] "+msg.msg;
                        }
                        else {
                            line = ts+" : ["+levels[msg.level/10]+"] "+msg.msg;
                        }
                        logBuffer.push(line);
                        if (conWindow) { conWindow.webContents.send('debugMsg', line); }
                        if (logBuffer.length > logLength) { logBuffer.shift(); }
                    }
                }
            }
        }
    }
};
if (!editable) {
    settings.httpAdminRoot = false;
    settings.readOnly = true;
}

// Initialise the runtime with a server and settings
RED.init(server,settings);

// Serve the editor UI from /red (if editable)
if (settings.httpAdminRoot !== false) {
    red_app.use(settings.httpAdminRoot,RED.httpAdmin);
}

// Serve the http nodes UI from /
red_app.use(settings.httpNodeRoot,RED.httpNode);

// Create the console log window
function createConsole() {
    if (conWindow) { conWindow.show(); return; }
    // Create the hidden console window
    conWindow = new BrowserWindow({
        title: "Node-RED Console",
        width: 800,
        height: 600,
        icon: path.join(__dirname, nrIcon),
        autoHideMenuBar: true,
        // titleBarStyle: "hidden",
        webPreferences: {
            nodeIntegration: true,
            nativeWindowOpen: true,
            contextIsolation: false
        }
    });

    conWindow.loadURL(path.join(__dirname, urlconsole));
    conWindow.webContents.on('did-finish-load', () => {
        conWindow.webContents.send('logBuff', logBuffer);
    });
    conWindow.on('closed', () => {
        conWindow = null;
    });
    //conWindow.webContents.openDevTools();
    const touchButton5 = new TouchBarButton({
        label: 'Clear Log',
        backgroundColor: '#640000',
        click: () => { logBuffer = []; conWindow.webContents.send('logBuff', logBuffer); }
    });
    const consoleTouchBar = new TouchBar({
        items: [ touchButton5 ]
    });
    conWindow.setTouchBar(consoleTouchBar);
}

app.whenReady().then(() => {
    createConsole();
})

app.on('second-instance', (event, commandLine, workingDirectory) => {

})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') { app.quit(); }
});

app.on('activate', function() {
    
});

// Start the Node-RED runtime, then load the inital dashboard page
RED.start().then(function() {
    server.listen(listenPort,"localhost",function() {
       
    });
});
