const fs = require('fs');

const content = `// renderer.js - Main frontend logic for Ramadan Spin app

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

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
  loadMenusFromStorage();
  checkTodayMenu();
  setupEventListeners();
});

function setupEventListeners() {
  generateBtn.addEventListener('click', generatePDFAndSave);
  loadBtn.addEventListener('click', loadPDFMenus);
  spinBtn.addEventListener('click', spinWheel);
}

// Load menus from localStorage
function loadMenusFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    menuItems = JSON.parse(saved);
    showWheelSection();
    drawWheel();
  }
}

// Parse menu items from textarea
function parseMenuItems(text) {
  return text
    .split('\\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split('-');
      const meal = parts[0].trim();
      const ingredients = parts.length > 1 ? parts[1].trim() : 'No ingredients specified';
      return { meal, ingredients };
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
      document.querySelector('.plan-section').style.opacity = '0.5';
      generateBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error generating PDF: ' + error.message);
  }
}

// Generate simple PDF content
function generatePDFContent(items) {
  let content = \`Ramadan Menu Plan\\n\\n\`;
  items.forEach((item, index) => {
    content += \`\${index + 1}. \${item.meal}\\n\`;
    content += \`   Ingredients: \${item.ingredients}\\n\\n\`;
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
  const shuffledDrinks = drinkSuggestions.sort(() => Math.random() - 0.5);
  const selectedDrinks = shuffledDrinks.slice(0, 3);
  return {
    meal: item.meal,
    ingredients: item.ingredients,
    drinks: selectedDrinks,
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
    wheelCanvas.style.transform = \`rotate(\${currentRotation}deg)\`;

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
      sendNotification(selected);
    }
  }

  animateSpin();
}

// Show result with complete day menu
function showResult(dayMenu) {
  let drinksHTML = dayMenu.drinks
    .map(drink => \`<div style="background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 15px; margin: 10px 0; transition: all 0.3s ease;">🍷 <strong style="color: #FFE5B4;">\${drink.name}</strong><br><span style="font-size: 0.9rem; opacity: 0.9; color: var(--light-gold);">\${drink.desc}</span></div>\`)
    .join('');

document.getElementById('today-menu').innerHTML = \`
    <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,215,0,0.3);">
      <h3 style="color: var(--gold); margin-bottom: 8px; font-size: 1.4rem;">🍽️ \${dayMenu.meal}</h3>
      <p style="font-size: 0.95rem; color: var(--light-gold);">📦 <strong>Ingredients:</strong> \${dayMenu.ingredients}</p>
    </div>
    <div style="margin-top: 15px;">
      <h4 style="color: var(--light-gold); margin-bottom: 15px; font-size: 1.2rem;">🥤 Suggested Drinks & Shakes:</h4>
      <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
        \${drinksHTML}
      </div>
    </div>
  \`;
  resultBox.style.display = 'block';
}

// Check if there's a menu for today
function checkTodayMenu() {
  const today = new Date().toLocaleDateString();
  const saved = localStorage.getItem(TODAY_KEY);

  if (saved) {
    const todayData = JSON.parse(saved);
    if (todayData.date === today) {
      dailyStatus.textContent = \`📅 Today's Menu Already Prepared!\`;
      showResult(todayData);
      return;
    }
  }

  dailyStatus.textContent = \`🎡 Spin the wheel to get today's menu!\`;
  resultBox.style.display = 'none';
}

// Send notification
function sendNotification(item) {
  const title = '✨ Your Ramadan Menu for Today';
  const body = \`🍽️ \${item.meal}\\n\\n📦 Prepare: \${item.ingredients}\`;
  
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
`;

fs.writeFileSync('renderer.js', content, 'utf8');
console.log('renderer.js has been recreated successfully!');
