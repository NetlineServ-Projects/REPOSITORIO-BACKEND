# Repositório Digital da Netline — Backend (API)

API do repositório interno da Netline Serv, Lda: documentos e aprovações, sistemas desenvolvidos, plataformas e infraestrutura, utilizadores e notificações.

A interface está noutro repositório: [repositorio-digital-da-netline](https://github.com/NetlineServ-Projects/repositorio-digital-da-netline).

## Tecnologias

Node.js 22, Express 5, Prisma 6 com MySQL 8, Zod (validação), JWT em cookie `HttpOnly`, Multer (envio de ficheiros) e Docker.

## Começar com Docker (recomendado)

Requisitos: Docker e Docker Compose.

```bash
cp .env.example .env    # preencha as palavras-passe e os segredos
docker compose up -d --build
```

- Sem `-f`, o Docker Compose junta o `docker-compose.yml` (o mesmo do deploy) com o `docker-compose.override.yml`, que constrói a imagem localmente e abre as portas.
- A API fica em `http://localhost:3000` (porta `HOST_PORT`).
- O MySQL fica em `localhost:3307` (porta `DB_HOST_PORT`), acessível só a partir da própria máquina.
- No arranque, a API aplica as migrações e cria o administrador definido no `.env`, se ainda não existir.

Para ver os registos: `docker compose logs -f api`. Para parar: `docker compose down` (os dados ficam nos volumes `repositorio_db_data` e `repositorio_uploads`).

## Começar sem Docker

Requisitos: Node.js 22 e um MySQL 8 a correr.

```bash
npm install
cp .env.example .env    # inclua o DATABASE_URL a apontar para o seu MySQL
npx prisma migrate deploy
npm run seed            # categorias e administrador inicial
npm start               # http://localhost:3000
```

## Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `SERVICE_PASSWORD_MYSQLROOT`, `SERVICE_USER_MYSQL`, `SERVICE_PASSWORD_MYSQL`, `MYSQL_DATABASE` | Base de dados MySQL (criada pelo Docker). No Coolify as `SERVICE_*` são geradas por ele |
| `SERVICE_PASSWORD_64_JWT` | Segredo das sessões no Docker (`JWT_SECRET` dentro do contentor) |
| `SERVICE_PASSWORD_ADMIN` | Palavra-passe do administrador no Docker (`ADMIN_SENHA` dentro do contentor) |
| `TZ` | Fuso horário da API e dos registos (`Africa/Maputo` por defeito). A BD trabalha sempre em UTC |
| `PORT` | Porta da API fora do Docker (no contentor é sempre 3000) |
| `HOST_PORT` / `DB_HOST_PORT` | Portas da API e do MySQL na máquina local (só com o `docker-compose.override.yml`) |
| `DATABASE_URL` | Só fora do Docker (o `docker-compose.yml` define-a sozinho) |
| `JWT_SECRET` | Só fora do Docker: segredo para assinar as sessões. Use um valor longo e aleatório |
| `ENCRYPTION_KEY` | Chave para encriptar credenciais, tokens e IPs: 64 caracteres hex (`openssl rand -hex 32`); a API não arranca com outro formato. **Não a mude** depois de haver dados: os valores encriptados deixam de poder ser lidos |
| `FRONTEND_URL` | Endereço exato do frontend (CORS com credenciais) |
| `COOKIE_SECURE` | `true` por defeito. `false` só num servidor de testes sem HTTPS |
| `API_DOCS` | `true` por defeito: serve a documentação em `/api/v1/docs`. `false` desliga-a |
| `ADMIN_NOME`, `ADMIN_EMAIL`, `ADMIN_SENHA`, ... | Administrador criado no primeiro arranque |

O `.env` não vai para o Git. Use o `.env.example` como base.

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Arranca a API |
| `npm run start:prod` | Aplica as migrações, corre o seed e arranca (usado no contentor) |
| `npm run migrate` | Aplica as migrações pendentes |
| `npm run seed` | Cria as categorias e o administrador inicial (não altera os existentes) |
| `npx prisma migrate dev --name <nome>` | Cria uma migração nova depois de alterar o `prisma/schema.prisma` |

## Organização do código

```
src/
├── routes/v1/     Rotas, todas em /api/v1 (auth, documentos, sistemas, plataformas...)
├── controllers/   Recebem o pedido e devolvem a resposta
├── services/      Regras de negócio e acesso à base de dados (Prisma)
├── validators/    Esquemas Zod dos pedidos
├── middlewares/   Autenticação, permissões, reautenticação, ficheiros protegidos, erros
├── docs/          Documentação OpenAPI (Swagger) da API
├── locales/       Mensagens da API em português (pt.js) e inglês (en.js)
└── server.js      Arranque do Express
prisma/
├── schema.prisma  Modelo de dados
├── migrations/    Histórico de migrações
└── seed.js        Dados iniciais
uploads/           Ficheiros enviados (fora do Git)
```

Todas as respostas seguem o formato `{ sucesso, mensagem, data }`. Para confirmar que a API está no ar: `GET /api/v1/health`.

## Documentação da API

- **Swagger UI:** `/api/v1/docs` (ex: `http://localhost:3000/api/v1/docs`). Lista todas as rotas e permite testá-las: faça `POST /auth/login` com **Try it out** e o browser passa a enviar a sessão nos pedidos seguintes.
- **Especificação OpenAPI 3.1:** `/api/v1/docs.json`, para importar no Postman ou noutras ferramentas.

A especificação está em `src/docs/openapi.js`. Os corpos dos pedidos são gerados a partir dos schemas Zod dos validators, por isso acompanham as validações. Ao criar ou alterar uma rota, registe-a também nesse ficheiro.

## Segurança

- **Sessão:** o login devolve um cookie `netline_sessao` (`HttpOnly`, `Secure`, `SameSite=Strict`) e `POST /auth/logout` apaga-o. O cabeçalho `Authorization: Bearer` continua aceite, para ferramentas como o Postman.
- **Login:** a mensagem é sempre "Credenciais incorretas.", e 5 tentativas falhadas no mesmo e-mail bloqueiam-no durante 15 minutos.
- **Dados sensíveis:** palavras-passe, tokens e credenciais são guardados encriptados. Para os ver é preciso confirmar de novo a palavra-passe (`POST /auth/reautenticar`), o que dá um acesso de 3 minutos.
- **Ficheiros:** `/uploads` exige sessão. Os documentos seguem as mesmas regras de visibilidade da API (categorias sensíveis, pendentes e lixeira).

## Produção

- A API e o frontend têm de estar no **mesmo site** e em **HTTPS**.
- Faça cópias de segurança da base de dados **e** da pasta `uploads/`: os documentos só existem lá.
- Os ficheiros enviados ficam no volume `repositorio_uploads`, que já pertence ao utilizador do contentor (`node`, uid 1000).
- `GET /api/v1/health` devolve a versão da imagem (`data.versao`) e responde 503 se a base de dados estiver em baixo.

## Deploy (DEMO)

O pipeline (`.github/workflows/demo.yaml`) corre em cada push para o ramo `demo`:

1. Instala as dependências, gera e valida o Prisma, corre os testes.
2. Constrói a imagem e faz um smoke test com o `docker-compose.yml` e uma BD vazia (migrações, seed, healthchecks e versão).
3. Publica `netlineserv/repositorio-backend:demo` e `:demo-<commit>` (para rollback) no Docker Hub.
4. Faz backup da BD no servidor por SSH, pede o deploy ao Coolify (`.github/scripts/coolify-deploy.sh`) e espera até o health público mostrar a versão nova.

Configuração necessária:

- **GitHub → Secrets:** `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `COOLIFY_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_RESOURCE_UUID`, `SERVER_IP`, `SERVER_USERNAME`, `SERVER_KEY`.
- **GitHub → Variables (ou Secrets):** `DEMO_HEALTH_URL`, o endereço público da API (ex: `https://api.exemplo.com`, sem `/api/v1/health`).
- **Coolify:** o recurso usa o `docker-compose.yml` deste repositório. O Coolify gera as `SERVICE_*` (palavras-passe, utilizador da BD e domínio da API, `SERVICE_FQDN_API`); à mão definem-se `ENCRYPTION_KEY` (guarde uma cópia fora do Coolify), `FRONTEND_URL` e `ADMIN_EMAIL`. A palavra-passe do administrador fica em `SERVICE_PASSWORD_ADMIN`.
