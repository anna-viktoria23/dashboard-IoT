// script.js — Dashboard IoT | SENAI Ítalo Bologna
//
// SUBSCRIBER: recebe dados do sensor de presença + LDR do Pico
// O LED é acionado automaticamente pelo Pico ao detectar presença.
// O dashboard apenas reflete o estado recebido via MQTT.
//
// Formato esperado das mensagens:
//   "presenca:1,ldr:72.3,led:on"
//   "presenca:0,ldr:45.1,led:off"
//
// Câmera: stream MJPEG via URL HTTP (ex: http://192.168.1.XX:8080/video)

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
const CONFIG = {
    broker:     "ws://192.168.1.XXX:8000",  // ← IP do broker + porta WebSocket
    topicSub:   "senai/grupo1/sensores",     // ← tópico que o Pico publica
    clientId:   "dashboard_" + Math.random().toString(16).slice(2, 8),
    cameraUrl:  "http://192.168.1.XXX:8080/video"  // ← URL do stream MJPEG da câmera
}

// ─── VARIÁVEIS DE ESTADO ──────────────────────────────────────────────────────
let cliente = null

// ─── ELEMENTOS DO DOM ────────────────────────────────────────────────────────
const statusDot      = document.getElementById("status-dot")
const statusTexto    = document.getElementById("status-texto")
const ultimaAtu      = document.getElementById("ultima-atualizacao")
const logEl          = document.getElementById("log")

const cardPresenca   = document.querySelector(".card-presenca")
const elPresenca     = document.getElementById("presenca")
const elPresencaSts  = document.getElementById("presenca-status")

const elLuminosidade = document.getElementById("luminosidade")

const ledBulb        = document.getElementById("led-bulb")
const ledBadge       = document.getElementById("led-badge")
const ledDescricao   = document.getElementById("led-descricao")

const cameraFeed     = document.getElementById("camera-feed")
const cameraOffline  = document.getElementById("camera-offline")

// ─── CÂMERA ──────────────────────────────────────────────────────────────────
// Tenta conectar ao stream MJPEG assim que a página carrega.
// Se a câmera não estiver disponível, o placeholder de "sem sinal" é exibido.
function iniciarCamera() {
    if (!CONFIG.cameraUrl || CONFIG.cameraUrl.includes("XXX")) return

    cameraFeed.src = CONFIG.cameraUrl
    cameraFeed.style.display = "block"
    cameraOffline.style.display = "none"

    cameraFeed.onerror = () => {
        cameraFeed.style.display = "none"
        cameraOffline.style.display = "flex"
        log("Câmera inacessível — verifique a URL do stream.", "erro")
    }
}

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────────────────────

function log(mensagem, tipo = "info") {
    const cores = {
        info:     "#8b949e",
        sucesso:  "#00ff88",
        erro:     "#ff4444",
        recebido: "#ffaa00",
        enviado:  "#00d4ff"
    }
    const hora = new Date().toLocaleTimeString("pt-BR")
    logEl.innerHTML += `<span style="color:${cores[tipo]}">[${hora}] ${mensagem}</span>\n`
    logEl.scrollTop = logEl.scrollHeight
}

function setStatus(conectado, texto) {
    statusDot.className   = "status-dot" + (conectado ? " conectado" : "")
    statusTexto.textContent = texto
}

function marcarAtualizacao() {
    ultimaAtu.textContent = "Última leitura: " + new Date().toLocaleTimeString("pt-BR")
}

// ─── ATUALIZAR LED ───────────────────────────────────────────────────────────
function atualizarLed(ligado) {
    if (ligado) {
        ledBulb.classList.add("ligado")
        ledBadge.classList.add("ligado")
        ledBadge.textContent = "LIGADO"
        ledDescricao.textContent = "LED aceso — presença detectada no ambiente."
    } else {
        ledBulb.classList.remove("ligado")
        ledBadge.classList.remove("ligado")
        ledBadge.textContent = "DESLIGADO"
        ledDescricao.textContent = "LED apagado — nenhuma presença detectada."
    }
}

// ─── ATUALIZAR PRESENÇA ──────────────────────────────────────────────────────
function atualizarPresenca(detectada) {
    if (detectada) {
        elPresenca.textContent = "SIM"
        elPresencaSts.textContent = "Movimento detectado"
        cardPresenca.classList.add("presenca-ativa")
    } else {
        elPresenca.textContent = "NÃO"
        elPresencaSts.textContent = "Ambiente livre"
        cardPresenca.classList.remove("presenca-ativa")
    }
}

// ─── PROCESSAR MENSAGEM MQTT ─────────────────────────────────────────────────
// Formato esperado: "presenca:1,ldr:72.3,led:on"
function processarMensagem(mensagem) {
    log(`[REC] ${mensagem}`, "recebido")

    const partes = mensagem.split(",")

    partes.forEach(parte => {
        const [chave, valor] = parte.split(":")

        if (chave === "presenca") {
            atualizarPresenca(valor === "1" || valor === "true")
        }

        if (chave === "ldr") {
            elLuminosidade.textContent = valor
            const cardLdr = document.querySelector(".card-ldr")
            // Alerta se luminosidade abaixo de 10% (muito escuro)
            cardLdr.classList.toggle("alerta", parseFloat(valor) < 10)
        }

        if (chave === "led") {
            atualizarLed(valor === "on" || valor === "1")
        }
    })

    marcarAtualizacao()
}

// ─── CONEXÃO MQTT ─────────────────────────────────────────────────────────────
function conectar() {
    log(`Conectando ao broker: ${CONFIG.broker}...`)
    setStatus(false, "Conectando...")

    cliente = mqtt.connect(CONFIG.broker, {
        clientId: CONFIG.clientId,
        clean: true,
        connectTimeout: 10000
    })

    cliente.on("connect", () => {
        setStatus(true, "Conectado ao broker")
        log("Conectado com sucesso!", "sucesso")

        cliente.subscribe(CONFIG.topicSub, (err) => {
            if (!err) log(`[SUB] Assinando: ${CONFIG.topicSub}`, "info")
        })
    })

    cliente.on("message", (topico, payload) => {
        processarMensagem(payload.toString())
    })

    cliente.on("error", (err) => {
        log(`[ERRO] ${err.message}`, "erro")
        setStatus(false, "Erro de conexão")
    })

    cliente.on("close", () => {
        setStatus(false, "Desconectado")
        log("Conexão encerrada.", "erro")
    })
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
iniciarCamera()
conectar()