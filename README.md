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

- A API fica em `http://localhost:3000` (porta `HOST_PORT`).
- O MySQL fica em `localhost:3307` (porta `DB_HOST_PORT`), acessível só a partir da própria máquina.
- No arranque, a API aplica as migrações e cria o administrador definido no `.env`, se ainda não existir.

Para ver os registos: `docker compose logs -f api`. Para parar: `docker compose down` (os dados ficam no volume `db_data`).

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
| `DB_ROOT_PASSWORD`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Base de dados MySQL (criada pelo Docker) |
| `PORT` / `HOST_PORT` | Porta da API dentro do contentor / na máquina |
| `DB_PORT` / `DB_HOST_PORT` | Porta do MySQL dentro do contentor / na máquina |
| `DATABASE_URL` | Só fora do Docker (o `docker-compose.yml` define-a sozinho) |
| `JWT_SECRET` | Segredo para assinar as sessões. Use um valor longo e aleatório |
| `ENCRYPTION_KEY` | Chave para encriptar credenciais, tokens e IPs. **Não a mude** depois de haver dados: os valores encriptados deixam de poder ser lidos |
| `FRONTEND_URL` | Endereço exato do frontend (CORS com credenciais) |
| `COOKIE_SECURE` | `true` por defeito. `false` só num servidor de testes sem HTTPS |
| `EMAIL_DOMINIOS_PERMITIDOS` | Domínios dos e-mails institucionais (por defeito `netline.co.mz`). Contas novas e e-mails alterados têm de ser destes domínios |
| `LOGIN_SO_EMAIL_INSTITUCIONAL` | `true` para o login também recusar outros domínios. Ligue só depois de todas as contas, sobretudo as de administrador, terem o e-mail institucional |
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
├── locales/       Mensagens da API em português (pt.js) e inglês (en.js)
└── server.js      Arranque do Express
prisma/
├── schema.prisma  Modelo de dados
├── migrations/    Histórico de migrações
└── seed.js        Dados iniciais
uploads/           Ficheiros enviados (fora do Git)
```

Todas as respostas seguem o formato `{ sucesso, mensagem, data }`. Para confirmar que a API está no ar: `GET /api/v1/health`.

## Segurança

- **Sessão:** o login devolve um cookie `netline_sessao` (`HttpOnly`, `Secure`, `SameSite=Strict`) e `POST /auth/logout` apaga-o. O cabeçalho `Authorization: Bearer` continua aceite, para ferramentas como o Postman.
- **Login:** a mensagem é sempre "Credenciais incorretas.", e 5 tentativas falhadas no mesmo e-mail bloqueiam-no durante 15 minutos.
- **Dados sensíveis:** palavras-passe, tokens e credenciais são guardados encriptados. Para os ver é preciso confirmar de novo a palavra-passe (`POST /auth/reautenticar`), o que dá um acesso de 3 minutos.
- **Perfis e permissões:** cada utilizador tem um perfil (Administrador, Secretaria/RH, Programador, Consultor, ou outro criado em Configurações). O código verifica sempre permissões concretas (`src/constants/permissoes.js`), nunca o nome do perfil. O perfil e as permissões leem-se da base de dados em cada pedido, por isso uma mudança vale logo. Só o Administrador configura perfis, dá o perfil Administrador e altera contas de administradores.
- **Ficheiros:** `/uploads` exige sessão. Os documentos seguem as mesmas regras de visibilidade da API (categorias sensíveis, pendentes e lixeira).

## Produção

- A API e o frontend têm de estar no **mesmo site** e em **HTTPS**.
- Faça cópias de segurança da base de dados **e** da pasta `uploads/`: os documentos só existem lá.
- No servidor, a pasta `uploads/` tem de pertencer ao utilizador do contentor (`chown -R 1000:1000 uploads`).
- O pipeline de deploy (`.github/workflows/demo.yaml`) é mantido pela equipa de DevOps.
