// preload.js – CommonJS
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePdf: (arrayBuffer) => ipcRenderer.invoke('save-pdf', arrayBuffer),
  sendWhatsApp: (phone, message) => ipcRenderer.invoke('send-whatsapp', { phone, message }),
  notify: (title, body) => new Notification({ title, body }).show()
});