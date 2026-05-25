# WealthOS API — Guia de Deploy

Stack: **Render.com** (API Node.js, gratuito) + **Supabase** (PostgreSQL, gratuito)

> **100% gratuito.** Sem cartão de crédito obrigatório para começar.
>
> ⚠️ Limitação do Render free tier: o serviço "dorme" após 15 min de inatividade.  
> Na primeira utilização do dia pode demorar ~30 segundos a acordar. Para uso pessoal é perfeitamente aceitável.

---

## Pré-requisitos

- Conta em [render.com](https://render.com) (gratuita, sem CC)
- Conta em [supabase.com](https://supabase.com) (gratuita, sem CC)
- Git instalado localmente
- Node.js ≥ 20 instalado localmente

---

## 1. Base de dados — Supabase

### 1.1 Criar projeto

1. Entra em [supabase.com](https://supabase.com) → **New project**
2. Nome: `wealthos`
3. Define uma **Database Password** forte (guarda-a — precisas dela a seguir)
4. Região: `West EU (Ireland)` ou a mais próxima de ti
5. Aguarda ~2 min até o projeto estar pronto

### 1.2 Obter a connection string

1. Painel Supabase → **Project Settings** → **Database**
2. Em *Connection string* seleciona o modo **URI**
3. Copia a string — tem este formato:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Substitui `[YOUR-PASSWORD]` pela password que definiste
5. **Guarda esta string** — é o `DATABASE_URL`

> **Importante:** usa sempre a porta **5432** (direct connection), nunca a 6543 (Pgbouncer/pooler). O Prisma precisa da direct connection.

---

## 2. Preparar o repositório

### 2.1 Inicializar git

```bash
cd wealthos-api
git init
git add .
git commit -m "feat: initial WealthOS API"
```

### 2.2 Verificar .gitignore

O `.gitignore` deve ter pelo menos:
```
node_modules/
.env
```

O `.env` **nunca deve ir para o repositório**.

### 2.3 Push para GitHub

```bash
# Cria um repo em github.com/new (ex: "wealthos-api", privado)
git remote add origin https://github.com/SEU-USER/wealthos-api.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy no Render.com

### 3.1 Criar Web Service

1. Entra em [render.com](https://render.com) → **New** → **Web Service**
2. Escolhe **Build and deploy from a Git repository**
3. Clica **Connect account** para ligar ao GitHub
4. Seleciona o repositório `wealthos-api`
5. Configura:
   - **Name:** `wealthos-api`
   - **Region:** Frankfurt EU (ou a mais próxima)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npx prisma migrate deploy && node src/server.js`
   - **Instance Type:** **Free** ← importante, seleciona o plano gratuito
6. Clica **Create Web Service**

### 3.2 Configurar variáveis de ambiente

No painel do serviço → **Environment** → adiciona:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres` |
| `JWT_SECRET` | *(string aleatória, ver geração abaixo)* |
| `ALLOWED_ORIGINS` | `*` |
| `NODE_ENV` | `production` |

**Gerar JWT_SECRET** (corre num terminal local):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Depois de adicionar as variáveis, o Render inicia o deploy automaticamente.

### 3.3 Obter o URL público

Após o deploy terminar (2-3 min), o URL aparece no topo do painel:
```
https://wealthos-api.onrender.com
```

### 3.4 Verificar

```bash
curl https://wealthos-api.onrender.com/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "app": "wealthos-api",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

> Se o serviço estiver "a dormir", o primeiro pedido pode demorar 30-60s. É normal.

---

## 4. Ligar o WealthOS ao backend

Abre o `wealth-os.html` no browser, abre a consola (F12) e corre:

### Novo utilizador — primeira vez (tu)

```js
// Cria a conta e sobe os dados locais existentes para o servidor
await App.registerBackend(
  'https://wealthos-api.onrender.com',
  'pedro@exemplo.com',
  'Pedro',
  'password-segura'
)
```

O log vai mostrar o **invite code** do teu household — guarda-o para a Raquel.

### Login em dispositivo diferente

```js
await App.connectBackend(
  'https://wealthos-api.onrender.com',
  'pedro@exemplo.com',
  'password-segura'
)
```

### Segundo utilizador (Raquel) — com invite code

```js
// Usa o invite code que apareceu no registo do Pedro
DataProvider.setApiBase('https://wealthos-api.onrender.com');
await DataProvider.register('raquel@exemplo.com', 'Raquel', 'password-segura', 'INVITE_CODE');
await State.init();
App.refresh();
```

### Desligar (voltar a modo local)

```js
App.disconnectBackend()
```

---

## 5. Verificar que o sync está a funcionar

1. Após o `connectBackend`, aparece um indicador discreto no topbar
2. Faz uma alteração (ex: nova transação) — após ~1.5s o sync dispara
3. Abre o WealthOS noutro browser/dispositivo, faz login → dados sincronizados ✅

---

## 6. Actualizações futuras

```bash
git add .
git commit -m "feat: descrição da mudança"
git push origin main
```

O Render detecta o push e faz redeploy automático (~2 min). As migrações Prisma correm automaticamente.

---

## 7. Resolução de problemas

### O serviço demora muito no primeiro pedido
Normal — é o cold start do free tier (30-60s). Após acordar, os pedidos seguintes são rápidos.

**Opcional — evitar o cold start:** usa o [UptimeRobot](https://uptimerobot.com) (gratuito) para fazer um ping ao `/health` a cada 14 minutos. Mantém o serviço acordado sem custo.

### Erro 401 TOKEN_EXPIRED
O `DataProvider._tryRefresh()` trata disto automaticamente. Se persistir:
```js
App.disconnectBackend()
await App.connectBackend('https://...', 'email', 'pass')
```

### Erro 409 CONFLICT
Dois dispositivos guardaram em simultâneo. Aparece um `confirm()` dialog — escolhe se queres manter os dados locais ou os do servidor.

### Render: "Deploy failed"
1. Verifica os logs no painel Render → **Logs**
2. Causa mais comum: `DATABASE_URL` mal configurada
3. Confirma que estás a usar porta 5432 (não 6543)

### Prisma: "P1001 Can't reach database server"
- Verifica se o projeto Supabase está ativo (não pausado)
- O Supabase pausa projetos gratuitos após 1 semana sem actividade — reactiva no dashboard

### Testar localmente antes do deploy

```bash
cd wealthos-api
npm install
npx prisma generate
```

Cria um `.env` local:
```env
DATABASE_URL="postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres"
JWT_SECRET="qualquer-string-longa-para-dev"
ALLOWED_ORIGINS="*"
NODE_ENV="development"
PORT=3000
```

```bash
npx prisma migrate deploy
npm run dev
```

---

## 8. Custos

| Serviço | Plano | Custo |
|---|---|---|
| Render.com | Free Web Service (750h/mês) | **$0/mês** |
| Supabase | Free tier (500MB DB) | **$0/mês** |
| **Total** | | **$0/mês** |

**Limites do free tier relevantes para uso pessoal:**
- Render: 750h/mês = suficiente para 1 serviço sempre ativo
- Supabase: pausa o projeto após 7 dias sem actividade → reativa no dashboard gratuitamente
- Supabase: 500MB de base de dados → para snapshots JSON de finanças pessoais, durarás anos

---

## 9. Supabase: reativar após pausa

O Supabase pausa projetos gratuitos após ~7 dias sem acesso à base de dados.  
Para reativar: [supabase.com/dashboard](https://supabase.com/dashboard) → o teu projeto → botão **Restore project**.  
Demora ~2 min. Gratuito e sem perda de dados.

---

*WealthOS API v1.0 — Pedro & Raquel*
