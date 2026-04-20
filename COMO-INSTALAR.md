# 🤝 Friendsaler — Guia de Deploy (Passo a Passo)

Sem precisar programar. Siga os passos abaixo.

---

## PASSO 1 — Criar conta no Railway (5 minutos)

1. Acesse **railway.app**
2. Clique em **"Start a New Project"**
3. Faça login com sua conta do GitHub
   - Se não tiver GitHub: crie em github.com (é gratuito)

---

## PASSO 2 — Subir o backend (5 minutos)

1. No Railway, clique em **"Deploy from GitHub repo"**
2. Crie um repositório no GitHub chamado `friendsaler-backend`
3. Suba os 3 arquivos desta pasta para esse repositório:
   - `server.js`
   - `package.json`
   - `.env.example`
4. O Railway detecta automaticamente e faz o deploy

> **URL do seu backend:** após o deploy, o Railway gera uma URL tipo:
> `https://friendsaler-backend-production.up.railway.app`
> **Guarde essa URL — você vai precisar dela.**

---

## PASSO 3 — Configurar as variáveis de ambiente no Railway

1. No painel do Railway, clique no seu projeto
2. Clique em **"Variables"**
3. Adicione cada variável do arquivo `.env.example`:

| Variável | Onde pegar |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `WHATSAPP_TOKEN` | Painel Zenvia ou Meta for Developers |
| `VERIFY_TOKEN` | Você escolhe (ex: `friendsaler2024`) |
| `WHATSAPP_API_URL` | Ver Passo 4 abaixo |

---

## PASSO 4 — Conectar o WhatsApp (Zenvia — recomendado)

### Opção A: Zenvia (mais fácil, em português)

1. Acesse **zenvia.com** e crie uma conta Business
2. Vá em **Canais → WhatsApp → Configurar**
3. Siga o processo de aprovação do número (1-3 dias úteis)
4. Após aprovado, vá em **Integrações → Webhook**
5. Cole a URL do Railway: `https://sua-url.railway.app/webhook`
6. O token de verificação: use o mesmo valor do `VERIFY_TOKEN`
7. Copie o **API Token** da Zenvia e cole no Railway como `WHATSAPP_TOKEN`
8. Em `WHATSAPP_API_URL`, use: `https://api.zenvia.com/v2/channels/whatsapp/messages`

### Opção B: Meta Cloud API (gratuita, mais técnica)

1. Acesse **developers.facebook.com**
2. Crie um app → Tipo: Business
3. Adicione o produto **WhatsApp**
4. Em **Configuration → Webhook**, cole: `https://sua-url.railway.app/webhook`
5. Verify Token: mesmo valor do `VERIFY_TOKEN`
6. Copie o **Access Token** temporário (ou gere um permanente)
7. Em `WHATSAPP_API_URL`, use: `https://graph.facebook.com/v19.0/SEU_PHONE_NUMBER_ID/messages`

---

## PASSO 5 — Conectar o painel Friendsaler ao backend

Abra o arquivo `friendsaler.html` em um editor de texto (ex: Notepad) e:

1. Procure a linha: `const API_URL = ''`
2. Substitua por: `const API_URL = 'https://sua-url.railway.app'`
3. Salve e abra o arquivo no navegador

Pronto! O painel agora vai mostrar as conversas reais do WhatsApp.

---

## PASSO 6 — Testar

1. Mande uma mensagem para o número do WhatsApp Business
2. Abra o painel Friendsaler
3. A conversa deve aparecer automaticamente na aba **Atendimento**
4. A IA analisa e mostra nota, alertas e sugestão

---

## ✅ Checklist final

- [ ] Conta Railway criada
- [ ] Backend subido no GitHub e Railway
- [ ] `ANTHROPIC_API_KEY` configurada
- [ ] `WHATSAPP_TOKEN` configurada
- [ ] `VERIFY_TOKEN` configurada
- [ ] `WHATSAPP_API_URL` configurada
- [ ] Webhook registrado na Zenvia/Meta
- [ ] `API_URL` atualizada no `friendsaler.html`
- [ ] Teste com mensagem real realizado

---

## 🆘 Problemas comuns

**"Webhook não verificado"**
→ Confirme que o `VERIFY_TOKEN` no Railway é idêntico ao cadastrado na Zenvia/Meta.

**"Mensagens não aparecem no painel"**
→ Verifique se o Railway está rodando (aba Deployments → deve estar verde).

**"IA não analisa"**
→ Confirme a `ANTHROPIC_API_KEY` em console.anthropic.com → a chave começa com `sk-ant-`.

---

## 📞 Próximos passos (quando crescer)

- Trocar banco em memória por **PostgreSQL** (o Railway oferece isso com 1 clique)
- Adicionar autenticação de usuários
- Criar app mobile para os vendedores
- Implementar notificações em tempo real (WebSocket)
