// ═══════════════════════════════════════════════════════════
//  FRIENDSALER — Backend Completo
//  Node.js + Express | WhatsApp Webhook + Claude AI
// ═══════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Variáveis de ambiente (configure no Railway) ──
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
const WHATSAPP_TOKEN     = process.env.WHATSAPP_TOKEN     || ''; // Token gerado pela Zenvia/Meta
const VERIFY_TOKEN       = process.env.VERIFY_TOKEN       || 'friendsaler_verify_2024';
const WHATSAPP_API_URL   = process.env.WHATSAPP_API_URL   || ''; // URL da API Zenvia ou Cloud API

app.use(cors());
app.use(express.json());

// ── Banco de dados em memória (simples para começar) ──
// Para produção, substitua por PostgreSQL ou MongoDB
const db = {
  conversations: {}, // { phoneNumber: { messages: [], analysis: null, vendedor: string } }
  analyses: [],      // histórico de análises
};

// ═══════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'Friendsaler Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════
//  WEBHOOK — VERIFICAÇÃO (GET)
//  A Zenvia/Meta chama este endpoint para confirmar o webhook
// ═══════════════════════════════════════════════════════════
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado com sucesso!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Falha na verificação do webhook');
    res.sendStatus(403);
  }
});

// ═══════════════════════════════════════════════════════════
//  WEBHOOK — RECEBE MENSAGENS (POST)
//  Chamado toda vez que um cliente manda mensagem
// ═══════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente (obrigatório pela Meta/Zenvia)
  res.sendStatus(200);

  try {
    const body = req.body;

    // Suporte à estrutura da WhatsApp Cloud API (Meta)
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const value = change.value;

          for (const msg of value.messages || []) {
            if (msg.type !== 'text') continue;

            const phone   = msg.from;
            const text    = msg.text.body;
            const time    = new Date(parseInt(msg.timestamp) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const contact = value.contacts?.[0]?.profile?.name || phone;

            await processIncomingMessage({ phone, text, time, contact, from: 'client' });
          }
        }
      }
    }

    // Suporte à estrutura da Zenvia
    if (body.type === 'MESSAGE' || body.message) {
      const msg     = body.message || body;
      const phone   = msg.from || msg.sender;
      const text    = msg.content?.text || msg.text || '';
      const time    = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const contact = msg.senderName || phone;

      if (text) {
        await processIncomingMessage({ phone, text, time, contact, from: 'client' });
      }
    }

  } catch (err) {
    console.error('Erro no webhook:', err.message);
  }
});

// ═══════════════════════════════════════════════════════════
//  PROCESSA MENSAGEM RECEBIDA
// ═══════════════════════════════════════════════════════════
async function processIncomingMessage({ phone, text, time, contact, from }) {
  console.log(`📩 Nova mensagem de ${contact} (${phone}): ${text}`);

  // Cria conversa se não existir
  if (!db.conversations[phone]) {
    db.conversations[phone] = {
      phone,
      contact,
      messages: [],
      analysis: null,
      lastActivity: new Date().toISOString(),
      status: 'open'
    };
  }

  const conv = db.conversations[phone];
  conv.messages.push({ from, text, time });
  conv.lastActivity = new Date().toISOString();

  // Analisa a conversa com IA após cada mensagem do cliente
  if (from === 'client' && conv.messages.length >= 2) {
    conv.analysis = await analyzeWithClaude(conv.messages);
    console.log(`🤖 Análise atualizada para ${contact}: nota ${conv.analysis?.nota}/10`);
  }
}

// ═══════════════════════════════════════════════════════════
//  ANÁLISE COM CLAUDE AI
// ═══════════════════════════════════════════════════════════
async function analyzeWithClaude(messages) {
  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY não configurada');
    return mockAnalysis();
  }

  const convText = messages
    .map(m => `${m.from === 'client' ? 'Cliente' : 'Vendedor'}: ${m.text}`)
    .join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `Você é um especialista em análise de desempenho de vendedores. Avalie conversas de WhatsApp e retorne SOMENTE um JSON válido, sem markdown:
{"nota":7,"chance":65,"acertos":["acerto 1"],"erros":["erro 1"],"sugestao":"resposta ideal","resumo":"resumo em 1 frase","alertas":["alerta urgente"]}`,
        messages: [{ role: 'user', content: `Analise esta conversa:\n\n${convText}` }]
      })
    });

    const data = await response.json();
    const raw = data.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro na análise Claude:', err.message);
    return mockAnalysis();
  }
}

function mockAnalysis() {
  return {
    nota: 6, chance: 50,
    acertos: ['Respondeu ao cliente'],
    erros: ['API não configurada'],
    sugestao: 'Configure a ANTHROPIC_API_KEY para ativar a IA.',
    resumo: 'Análise indisponível — configure a API key.',
    alertas: ['Configure ANTHROPIC_API_KEY no Railway']
  };
}

// ═══════════════════════════════════════════════════════════
//  API REST — usada pelo painel Friendsaler (frontend)
// ═══════════════════════════════════════════════════════════

// Lista todas as conversas
app.get('/api/conversations', (req, res) => {
  const list = Object.values(db.conversations)
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
    .map(c => ({
      phone: c.phone,
      contact: c.contact,
      status: c.status,
      lastActivity: c.lastActivity,
      messageCount: c.messages.length,
      lastMessage: c.messages[c.messages.length - 1]?.text || '',
      nota: c.analysis?.nota || null,
      chance: c.analysis?.chance || null,
      alertas: c.analysis?.alertas || []
    }));
  res.json(list);
});

// Busca conversa específica com análise completa
app.get('/api/conversations/:phone', (req, res) => {
  const conv = db.conversations[req.params.phone];
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
  res.json(conv);
});

// Vendedor responde pelo painel (registra e envia via WhatsApp)
app.post('/api/conversations/:phone/reply', async (req, res) => {
  const { text, vendedor } = req.body;
  const phone = req.params.phone;

  if (!text) return res.status(400).json({ error: 'Texto obrigatório' });

  const conv = db.conversations[phone];
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });

  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  conv.messages.push({ from: 'seller', text, time, vendedor });
  conv.lastActivity = new Date().toISOString();

  // Envia mensagem real pelo WhatsApp (se API configurada)
  if (WHATSAPP_API_URL && WHATSAPP_TOKEN) {
    await sendWhatsAppMessage(phone, text);
  }

  // Re-analisa após resposta do vendedor
  conv.analysis = await analyzeWithClaude(conv.messages);

  res.json({ success: true, analysis: conv.analysis });
});

// Analisa uma conversa manualmente (aba Análise do painel)
app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto obrigatório' });

  const messages = text.split('\n')
    .filter(l => l.trim())
    .map(line => {
      const isClient = line.toLowerCase().startsWith('cliente:');
      return {
        from: isClient ? 'client' : 'seller',
        text: line.replace(/^(cliente|vendedor):\s*/i, '').trim(),
        time: ''
      };
    });

  const analysis = await analyzeWithClaude(messages);
  db.analyses.push({ text, analysis, createdAt: new Date().toISOString() });
  res.json(analysis);
});

// Gera nova sugestão de resposta
app.post('/api/suggest', async (req, res) => {
  const { phone } = req.body;
  const conv = db.conversations[phone];
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });

  if (!ANTHROPIC_API_KEY) {
    return res.json({ suggestion: 'Configure a ANTHROPIC_API_KEY para gerar sugestões.' });
  }

  const convText = conv.messages
    .map(m => `${m.from === 'client' ? 'Cliente' : 'Vendedor'}: ${m.text}`)
    .join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Você é um coach de vendas. Gere UMA sugestão de resposta curta e persuasiva para o vendedor fechar a venda. Responda APENAS com a sugestão entre aspas duplas.',
        messages: [{ role: 'user', content: `Conversa:\n${convText}\n\nGere a melhor resposta agora.` }]
      })
    });
    const data = await response.json();
    res.json({ suggestion: data.content[0].text.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Métricas para o painel e relatórios
app.get('/api/metrics', (req, res) => {
  const convs = Object.values(db.conversations);
  const withAnalysis = convs.filter(c => c.analysis);

  const avgNota = withAnalysis.length
    ? (withAnalysis.reduce((s, c) => s + c.analysis.nota, 0) / withAnalysis.length).toFixed(1)
    : 0;

  const closed = convs.filter(c => c.status === 'closed').length;
  const taxaFechamento = convs.length
    ? Math.round((closed / convs.length) * 100)
    : 0;

  // Erros mais comuns
  const errorCount = {};
  withAnalysis.forEach(c => {
    (c.analysis.erros || []).forEach(e => {
      errorCount[e] = (errorCount[e] || 0) + 1;
    });
  });

  const topErrors = Object.entries(errorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([erro, count]) => ({ erro, count }));

  res.json({
    totalConversas: convs.length,
    conversasAbertas: convs.filter(c => c.status === 'open').length,
    taxaFechamento,
    notaMedia: parseFloat(avgNota),
    topErrors
  });
});

// ═══════════════════════════════════════════════════════════
//  ENVIO DE MENSAGEM PELO WHATSAPP
// ═══════════════════════════════════════════════════════════
async function sendWhatsAppMessage(to, text) {
  try {
    // Estrutura para WhatsApp Cloud API (Meta)
    await fetch(`${WHATSAPP_API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      })
    });
    console.log(`📤 Mensagem enviada para ${to}`);
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🤝 Friendsaler Backend v1.0.0     ║
  ║   Rodando na porta ${PORT}              ║
  ╚══════════════════════════════════════╝

  Endpoints disponíveis:
  GET  /                          → health check
  GET  /webhook                   → verificação WhatsApp
  POST /webhook                   → recebe mensagens
  GET  /api/conversations         → lista conversas
  GET  /api/conversations/:phone  → conversa + análise
  POST /api/conversations/:phone/reply → vendedor responde
  POST /api/analyze               → análise manual
  POST /api/suggest               → gera sugestão IA
  GET  /api/metrics               → métricas gerais
  `);
});
