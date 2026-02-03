// 1. VARIÁVEIS GLOBAIS
let timerWorker; 
let endTime;
let timeLeft;
let isPaused = false;
let mode = 'foco'; 
let annoyInterval;
let chaseInterval;
let myChart; 
let chartMode = 'semanal'; 
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let globalVolume = localStorage.getItem('userVolume') || 0.5;

// 2. INICIALIZAÇÃO
window.onload = function() {
    renderChart();
    renderTodos();
    
    // 1. CARREGAR PREFERÊNCIAS SALVAS
    if(localStorage.getItem('savedFocusTime')) {
        document.getElementById('focusTime').value = localStorage.getItem('savedFocusTime');
        document.getElementById('breakTime').value = localStorage.getItem('savedBreakTime');
        // Carrega a meta ou usa 8 como padrão caso não exista
        document.getElementById('dailyGoal').value = localStorage.getItem('savedDailyGoal') || 8;
        document.getElementById('volumeControl').value = localStorage.getItem('userVolume') || 0.5;
        
        // Define o tempo inicial baseado no modo atual (Foco ou Pausa)
        const savedTime = (mode === 'foco') ? 
            document.getElementById('focusTime').value : 
            document.getElementById('breakTime').value;
            
        timeLeft = savedTime * 60;
    } else {
        // Caso seja a primeira vez do usuário no site (sem dados no localStorage)
        timeLeft = 25 * 60;
    }

    // 2. ATUALIZAR O VISOR
    updateDisplay();

    // 3. SOLICITAR PERMISSÃO DE NOTIFICAÇÕES (Se ainda não foi decidida)
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
};

function updateDisplay() {
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    document.getElementById('timer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 3. LÓGICA DO TIMER
function startTimer() {
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    if (!endTime) {
        const minutes = (mode === 'foco') ? 
            document.getElementById('focusTime').value : 
            document.getElementById('breakTime').value;
        endTime = Date.now() + (minutes * 60 * 1000);
    }

    isPaused = false;
    document.getElementById('btn-start').style.display = "none";
    document.getElementById('btn-pause').style.display = "inline-block";
    document.getElementById('btn-pause').innerText = "PAUSAR";
    document.getElementById('status').innerText = (mode === 'foco') ? "TRABALHANDO..." : "DESCANSO LIBERADO";

    if (!timerWorker) {
        timerWorker = new Worker('worker.js');
    }

    timerWorker.onmessage = function() {
        if (!isPaused) {
            const now = Date.now();
            const difference = endTime - now;
            timeLeft = Math.max(0, Math.round(difference / 1000));

            updateDisplay();

// Procure este trecho dentro da sua function startTimer()
if (timeLeft <= 0 && endTime !== null) {
    // 1. Zera as variáveis de tempo IMEDIATAMENTE
    stopWorker();
    endTime = null; 
    
    if (mode === 'foco') {
        // 2. SALVA O PROGRESSO (Isso vai disparar o renderChart interno)
        saveProgress(); 
        
        // 3. TOCA O SOM
        playAlertSound();  
        
        // 4. MUDA A INTERFACE
        completeFoco();
    } else {
        playAlertSound();
        startAnnoyingMode();
    }
}
        }
    };
}

function stopWorker() {
    if (timerWorker) {
        timerWorker.terminate();
        timerWorker = null;
    }
}

function pauseTimer() {
    if (!timerWorker) return;
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('btn-pause').innerText = "RETOMAR";
        document.getElementById('status').innerText = "PAUSADO (ENROLANDO?)";
        speak("Você está parando o seu progresso.");
    } else {
        window.speechSynthesis.cancel();
        endTime = Date.now() + (timeLeft * 1000);
        document.getElementById('btn-pause').innerText = "PAUSAR";
        document.getElementById('status').innerText = (mode === 'foco') ? "VOLTOU!" : "RECOMEÇOU!";
    }
}

// 4. CICLOS E INTERFACE
function completeFoco() {
    // Definimos o modo como pausa primeiro
    mode = 'pausa';
    
    // 1. AVISO VISUAL
    showStatusBanner("Ciclo concluído! Eu autorizo seu descanso.");
    
    // 2. AVISO SONORO E VOZ
    playBeep();
    speak("Ciclo de foco terminado. Hora de meditar.");

    // 3. ATUALIZA INTERFACE (Muda o botão para INICIAR PAUSA)
    document.getElementById('status').innerText = "DESCANSO LIBERADO";
    document.getElementById('btn-start').style.display = "inline-block";
    document.getElementById('btn-start').innerText = "INICIAR PAUSA";
    document.getElementById('btn-pause').style.display = "none";
    
    // 4. PREPARA O TEMPO DA PAUSA NO VISOR
    timeLeft = document.getElementById('breakTime').value * 60;
    updateDisplay();

    // 5. NOTIFICAÇÃO DE SISTEMA
    sendNotification("Pomodoro", "Ciclo concluído!");
}

function startAnnoyingMode() {
    showStatusBanner("A PAUSA ACABOU! VOLTE AO TRABALHO!");
    
    // 1. Esconde os botões normais para o usuário não se confundir
    document.getElementById('btn-start').style.display = "none";
    document.getElementById('btn-pause').style.display = "none";
    
    // 2. Mostra o botão de emergência para parar o barulho
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
        btnBack.style.display = "inline-block";
        btnBack.innerText = "PARAR ALERTA E VOLTAR AO FOCO";
    }
    
    // 3. Inicia o efeito visual e sonoro irritante
    annoyInterval = setInterval(() => {
        document.body.classList.toggle('annoy-mode');
        playBeep();
    }, 400);

    // 4. Inicia a voz de cobrança
    chaseInterval = setInterval(() => {
        speak("Sua pausa terminou. Volte ao trabalho imediatamente.");
    }, 4000);
    
    sendNotification("Atenção!", "Pausa encerrada.");
}

function completeCycle() {
    // 1. Para o barulho e o visual de erro
    clearInterval(annoyInterval);
    clearInterval(chaseInterval);
    document.body.classList.remove('annoy-mode');
    document.getElementById('msg').style.display = 'none';
    window.speechSynthesis.cancel();

    // 2. MUDA O MODO PARA FOCO
    mode = 'foco';
    
    // 3. ATUALIZA O BOTÃO E O STATUS
    const btnStart = document.getElementById('btn-start');
    btnStart.style.display = "inline-block";
    btnStart.innerText = "INICIAR FOCO"; // Aqui está a correção
    
    document.getElementById('btn-pause').style.display = "none";
    document.getElementById('btn-back').style.display = "none";
    document.getElementById('status').innerText = "PRONTO PARA RECOMEÇAR?";

    // 4. RESETAR O TEMPO PARA O VALOR DE FOCO SALVO
    timeLeft = document.getElementById('focusTime').value * 60;
    updateDisplay();
    
    showStatusBanner("Ciclo completo! De volta ao trabalho.");
}

// 5. SISTEMA DE REGISTRO E GRÁFICOS
// ... final da Seção 4 (Ciclos e Interface) ...

// 5. SISTEMA DE REGISTRO E GRÁFICOS
function saveProgress() {
    let history = JSON.parse(localStorage.getItem('focusHistory')) || {};
    let today = new Date().toLocaleDateString(); 
    
    // Soma +1
    history[today] = (history[today] || 0) + 1;
    
    // Grava no localStorage
    localStorage.setItem('focusHistory', JSON.stringify(history));
    
    // ESSA LINHA ABAIXO É O QUE MUDA O GRÁFICO NA HORA
    renderChart();
}


function changeChartMode(m) {
    chartMode = m;
    renderChart();
}

function renderChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let history = JSON.parse(localStorage.getItem('focusHistory')) || {};
    let labels = [];
    let dataDone = [];
    let dataLeft = [];
    let today = new Date().toLocaleDateString();
    const userGoal = parseInt(document.getElementById('dailyGoal').value) || 8;

    if (chartMode === 'semanal') {
        for (let i = 6; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = d.toLocaleDateString();
            
            labels.push(dateStr.split('/')[0] + '/' + dateStr.split('/')[1]);
            
            let done = history[dateStr] || 0;
            dataDone.push(done);
            dataLeft.push(Math.max(0, userGoal - done)); // O que falta no dia
        }
    } else {
        labels = ['Restante', 'Concluído'];
        const completedToday = history[today] || 0;
        dataDone = [Math.max(0, userGoal - completedToday), completedToday]; 
    }

    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: chartMode === 'semanal' ? 'bar' : 'doughnut',
        data: {
            labels: labels,
            datasets: chartMode === 'semanal' ? [
                {
                    label: 'Concluído',
                    data: dataDone,
                    backgroundColor: '#2ecc71'
                },
                {
                    label: 'Restante',
                    data: dataLeft,
                    backgroundColor: '#333' // Cor escura para o que falta
                }
            ] : [{
                data: dataDone,
                backgroundColor: ['#333', '#2ecc71'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            scales: chartMode === 'semanal' ? {
                x: { stacked: true, ticks: { color: '#fff' } },
                y: { stacked: true, ticks: { color: '#fff' } }
            } : {},
            plugins: { 
                legend: { 
                    display: true, 
                    labels: { color: '#fff' } 
                } 
            },
            cutout: chartMode === 'semanal' ? 0 : '75%'
        }
    });
}

// 6. TAREFAS
function addTodo() {
    const input = document.getElementById('todoText');
    if (input.value.trim() === "") return;
    todos.push({ text: input.value, done: false });
    input.value = "";
    saveTodos();
    renderTodos();
}

function renderTodos() {
    const list = document.getElementById('todoList');
    list.innerHTML = "";
    todos.forEach((todo, index) => {
        list.innerHTML += `
            <li style="display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.1); margin-bottom:5px; padding:8px; border-radius:5px;">
                <span class="${todo.done ? 'todo-done' : ''}" onclick="toggleTodo(${index})" style="cursor:pointer; flex-grow:1;">${todo.text}</span>
                <button onclick="deleteTodo(${index})" style="background:none; border:none; color:red; cursor:pointer;">X</button>
            </li>`;
    });
}
function saveTodos() { localStorage.setItem('todos', JSON.stringify(todos)); }
function toggleTodo(i) { todos[i].done = !todos[i].done; saveTodos(); renderTodos(); }
function deleteTodo(i) { todos.splice(i, 1); saveTodos(); renderTodos(); }

// 7. SONS E VOZ
function playAlertSound() {
    playBeep();
    speak("Ciclo concluído. Excelente trabalho.");
}

function speak(t) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = 'pt-BR';
        
        // --- APLICA O VOLUME AQUI TAMBÉM ---
        u.volume = globalVolume; 
        
        window.speechSynthesis.speak(u);
    }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep() {
    // 1. Cria o oscilador (o gerador de som)
    const osc = audioCtx.createOscillator();
    // 2. Cria o ganho (o controlador de volume)
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    
    // CONEXÃO: Oscilador -> Volume -> Saída de Som
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    
    // --- AQUI ESTÁ A MUDANÇA ---
    // Multiplicamos por 0.1 para que o som não seja "estourado" 
    // mesmo quando o volume estiver no máximo (1.0).
    gain.gain.setValueAtTime(globalVolume * 0.1, audioCtx.currentTime); 
    
    osc.start(); 
    osc.stop(audioCtx.currentTime + 0.1);
}

function sendNotification(title, message) {
    // SÓ envia se tiver permissão E se a página estiver escondida (em segundo plano)
    if (Notification.permission === "granted" && document.hidden) {
        const notif = new Notification(title, {
            body: message,
            icon: "elfa-foco.jpg"
        });

        // Fecha sozinha rápido para não entulhar o centro de notificações
        setTimeout(() => notif.close(), 4000);
    }
}

function showStatusBanner(text) {
    // Tenta encontrar um banner já existente ou cria um novo
    let banner = document.getElementById('status-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'status-banner';
        // Estilo rápido via JS (você pode mover para o CSS depois)
        Object.assign(banner.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#2ecc71',
            color: 'white',
            padding: '15px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            zIndex: '9999',
            fontWeight: 'bold',
            transition: 'opacity 0.5s ease'
        });
        document.body.appendChild(banner);
    }
    
    banner.innerText = text;
    banner.style.opacity = '1';
    
    // Some sozinho após 5 segundos
    setTimeout(() => {
        banner.style.opacity = '0';
    }, 5000);
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function updateVolume() {
    globalVolume = parseFloat(document.getElementById('volumeControl').value);
    localStorage.setItem('userVolume', globalVolume);
}

function savePreferences() {
    const focusVal = document.getElementById('focusTime').value;
    const breakVal = document.getElementById('breakTime').value;
    const goalVal = document.getElementById('dailyGoal').value;
    const volVal = document.getElementById('volumeControl').value;

    // Salva tudo no LocalStorage
    localStorage.setItem('savedFocusTime', focusVal);
    localStorage.setItem('savedBreakTime', breakVal);
    localStorage.setItem('savedDailyGoal', goalVal);
    localStorage.setItem('userVolume', volVal);
    
    globalVolume = parseFloat(volVal);
    
    // Atualiza o timer se estiver parado
    if (!timerWorker) {
        timeLeft = (mode === 'foco' ? focusVal : breakVal) * 60;
        updateDisplay();
    }

    // Atualiza o gráfico para refletir a nova meta imediatamente
    renderChart();

    showStatusBanner("Configurações Arcanas Atualizadas!");
    toggleSettings();
}