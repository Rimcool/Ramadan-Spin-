// main.js – CommonJS version
const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

let mainWindow;
let notificationInterval;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      // Use __dirname so preload resolves correctly in packaged .exe builds.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // uncomment for debugging
  
  // Setup daily notifications
  setupDailyNotifications();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Setup daily notifications
function setupDailyNotifications() {
  // Check every minute if it's time to send notification
  notificationInterval = setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Send notification at 4:00 PM (16:00) - Iftar time
    // Change 16 to your preferred hour
    if (hour === 16 && minute === 0) {
      sendDailyMenuReminder();
    }
  }, 60000); // Check every minute
}

// Send daily menu reminder notification
function sendDailyMenuReminder() {
  try {
    const today = new Date().toLocaleDateString();
    // Try to read from app data
    const userDataPath = path.join(app.getPath('userData'), 'ramadan-data.json');
    
    if (fs.existsSync(userDataPath)) {
      const data = JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));
      if (data.todayMenu && data.todayMenu.date === today) {
        const notification = new Notification({
          title: '✨ Ramadan Iftar Time!',
          body: `🍽️ Today's menu: ${data.todayMenu.meal}\n📦 Prepare these ingredients: ${data.todayMenu.ingredients}`,
          icon: path.join(__dirname, 'assets', 'icon.png') // Optional: add app icon
        });
        notification.show();
        return;
      }
    }

    // Default reminder if no menu selected yet
    const notification = new Notification({
      title: '🌙 Ramadan Mubarak!',
      body: 'Don\'t forget to spin the wheel today to see your menu! ✨'
    });
    notification.show();
  } catch (error) {
    console.log('Notification error:', error);
  }
}

// IPC: Save PDF
ipcMain.handle('save-pdf', async (event, arrayBuffer) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Ramadan Plans PDF',
    defaultPath: path.join(app.getPath('documents'), 'Ramadan-Plans.pdf'),
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (!filePath) return { success: false, message: 'Save cancelled' };

  try {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// IPC: Send WhatsApp via Twilio
ipcMain.handle('send-whatsapp', async (event, { phone, message }) => {
  const accountSid = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';   // ← YOUR Twilio SID
  const authToken  = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';    // ← YOUR Twilio Token
  const fromNumber = 'whatsapp:+14155238886';               // ← Twilio sandbox number

  if (!accountSid.includes('AC') || !authToken) {
    return { success: false, message: 'Twilio credentials missing' };
  }

  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        To: `whatsapp:${phone.replace('+', '')}`,
        From: fromNumber,
        Body: message
      }),
      {
        auth: { username: accountSid, password: authToken }
      }
    );
    return { success: true };
  } catch (err) {
    console.error(err.response?.data || err.message);
    return { success: false, message: 'Failed to send WhatsApp' };
  }
});