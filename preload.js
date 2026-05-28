const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  transaction: (queries) => ipcRenderer.invoke('db:transaction', queries),
  printReceipt: (htmlContent, printerName, paperSize) => ipcRenderer.invoke('print:receipt', htmlContent, printerName, paperSize),
  getPrinters: () => ipcRenderer.invoke('printer:list'),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  backupDatabase: (destPath) => ipcRenderer.invoke('backup:db', destPath),
  restoreDatabase: (srcPath) => ipcRenderer.invoke('restore:db', srcPath),
  getBackupDir: () => ipcRenderer.invoke('backup:get-dir'),
  hashPassword: (plain) => ipcRenderer.invoke('auth:hash-password', plain),
  closeApp: () => ipcRenderer.send('app:close')
});
