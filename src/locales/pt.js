module.exports = {
    AUTH: {
        LOGIN_SUCCESS: "Sessão iniciada com sucesso.",
        CREDENCIAIS_INVALIDAS: "Credenciais incorretas.",
        MUITAS_TENTATIVAS: "Demasiadas tentativas falhadas. Aguarde 15 minutos e tente novamente.",
        LOGOUT_SUCCESS: "Sessão terminada com sucesso.",
        USER_NOT_FOUND: "Utilizador não encontrado.",
        INVALID_PASSWORD: "Palavra-passe incorreta.",

        TOKEN_NOT_PROVIDED: "Token não fornecido.",
        INVALID_TOKEN_FORMAT: "Formato do token inválido. Utilize: Bearer <token>.",
        INVALID_OR_EXPIRED_TOKEN: "Token inválido ou expirado.",

        UNAUTHORIZED: "Utilizador não autenticado.",
        FORBIDDEN: "Não tem permissão para realizar esta ação.",
        REAUTENTICACAO_NECESSARIA: "É necessário reautenticar-se para aceder a estes dados.",
        TOKEN_INVALIDO: "Token elevado inválido.",
        REAUTENTICACAO_SUCESSO: "Reautenticação confirmada."
    },

    USER: {
        CREATED: "Utilizador criado com sucesso.",
        UPDATED: "Utilizador atualizado com sucesso.",
        DELETED: "Utilizador eliminado com sucesso.",
        NOT_FOUND: "Utilizador não encontrado.",
        EMAIL_ALREADY_EXISTS: "Já existe um utilizador com este e-mail.",
        SO_ADMINISTRADOR: "Só um administrador pode atribuir o perfil Administrador ou alterar a conta de um administrador.",
        PROPRIA_CONTA: "Não pode alterar o perfil, desativar nem eliminar a sua própria conta.",
        ULTIMO_ADMINISTRADOR: "Tem de existir pelo menos um administrador ativo."
    },

    PERFIL: {
        CREATED: "Perfil criado com sucesso.",
        UPDATED: "Perfil atualizado com sucesso.",
        DELETED: "Perfil eliminado com sucesso.",
        NOT_FOUND: "Perfil não encontrado.",
        NOME_EM_USO: "Já existe um perfil com este nome.",
        ADMINISTRADOR_BLOQUEADO: "O perfil Administrador não pode ser alterado nem eliminado.",
        EM_USO: "Este perfil está atribuído a utilizadores. Mude-lhes o perfil antes de o eliminar."
    },

    DOCUMENTO: {
        CREATED: "Documento criado com sucesso.",
        UPDATED: "Documento atualizado com sucesso.",
        DELETED: "Documento movido para a lixeira.",
        APPROVED: "Documento aprovado com sucesso.",
        REJECTED: "Documento rejeitado com sucesso.",
        NOT_FOUND: "Documento não encontrado."
    },

    CATEGORIA: {
        CREATED: "Categoria criada com sucesso.",
        UPDATED: "Categoria atualizada com sucesso.",
        DELETED: "Categoria eliminada com sucesso.",
        NOT_FOUND: "Categoria não encontrada."
    },

    NOTIFICACAO: {
        NOT_FOUND: "Notificação não encontrada.",
    },

    SISTEMA: {
        CREATED: "Sistema criado com sucesso.",
        UPDATED: "Sistema atualizado com sucesso.",
        DELETED: "Sistema eliminado com sucesso.",
        NOT_FOUND: "Sistema não encontrado.",
        INFRAESTRUTURA_ATUALIZADA: "Dados de infraestrutura atualizados com sucesso.",
        CREDENCIAL_ADICIONADA: "Credencial adicionada com sucesso.",
        CREDENCIAL_APAGADA: "Credencial eliminada com sucesso.",
        INFRAESTRUTURA_OBTIDA: "Infraestrutura obtida com sucesso.",
        INFRAESTRUTURA_SEM_DADOS: "Este sistema ainda não tem infraestrutura registada.",
        CREDENCIAL_ATUALIZADA: "Credencial atualizada com sucesso.",
        CREDENCIAL_NAO_ENCONTRADA: "Credencial não encontrada.",
        INFRA_NAO_ENCONTRADA: "Este ambiente ainda não tem infraestrutura registada. Crie-a primeiro.",
        INFRA_SERVIDOR_OU_PLATAFORMA: "Indique um servidor (servidorId) OU uma plataforma (plataformaId) — nunca os dois nem nenhum.",
        INFRA_NAO_AMBOS: "Não é possível associar um servidor e uma plataforma em simultâneo. Escolha apenas um.",
        FRONTEND_PLATAFORMA_INVALIDA: "O frontend só pode estar alojado numa plataforma Cloud/Base de dados (ex: Vercel).",
        INFRA_PLATAFORMA_INVALIDA: "Os backends só podem correr em plataformas Cloud/Base de dados (os registos de imagens e a gestão de domínio não executam sistemas).",
        INFRA_SERVIDOR_FORA_DA_PLATAFORMA: "O servidor escolhido não pertence a esta plataforma.",
        INFRA_IMAGEM_NAO_ENCONTRADA: "Imagem não encontrada.",
        INFRA_IMAGEM_SO_CONTAINERIZACAO: "Só as plataformas de containerização têm imagens.",
        INFRA_IMAGEM_FORA_DA_PLATAFORMA: "A imagem escolhida não pertence a esta plataforma.",
        INFRA_IMAGEM_NAO_CONTAINERIZACAO: "Só é possível associar imagens a plataformas de containerização.",
        SEM_PERMISSAO: "Só quem criou o sistema (ou um administrador) o pode editar ou eliminar.",
    },

    PLATAFORMA: {
        CREATED: "Plataforma criada com sucesso.",
        UPDATED: "Plataforma atualizada com sucesso.",
        DELETED: "Plataforma eliminada com sucesso.",
        OBTIDA: "Plataforma obtida com sucesso.",
        LISTADAS: "Plataformas obtidas com sucesso.",
        ARVORE_OBTIDA: "Árvore de plataformas obtida com sucesso.",
        NOT_FOUND: "Plataforma não encontrada.",
        NOME_JA_EXISTE: "Já existe uma plataforma com este nome.",
        TIPO_INCOMPATIVEL: "Não é possível alterar o tipo: a plataforma tem registos associados incompatíveis com o novo tipo.",
        TEM_DEPENDENCIAS: "Não é possível eliminar a plataforma: ainda tem domínios, servidores, imagens ou sistemas associados.",
        CAMPOS_REGISTRY_INVALIDOS: "Os dados de registry só podem ser definidos em plataformas do tipo Containerização.",
        TOKEN_OBTIDO: "Token obtido com sucesso.",
        TOKEN_NAO_DEFINIDO: "Esta plataforma não tem token definido.",
        FORNECEDORES_OBTIDOS: "Fornecedores obtidos com sucesso.",
        FORNECEDOR_INVALIDO_PARA_TIPO: "O fornecedor escolhido não pertence a este tipo de plataforma.",
        NOME_OBRIGATORIO_OUTRO: 'Indique o nome da plataforma quando o fornecedor é "Outro".',
        LOGOTIPO_ATUALIZADO: "Logótipo da plataforma atualizado com sucesso.",
        LOGOTIPO_OBRIGATORIO: "É necessário enviar um ficheiro de imagem (PNG, JPEG ou WebP).",
    },

    SERVIDOR: {
        CREATED: "Servidor criado com sucesso.",
        UPDATED: "Servidor atualizado com sucesso.",
        DELETED: "Servidor eliminado com sucesso.",
        OBTIDO: "Servidor obtido com sucesso.",
        LISTADOS: "Servidores obtidos com sucesso.",
        NOT_FOUND: "Servidor não encontrado.",
        IP_JA_EXISTE: "Já existe um servidor com este IP nesta plataforma.",
        PLATAFORMA_INVALIDA: "Só é possível registar servidores em plataformas do tipo Cloud/Base de dados.",
        PLATAFORMA_INATIVA: "A plataforma selecionada está inativa.",
        TEM_DEPENDENCIAS: "Não é possível eliminar o servidor: ainda tem subdomínios ou sistemas associados.",
        PASSWORD_OBTIDA: "Palavra-passe do servidor obtida com sucesso.",
    },

    IMAGEM: {
        CREATED: "Imagem registada com sucesso.",
        UPDATED: "Imagem atualizada com sucesso.",
        DELETED: "Imagem eliminada com sucesso.",
        OBTIDA: "Imagem obtida com sucesso.",
        LISTADAS: "Imagens obtidas com sucesso.",
        NOT_FOUND: "Imagem não encontrada.",
        JA_EXISTE: "Já existe uma imagem com este nome e tag nesta plataforma.",
        PLATAFORMA_INVALIDA: "Só é possível registar imagens em plataformas do tipo Containerização.",
        PLATAFORMA_INATIVA: "A plataforma selecionada está inativa.",
    },

    DOMINIO: {
        CREATED: "Domínio criado com sucesso.",
        UPDATED: "Domínio atualizado com sucesso.",
        DELETED: "Domínio eliminado com sucesso.",
        OBTIDO: "Domínio obtido com sucesso.",
        LISTADOS: "Domínios obtidos com sucesso.",
        NOT_FOUND: "Domínio não encontrado.",
        NOME_JA_EXISTE: "Já existe um domínio com este nome.",
        PLATAFORMA_INVALIDA: "Só é possível registar domínios em plataformas do tipo Gestão de domínio.",
        PLATAFORMA_INATIVA: "A plataforma selecionada está inativa.",
        TEM_DEPENDENCIAS: "Não é possível eliminar o domínio: ainda tem subdomínios associados.",
    },

    SUBDOMINIO: {
        CREATED: "Subdomínio criado com sucesso.",
        UPDATED: "Subdomínio atualizado com sucesso.",
        DELETED: "Subdomínio eliminado com sucesso.",
        OBTIDO: "Subdomínio obtido com sucesso.",
        LISTADOS: "Subdomínios obtidos com sucesso.",
        NOT_FOUND: "Subdomínio não encontrado.",
        JA_EXISTE: "Já existe um registo deste tipo com este nome neste domínio.",
        SERVIDOR_OBRIGATORIO: "Os registos A e AAAA exigem um servidor de destino.",
        DESTINO_NAO_PERMITIDO: "Os registos A e AAAA apontam para um servidor e não devem ter destino.",
        DESTINO_OBRIGATORIO: "Este tipo de registo exige o campo destino.",
        SERVIDOR_NAO_PERMITIDO: "Só os registos A e AAAA podem apontar para um servidor.",
        CNAME_INVALIDO: "O destino de um registo CNAME deve ser um nome de domínio válido.",
        CNAME_CONFLITO: "Um nome com registo CNAME não pode ter outros registos, e vice-versa.",
    },

    VALIDATION: {
        REQUIRED_FIELDS: "Preencha todos os campos obrigatórios.",
        INVALID_DATA: "Os dados fornecidos são inválidos.",
        INVALID_ID: "ID inválido.",
        CATEGORIA_REQUIRED: "A categoria é obrigatória.",
        FILE_TOO_LARGE: "O ficheiro excede o tamanho máximo permitido.",
        INVALID_DOCUMENT_TYPE: "Tipo de ficheiro não permitido. Formatos aceites: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG.",
        INVALID_LOGO_TYPE: "Formato de logótipo não permitido. Apenas PNG, JPEG e WebP são aceites.",
        NO_FILE_UPLOADED: "Nenhum ficheiro foi enviado."
    },

    SERVER: {
        INTERNAL_ERROR: "Ocorreu um erro interno no servidor."
    }
};