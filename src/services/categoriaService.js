const prisma = require("../config/prisma");
const cache = require("../utils/cache");
const { PERMISSOES, temPermissao } = require("../constants/permissoes");

exports.listarCategorias = async (usuario) => {

    const verSensiveis = temPermissao(usuario, PERMISSOES.DOCUMENTOS_SENSIVEIS);
    const chaveCache = `categorias:${verSensiveis ? "todas" : "nao-sensiveis"}`;

    const cacheHit = cache.get(chaveCache);
    if (cacheHit) {
        return cacheHit;
    }

    const where = verSensiveis ? {} : { sensivel: false };

    const categorias = await prisma.categoria.findMany({
        where,
        orderBy: {
            nome: "asc"
        }
    });

    cache.set(chaveCache, categorias);

    return categorias;

};