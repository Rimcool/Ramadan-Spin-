// renderer.js - Main frontend logic for Ramadan Spin app

let menuItems = [];
let currentRotation = 0;
let isSpinning = false;
const STORAGE_KEY = 'ramadan_menus';
const TODAY_KEY = 'ramadan_today';

// Drink suggestions for variety
const drinkSuggestions = [
  { name: 'Roohafza Shake', emoji: '🍶', desc: 'Classic chilled Roohafza with milk' },
  { name: 'Tangs Fresh Juice', emoji: '🧃', desc: 'Cool and refreshing Tangs juice' },
  { name: 'Lassi', emoji: '🥛', desc: 'Traditional yogurt-based drink' },
  { name: 'Shakes & Smoothies', emoji: '🥤', desc: 'Mango, Banana, or Strawberry shake' },
  { name: 'Fresh Mint Lemonade', emoji: '🍋', desc: 'Fresh mint with lemon and sugar' },
  { name: 'Sweet Falsa Juice', emoji: '🧋', desc: 'Traditional blackberry juice' },
  { name: 'Sugarcane Juice', emoji: '🌾', desc: 'Fresh sugarcane with lemon' },
  { name: 'Fruit Punch', emoji: '🍊', desc: 'Mixed fruit punch with ice' }
];

// Get DOM elements
const plansInput = document.getElementById('plans');
const phoneInput = document.getElementById('phone');
const generateBtn = document.getElementById('generate-btn');
const loadBtn = document.getElementById('load-btn');
const wheelSection = document.getElementById('wheel-section');
const wheelCanvas = document.getElementById('wheel');
const spinBtn = document.getElementById('spin-btn');
const resultBox = document.getElementById('result-box');
const dailyStatus = document.getElementById('daily-status');
const successMsg = document.getElementById('success-msg');
const planSection = document.querySelector('.plan-section');

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
  loadMenusFromStorage();
  checkTodayMenu();
  setupEventListeners();
});

function setupEventListeners() {
  if (generateBtn) generateBtn.addEventListener('click', generatePDFAndSave);
  else console.warn('generate-btn not found');

  if (loadBtn) loadBtn.addEventListener('click', loadPDFMenus);
  else console.warn('load-btn not found');

  if (spinBtn) spinBtn.addEventListener('click', spinWheel);
  else console.warn('spin-btn not found');
}

// Load menus from localStorage
function loadMenusFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    menuItems = JSON.parse(saved);
  }
}

// Hide form after setup and keep only wheel section open
function enableSpinOnlyMode() {
  if (planSection) planSection.style.display = 'none';
}

// Parse menu items from textarea
function parseMenuItems(text) {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const hasStructuredMarkdown = lines.some(line =>
    /^#{1,6}\s*day\s*\d+/i.test(line) || /^\*{1,2}\s*(sehri|suhoor|iftari|iftar)\s*\*{1,2}\s*:?$/i.test(line)
  );

  // Handle markdown weekly format:
  // ### Day 1 (Monday)
  // **Sehri**
  // - item
  // **Iftari**
  // - item
  if (hasStructuredMarkdown) {
    const groupedMenus = new Map();
    let currentDay = 'Day';
    let currentType = null;

    for (const line of lines) {
      const dayMatch = line.match(/^#{1,6}\s*(day\s*\d+(?:\s*\([^)]+\))?)/i) || line.match(/^(day\s*\d+(?:\s*\([^)]+\))?)/i);
      if (dayMatch) {
        currentDay = dayMatch[1].replace(/\s+/g, ' ').trim();
        currentType = null;
        continue;
      }

      const sectionMatch = line.match(/^\*{1,2}\s*(sehri|suhoor|iftari|iftar)\s*\*{1,2}\s*:?$/i);
      if (sectionMatch) {
        const section = sectionMatch[1].toLowerCase();
        currentType = (section === 'iftar' || section === 'iftari') ? 'iftari' : 'sehri';
        continue;
      }

      if (!currentType) continue;

      const menuLine = line.replace(/^[-•]\s*/, '').trim();
      if (!menuLine) continue;

      const key = `${currentDay}|${currentType}`;
      if (!groupedMenus.has(key)) groupedMenus.set(key, []);
      groupedMenus.get(key).push(menuLine);
    }

    const structuredItems = [];
    for (const [key, items] of groupedMenus.entries()) {
      const [day, type] = key.split('|');
      if (!items.length) continue;
      structuredItems.push({
        meal: `${day} ${type === 'iftari' ? 'Iftari' : 'Sehri'}`,
        ingredients: items.join(', '),
        type
      });
    }

    if (structuredItems.length > 0) return structuredItems;
  }

  // Fallback: plain line-by-line format
  return lines.map(line => {
    let cleanedLine = line;
    let type = 'general';

    const categoryMatch = line.match(/^(?:\*{1,2})?\s*(iftar|iftari|sehri|suhoor)\s*(?:\*{1,2})?\s*:\s*/i);
    if (categoryMatch) {
      const category = categoryMatch[1].toLowerCase();
      if (category === 'iftar' || category === 'iftari') type = 'iftari';
      if (category === 'sehri' || category === 'suhoor') type = 'sehri';
      cleanedLine = line.replace(/^(?:\*{1,2})?\s*(iftar|iftari|sehri|suhoor)\s*(?:\*{1,2})?\s*:\s*/i, '').trim();
    }

    const parts = cleanedLine.split('-');
    const meal = parts[0].trim();
    const ingredients = parts.length > 1 ? parts.slice(1).join('-').trim() : 'No ingredients specified';
    return { meal, ingredients, type };
  });
}

// Generate PDF
async function generatePDFAndSave() {
  const text = plansInput.value.trim();
  if (!text) {
    alert('Please enter at least one menu item!');
    return;
  }

  menuItems = parseMenuItems(text);
  if (!menuItems.length) {
    alert('Could not read menu format. Please add Sehri/Iftari items and try again.');
    return;
  }
  const phone = phoneInput.value.trim();

  try {
    const pdfContent = generatePDFContent(menuItems);
    const success = await savePDF(pdfContent);

    if (success) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(menuItems));
      successMsg.style.display = 'block';
      setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
      showWheelSection();
      drawWheel();
      checkTodayMenu();
      enableSpinOnlyMode();
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error generating PDF: ' + error.message);
  }
}

// Generate simple PDF content
function generatePDFContent(items) {
  let content = `Ramadan Menu Plan\n\n`;
  items.forEach((item, index) => {
    content += `${index + 1}. ${item.meal}\n`;
    content += `   Ingredients: ${item.ingredients}\n\n`;
  });
  return content;
}

// Save PDF via Electron IPC
async function savePDF(content) {
  const arrayBuffer = new TextEncoder().encode(content);
  const result = await window.electronAPI.savePdf(arrayBuffer);
  return result.success;
}

// Show wheel section
function showWheelSection() {
  wheelSection.style.display = 'block';
}

// Draw wheel with menu items
function drawWheel() {
  if (menuItems.length === 0) return;

  const ctx = wheelCanvas.getContext('2d');
  const centerX = wheelCanvas.width / 2;
  const centerY = wheelCanvas.height / 2;
  const radius = wheelCanvas.width / 2 - 30;
  const sliceAngle = (2 * Math.PI) / menuItems.length;

  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52A3A3'];

  menuItems.forEach((item, index) => {
    const startAngle = index * sliceAngle;
    const endAngle = startAngle + sliceAngle;

    ctx.fillStyle = colors[index % colors.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Poppins';
    ctx.fillText(item.meal.substring(0, 20), radius - 30, 5);
    ctx.restore();
  });

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 16px Poppins';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIN', centerX, centerY);
}

// Create complete day menu with drinks
function createDayMenu(item, index) {
  const shuffledDrinks = [...drinkSuggestions].sort(() => Math.random() - 0.5);
  const selectedDrinks = shuffledDrinks.slice(0, 4);

  const iftariItems = menuItems.filter(menu => menu.type === 'iftari');
  const sehriItems = menuItems.filter(menu => menu.type === 'sehri');
  const generalItems = menuItems.filter(menu => !menu.type || menu.type === 'general');

  let iftariItem = null;
  let sehriItem = null;

  if (item.type === 'iftari') {
    iftariItem = item;
    sehriItem = sehriItems[Math.floor(Math.random() * sehriItems.length)] || generalItems.find(menu => menu.meal !== item.meal) || item;
  } else if (item.type === 'sehri') {
    sehriItem = item;
    iftariItem = iftariItems[Math.floor(Math.random() * iftariItems.length)] || generalItems.find(menu => menu.meal !== item.meal) || item;
  } else {
    iftariItem = iftariItems[Math.floor(Math.random() * iftariItems.length)] || item;
    sehriItem = sehriItems[Math.floor(Math.random() * sehriItems.length)] || generalItems.find(menu => menu.meal !== iftariItem.meal) || item;
  }

  return {
    iftari: iftariItem,
    sehri: sehriItem,
    drinks: {
      iftari: selectedDrinks.slice(0, 2),
      sehri: selectedDrinks.slice(2, 4)
    },
    mealNumber: index + 1
  };
}

// Spin wheel
function spinWheel() {
  if (isSpinning || menuItems.length === 0) return;

  isSpinning = true;
  spinBtn.disabled = true;
  spinBtn.textContent = 'SPINNING... 🌀';

  const spins = Math.floor(Math.random() * 5) + 5;
  const randomAngle = Math.random() * 360;
  const totalRotation = spins * 360 + randomAngle;
  const duration = 3000;
  const startTime = Date.now();
  const startRotation = currentRotation;

  function animateSpin() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    currentRotation = startRotation + totalRotation * easeProgress;
    wheelCanvas.style.transform = `rotate(${currentRotation}deg)`;

    if (progress < 1) {
      requestAnimationFrame(animateSpin);
    } else {
      isSpinning = false;
      spinBtn.disabled = false;
      spinBtn.textContent = 'SPIN 🌀';

      const normalizedRotation = currentRotation % 360;
      const sliceAngle = 360 / menuItems.length;
      const selectedIndex = Math.floor((360 - normalizedRotation) / sliceAngle) % menuItems.length;
      const selected = menuItems[selectedIndex];

      const dayMenu = createDayMenu(selected, selectedIndex);
      const today = new Date().toLocaleDateString();
      localStorage.setItem(TODAY_KEY, JSON.stringify({ date: today, ...dayMenu }));

      showResult(dayMenu);
      sendNotification(dayMenu);
    }
  }

  animateSpin();
}

// Show result with complete day menu
function showResult(dayMenu) {
  // Backward compatibility for older saved format (single meal)
  if (!dayMenu.iftari && dayMenu.meal) {
    dayMenu = {
      ...dayMenu,
      iftari: { meal: dayMenu.meal, ingredients: dayMenu.ingredients || '-' },
      sehri: { meal: dayMenu.meal, ingredients: dayMenu.ingredients || '-' },
      drinks: {
        iftari: dayMenu.drinks?.slice ? dayMenu.drinks.slice(0, 2) : (dayMenu.drinks?.iftari || []),
        sehri: dayMenu.drinks?.slice ? dayMenu.drinks.slice(2, 4) : (dayMenu.drinks?.sehri || [])
      }
    };
  }

  const iftariDrinksHTML = (dayMenu.drinks?.iftari || [])
    .map(drink => `<div style="background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 15px; margin: 10px 0; transition: all 0.3s ease;">🍷 <strong style="color: #FFE5B4;">${drink.name}</strong><br><span style="font-size: 0.9rem; opacity: 0.9; color: var(--light-gold);">${drink.desc}</span></div>`)
    .join('');

  const sehriDrinksHTML = (dayMenu.drinks?.sehri || [])
    .map(drink => `<div style="background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 15px; margin: 10px 0; transition: all 0.3s ease;">🥛 <strong style="color: #FFE5B4;">${drink.name}</strong><br><span style="font-size: 0.9rem; opacity: 0.9; color: var(--light-gold);">${drink.desc}</span></div>`)
    .join('');

  document.getElementById('today-menu').innerHTML = `
    <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,215,0,0.3);">
      <h3 style="color: var(--gold); margin-bottom: 8px; font-size: 1.4rem;">🌇 Iftari: ${dayMenu.iftari?.meal || 'Not selected'}</h3>
      <p style="font-size: 0.95rem; color: var(--light-gold);">📦 <strong>Ingredients:</strong> ${dayMenu.iftari?.ingredients || '-'}</p>
      <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">${iftariDrinksHTML}</div>
    </div>
    <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,215,0,0.3);">
      <h3 style="color: var(--gold); margin-bottom: 8px; font-size: 1.4rem;">🌙 Sehri: ${dayMenu.sehri?.meal || 'Not selected'}</h3>
      <p style="font-size: 0.95rem; color: var(--light-gold);">📦 <strong>Ingredients:</strong> ${dayMenu.sehri?.ingredients || '-'}</p>
      <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">${sehriDrinksHTML}</div>
    </div>
  `;
  resultBox.style.display = 'block';
}

// Check if there's a menu for today
function checkTodayMenu() {
  const today = new Date().toLocaleDateString();
  const saved = localStorage.getItem(TODAY_KEY);

  if (saved) {
    const todayData = JSON.parse(saved);
    if (todayData.date === today) {
      dailyStatus.textContent = `📅 Today's Menu Already Prepared!`;
      showResult(todayData);
      return;
    }
  }

  dailyStatus.textContent = `🎡 Spin the wheel to get today's menu!`;
  resultBox.style.display = 'none';
}

// Send notification
function sendNotification(dayMenu) {
  const title = '✨ Your Ramadan Menu for Today';
  const body = `🌇 Iftari: ${dayMenu.iftari?.meal || '-'}\n🌙 Sehri: ${dayMenu.sehri?.meal || '-'}`;
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '🪔',
      badge: '🌙'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
}

// Load PDF
function loadPDFMenus() {
  alert('PDF import feature coming soon! For now, please paste your menu items directly.');
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
