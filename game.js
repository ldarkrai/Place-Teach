'use strict';

const STORAGE_KEY = 'teach_place_arena_v2';
const LIBRARIES = ['all', 'discord.js', 'discord.py', 'disnake', 'JDA'];

const LEVELS = [
  {
    id: 'djs-1', world: 'Fundamentos JS', library: 'discord.js', difficulty: 1, title: 'Eventos base',
    description: 'Listo, messageCreate y slash commands.',
    challenges: [
      { type: 'quiz', title: 'Evento correcto', prompt: '¿Qué evento se usa en discord.js v14 para mensajes nuevos?', options: ['message', 'messageCreate', 'newMessage', 'onMessage'], answer: 1, explanation: 'messageCreate es el evento vigente.' },
      { type: 'code', title: 'Completa el bloque', prompt: 'Elige la pieza correcta para inicializar el cliente.', code: "const { Client, GatewayIntentBits } = require('discord.js');\nconst client = new Client({\n  intents: [ ______ ]\n});", options: ['GatewayIntentBits.Guilds', 'BotIntent.GuildOnly', 'Client.Guilds()', 'IntentBits.Default'], answer: 0, explanation: 'Guilds es el intent mínimo para slash commands.' },
      { type: 'error', title: 'Detecta el error', prompt: '¿Qué línea está conceptualmente mal?', code: "await interaction.reply('Hola');\nawait interaction.reply('Otra vez');", options: ['La primera', 'La segunda', 'Ambas están bien', 'Falta un import'], answer: 1, explanation: 'No puedes usar reply() dos veces en la misma interacción.' }
    ]
  },
  {
    id: 'dpy-1', world: 'Python Flow', library: 'discord.py', difficulty: 2, title: 'Comandos y cogs',
    description: 'Decoradores, intents y organización.',
    challenges: [
      { type: 'quiz', title: 'Decorador de comando', prompt: '¿Qué decorador crea un comando clásico en discord.py?', options: ['@bot.command()', '@discord.command()', '@client.slash()', '@app.route()'], answer: 0, explanation: 'Ese decorador registra un comando prefix tradicional.' },
      { type: 'match', title: 'Empareja concepto y uso', prompt: 'Relaciona cada pieza con su propósito.', pairs: [
        ['commands.Cog', 'Agrupar listeners y comandos'],
        ['Intents.message_content', 'Leer texto del mensaje'],
        ['await bot.process_commands(message)', 'Permitir commands en on_message']
      ], explanation: 'Cada concepto cumple una función clave en la arquitectura de discord.py.' },
      { type: 'code', title: 'Rellena el import', prompt: 'Selecciona la opción correcta.', code: "from discord.ext import ______\n\nbot = commands.Bot(command_prefix='!')", options: ['commands', 'gateway', 'events', 'messages'], answer: 0, explanation: 'commands es el módulo habitual para bots clásicos.' }
    ]
  },
  {
    id: 'disnake-1', world: 'Interfaces ricas', library: 'disnake', difficulty: 2, title: 'UI y componentes',
    description: 'Views, botones y menús modernos.',
    challenges: [
      { type: 'quiz', title: 'View persistente', prompt: '¿Qué elemento encapsula botones y selects en disnake?', options: ['ActionFrame', 'View', 'WidgetTree', 'ComponentSet'], answer: 1, explanation: 'View es la clase usada para componentes interactivos.' },
      { type: 'error', title: 'Marca la opción errónea', prompt: '¿Cuál de estas afirmaciones es falsa?', options: ['Los botones pueden tener custom_id', 'Una View agrupa componentes', 'Los modales solo existen en Java', 'Se pueden usar selects'], answer: 2, explanation: 'Los modales existen también en librerías Python modernas.' },
      { type: 'code', title: 'Respuesta efímera', prompt: 'Elige el parámetro correcto.', code: "await inter.response.send_message('Hecho', ______=True)", options: ['ephemeral', 'private', 'hidden', 'silent'], answer: 0, explanation: 'ephemeral=True muestra la respuesta solo al usuario.' }
    ]
  },
  {
    id: 'jda-1', world: 'Java Stack', library: 'JDA', difficulty: 3, title: 'Eventos y builders',
    description: 'JDA para bots robustos en Java.',
    challenges: [
      { type: 'quiz', title: 'Builder principal', prompt: '¿Qué clase se usa para arrancar JDA?', options: ['JDABuilder', 'BotFactory', 'DiscordStarter', 'EventGateway'], answer: 0, explanation: 'JDABuilder es la entrada clásica en JDA.' },
      { type: 'match', title: 'Relaciona clase y papel', prompt: 'Une cada clase con su función.', pairs: [
        ['ListenerAdapter', 'Escuchar eventos'],
        ['SlashCommandInteractionEvent', 'Interacción de comando slash'],
        ['EmbedBuilder', 'Construir embeds']
      ], explanation: 'JDA separa claramente eventos, builders y listeners.' },
      { type: 'error', title: '¿Dónde está el fallo?', prompt: 'Elige la afirmación incorrecta sobre JDA.', options: ['Puede manejar slash commands', 'Se usa en Java', 'Requiere Flask para funcionar', 'Permite listeners'], answer: 2, explanation: 'Flask es de Python y no es requisito para JDA.' }
    ]
  }
];

const state = {
  storage: loadStorage(),
  library: 'all',
  activeLevel: null,
  pool: [],
  index: 0,
  score: 0,
  streak: 0,
  timer: null,
  seconds: 0,
  answered: false
};

const el = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  bindEvents();
  renderLibraryFilters();
  renderWorlds();
  renderProfile();
  renderLeaderboard();
  updateStats();
  initTheme();
});

function bindElements() {
  ['nicknameInput','saveNick','nickPreview','totalScore','bestStreak','completedLevels','libraryFilters','leaderboard','worldGrid','gameSection','gameMeta','gameTitle','runScore','timerText','progressFill','challengeCard','nextChallenge','leaveGame','quickStart','themeToggle','resetProgress','shuffleCatalog','openIdeas','closeIdeas','ideasDialog'].forEach(id => el[id] = document.getElementById(id));
}

function bindEvents() {
  el.saveNick.addEventListener('click', saveNick);
  el.quickStart.addEventListener('click', () => startLevel(sample(getFilteredLevels())));
  el.nextChallenge.addEventListener('click', nextChallenge);
  el.leaveGame.addEventListener('click', endRun);
  el.themeToggle.addEventListener('click', toggleTheme);
  el.resetProgress.addEventListener('click', resetAll);
  el.shuffleCatalog.addEventListener('click', renderWorlds);
  el.openIdeas.addEventListener('click', () => el.ideasDialog.showModal());
  el.closeIdeas.addEventListener('click', () => el.ideasDialog.close());
}

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { nick: '', leaderboard: [], totalScore: 0, bestStreak: 0, completed: [] };
  } catch {
    return { nick: '', leaderboard: [], totalScore: 0, bestStreak: 0, completed: [] };
  }
}

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storage)); }
function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function initTheme() {
  const saved = localStorage.getItem('teach_place_theme');
  document.documentElement.dataset.theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = current;
  localStorage.setItem('teach_place_theme', current);
}

function saveNick() {
  state.storage.nick = (el.nicknameInput.value || '').trim().slice(0, 18);
  persist();
  renderProfile();
  renderLeaderboard();
}

function renderProfile() {
  el.nicknameInput.value = state.storage.nick || '';
  el.nickPreview.textContent = state.storage.nick ? `Nick activo: ${state.storage.nick}` : 'Sin nickname guardado.';
}

function updateStats() {
  el.totalScore.textContent = state.storage.totalScore || 0;
  el.bestStreak.textContent = state.storage.bestStreak || 0;
  el.completedLevels.textContent = state.storage.completed.length || 0;
}

function renderLibraryFilters() {
  el.libraryFilters.innerHTML = '';
  LIBRARIES.forEach(lib => {
    const btn = document.createElement('button');
    btn.className = `pill ${state.library === lib ? 'active' : ''}`;
    btn.textContent = lib;
    btn.addEventListener('click', () => {
      state.library = lib;
      renderLibraryFilters();
      renderWorlds();
    });
    el.libraryFilters.appendChild(btn);
  });
}

function getFilteredLevels() {
  return LEVELS.filter(level => state.library === 'all' || level.library === state.library);
}

function renderWorlds() {
  const levels = shuffle(getFilteredLevels());
  el.worldGrid.innerHTML = '';
  levels.forEach(level => {
    const card = document.createElement('article');
    card.className = 'world-card';
    const completed = state.storage.completed.includes(level.id);
    card.innerHTML = `
      <div class="world-top">
        <div>
          <p class="section-kicker">${level.library}</p>
          <h4>${level.title}</h4>
        </div>
        <div class="world-badge">${completed ? '✓' : '⚙️'}</div>
      </div>
      <p class="muted">${level.description}</p>
      <div class="tag-row">
        <span class="micro-tag">${level.world}</span>
        <span class="micro-tag">Dificultad ${level.difficulty}</span>
        <span class="micro-tag">${level.challenges.length} retos</span>
      </div>
      <button class="primary-btn">Entrar</button>`;
    card.querySelector('button').addEventListener('click', () => startLevel(level));
    el.worldGrid.appendChild(card);
  });
}

function startLevel(level) {
  if (!level) return;
  clearTimer();
  state.activeLevel = level;
  state.pool = shuffle(level.challenges);
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  el.runScore.textContent = '0';
  el.gameSection.classList.remove('hidden');
  el.gameMeta.textContent = `${level.library} · ${level.world}`;
  el.gameTitle.textContent = level.title;
  renderChallenge();
  el.gameSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderChallenge() {
  state.answered = false;
  el.nextChallenge.classList.add('hidden');
  const challenge = state.pool[state.index];
  if (!challenge) return finishLevel();
  state.seconds = 35 + Math.max(0, 10 - state.activeLevel.difficulty * 2);
  startTimer();
  el.progressFill.style.width = `${(state.index / state.pool.length) * 100}%`;

  let html = `<span class="challenge-type">${challenge.type}</span><h4 class="challenge-title">${challenge.title}</h4><p>${challenge.prompt}</p>`;
