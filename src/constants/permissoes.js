// Catálogo das permissões que se podem dar a um perfil (Configurações → Perfis e permissões).
// O código verifica sempre estas permissões e nunca o nome do perfil: assim, mudar o que um
// perfil pode fazer é só editar o perfil, sem mexer no código.
//
// O perfil marcado como "administrador" tem todas, mais as que não estão aqui:
// configurar perfis, dar o perfil de Administrador e gerir contas de administradores.

const PERMISSOES = Object.freeze({
    // Documentos
    DOCUMENTOS_APROVAR: "documentos.aprovar", // aprovar/rejeitar, ver pendentes dos outros, publicar sem aprovação
    DOCUMENTOS_ELIMINAR: "documentos.eliminar", // mover para a lixeira
    DOCUMENTOS_SENSIVEIS: "documentos.sensiveis", // categorias sensíveis (RH, Financeiro...)
    DOCUMENTOS_LIXEIRA: "documentos.lixeira", // ver a lixeira, restaurar e eliminar definitivamente

    // Sistemas
    SISTEMAS_CRIAR: "sistemas.criar", // criar sistemas e editar/eliminar os que criou
    SISTEMAS_GERIR: "sistemas.gerir", // editar/eliminar qualquer sistema
    SISTEMAS_INFRA_VER: "sistemas.infraestrutura.ver", // aba de infraestrutura e credenciais
    SISTEMAS_INFRA_GERIR: "sistemas.infraestrutura.gerir", // criar e editar infraestrutura e credenciais

    // Plataformas, servidores, imagens e domínios
    INFRA_VER: "infraestrutura.ver",
    INFRA_GERIR: "infraestrutura.gerir",

    // Administração
    ATIVIDADE_VER: "atividade.ver", // registo de atividade de todos (sem ela, só a própria)
    UTILIZADORES_GERIR: "utilizadores.gerir", // criar e editar contas (nunca contas de administrador)
});

// Grupos e ordem com que o frontend mostra as permissões
const GRUPOS = [
    {
        grupo: "documentos",
        permissoes: [
            PERMISSOES.DOCUMENTOS_APROVAR,
            PERMISSOES.DOCUMENTOS_ELIMINAR,
            PERMISSOES.DOCUMENTOS_SENSIVEIS,
            PERMISSOES.DOCUMENTOS_LIXEIRA,
        ],
    },
    {
        grupo: "sistemas",
        permissoes: [
            PERMISSOES.SISTEMAS_CRIAR,
            PERMISSOES.SISTEMAS_GERIR,
            PERMISSOES.SISTEMAS_INFRA_VER,
            PERMISSOES.SISTEMAS_INFRA_GERIR,
        ],
    },
    { grupo: "plataformas", permissoes: [PERMISSOES.INFRA_VER, PERMISSOES.INFRA_GERIR] },
    { grupo: "administracao", permissoes: [PERMISSOES.ATIVIDADE_VER, PERMISSOES.UTILIZADORES_GERIR] },
];

const TODAS = Object.values(PERMISSOES);

// Permissões que dependem de outra: quem gere tem de conseguir ver
const DEPENDENCIAS = {
    [PERMISSOES.SISTEMAS_GERIR]: [PERMISSOES.SISTEMAS_CRIAR],
    [PERMISSOES.SISTEMAS_INFRA_GERIR]: [PERMISSOES.SISTEMAS_INFRA_VER],
    [PERMISSOES.INFRA_GERIR]: [PERMISSOES.INFRA_VER],
};

// Remove códigos desconhecidos e repetidos e acrescenta as dependências
function normalizar(lista) {
    const resultado = new Set(lista.filter((p) => TODAS.includes(p)));
    for (const p of [...resultado]) {
        for (const dependencia of DEPENDENCIAS[p] ?? []) resultado.add(dependencia);
    }
    return TODAS.filter((p) => resultado.has(p));
}

// usuario = req.user (ver sessaoService)
function temPermissao(usuario, permissao) {
    if (!usuario) return false;
    if (usuario.administrador) return true;
    return Array.isArray(usuario.permissoes) && usuario.permissoes.includes(permissao);
}

// Perfis criados pela migração; o Administrador pode editá-los (menos o próprio Administrador)
const PERFIS_INICIAIS = [
    {
        nome: "Administrador",
        descricao: "Acesso total, incluindo perfis e permissões.",
        administrador: true,
        permissoes: [],
    },
    {
        nome: "Secretaria/RH",
        descricao: "Documentos, sistemas e utilizadores, sem plataformas nem infraestrutura dos sistemas.",
        administrador: false,
        permissoes: [
            PERMISSOES.DOCUMENTOS_APROVAR,
            PERMISSOES.DOCUMENTOS_ELIMINAR,
            PERMISSOES.DOCUMENTOS_SENSIVEIS,
            PERMISSOES.DOCUMENTOS_LIXEIRA,
            PERMISSOES.SISTEMAS_CRIAR,
            PERMISSOES.SISTEMAS_GERIR,
            PERMISSOES.ATIVIDADE_VER,
            PERMISSOES.UTILIZADORES_GERIR,
        ],
    },
    {
        nome: "Programador",
        descricao: "Sistemas, infraestrutura e credenciais; plataformas só para consulta.",
        administrador: false,
        permissoes: [
            PERMISSOES.SISTEMAS_CRIAR,
            PERMISSOES.SISTEMAS_INFRA_VER,
            PERMISSOES.SISTEMAS_INFRA_GERIR,
            PERMISSOES.INFRA_VER,
        ],
    },
    {
        nome: "Consultor",
        descricao: "Sistemas, infraestrutura e credenciais; plataformas só para consulta.",
        administrador: false,
        permissoes: [
            PERMISSOES.SISTEMAS_CRIAR,
            PERMISSOES.SISTEMAS_INFRA_VER,
            PERMISSOES.SISTEMAS_INFRA_GERIR,
            PERMISSOES.INFRA_VER,
        ],
    },
];

module.exports = { PERMISSOES, GRUPOS, TODAS, normalizar, temPermissao, PERFIS_INICIAIS };
