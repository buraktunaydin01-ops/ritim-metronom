"use strict";

const path = require("node:path");
const { app, BrowserWindow, Menu, session } = require("electron");

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 770,
    height: 960,
    minWidth: 540,
    minHeight: 680,
    show: false,
    backgroundColor: "#0b1020",
    title: "Ritim — Metronom",
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // Metronom, başka bir pencereye geçildiğinde de tempoyu sürdürür.
      backgroundThrottling: false,
      devTools: !app.isPackaged,
    },
  });

  // Yalnızca bu uygulamayla birlikte gelen, çevrimdışı dosyalar yüklenir.
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("will-redirect", (event) => event.preventDefault());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createMenu() {
  const menu = [
    {
      label: app.name,
      submenu: [
        { role: "about", label: "Ritim Hakkında" },
        { type: "separator" },
        { role: "hide", label: "Ritim'i Gizle" },
        { role: "hideOthers", label: "Diğerlerini Gizle" },
        { role: "unhide", label: "Tümünü Göster" },
        { type: "separator" },
        { role: "quit", label: "Ritim'den Çık" },
      ],
    },
    {
      label: "Dosya",
      submenu: [
        { role: "close", label: "Pencereyi Kapat" },
      ],
    },
    {
      label: "Düzen",
      submenu: [
        { role: "undo", label: "Geri Al" },
        { role: "redo", label: "Yinele" },
        { type: "separator" },
        { role: "cut", label: "Kes" },
        { role: "copy", label: "Kopyala" },
        { role: "paste", label: "Yapıştır" },
        { role: "selectAll", label: "Tümünü Seç" },
      ],
    },
    {
      label: "Görünüm",
      submenu: [
        { role: "reload", label: "Yeniden Yükle" },
        { role: "togglefullscreen", label: "Tam Ekran" },
      ],
    },
    {
      label: "Pencere",
      submenu: [
        { role: "minimize", label: "Küçült" },
        { role: "zoom", label: "Yakınlaştır" },
        { type: "separator" },
        { role: "front", label: "Tümünü Öne Getir" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

app.whenReady().then(() => {
  // Uygulama herhangi bir internet izni istemez.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createMenu();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
