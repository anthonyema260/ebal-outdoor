# EBAL OUTDOOR — GUIA DE DEPLOY GRATUITO
### Sistema rodando na internet em menos de 15 minutos

---

## O QUE VOCÊ VAI PRECISAR
- Um celular ou computador com internet
- Uma conta de e-mail

---

## PASSO 1 — Criar conta no GitHub (repositório de código)

1. Acesse **github.com**
2. Clique em "Sign up" (criar conta)
3. Use seu e-mail e crie uma senha
4. Confirme o e-mail quando chegar na caixa de entrada

---

## PASSO 2 — Fazer upload do projeto

1. Ainda no GitHub, clique em **"New repository"** (botão verde)
2. Nome: `ebal-outdoor`
3. Deixe como **Public** (gratuito)
4. Clique em **"Create repository"**
5. Na próxima tela, clique em **"uploading an existing file"**
6. Arraste a pasta inteira do projeto para a área indicada
7. Clique em **"Commit changes"**

> 💡 Se tiver dificuldade, pode usar o app **GitHub Desktop** 
> (desktop.github.com) — ele é visual e mais fácil.

---

## PASSO 3 — Criar conta no Railway (hospedagem gratuita)

1. Acesse **railway.app**
2. Clique em **"Start a New Project"**
3. Escolha **"Sign in with GitHub"** — vai conectar sua conta
4. Autorize o Railway a acessar seus repositórios

---

## PASSO 4 — Fazer o deploy

1. No Railway, clique em **"New Project"**
2. Escolha **"Deploy from GitHub repo"**
3. Selecione o repositório **ebal-outdoor**
4. O Railway vai detectar automaticamente que é um projeto Node.js
5. Clique em **"Deploy"**

**Aguarde 2-3 minutos.** Vai aparecer um log de instalação — é normal.

---

## PASSO 5 — Obter o link do seu sistema

1. Quando o deploy terminar, vá em **Settings → Domains**
2. Clique em **"Generate Domain"**
3. O Railway vai gerar um link tipo:
   `https://ebal-outdoor-production.up.railway.app`

**Pronto! Esse é o link do seu sistema.** Pode abrir no celular, computador, em qualquer lugar.

---

## PASSO 6 — Salvar os dados permanentes

Por padrão o banco de dados fica temporário no Railway. Para dados persistirem:

1. No Railway, vá em **Variables**
2. Adicione: `DB_PATH` = `/data/ebal.db`
3. Vá em **Volumes** → **Add Volume**
4. Mount Path: `/data`
5. Faça o redeploy

Agora seus dados ficam salvos mesmo se o servidor reiniciar.

---

## RESUMO DOS LINKS

| Serviço | Link | Gratuito? |
|---------|------|-----------|
| GitHub | github.com | ✅ Sim |
| Railway | railway.app | ✅ Sim (500h/mês) |

> **Sobre o limite gratuito do Railway:**
> 500 horas por mês = suficiente para uso contínuo.
> Se precisar de mais, o plano Hobby custa ~$5/mês.

---

## SUPORTE

Se travar em algum passo, pesquise no YouTube:
- "Como fazer deploy no Railway Node.js"
- "GitHub upload de arquivos"

---

*Sistema Ebal Outdoor — desenvolvido para gestão de mídia OOH em Sergipe*
