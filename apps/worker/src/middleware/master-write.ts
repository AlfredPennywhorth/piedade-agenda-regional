import type { MiddlewareHandler } from 'hono'
import type { Variables } from './auth'
import { eMasterSistema } from '../security/permissoes'

export const exigirMasterParaEscrita: MiddlewareHandler<{
  Variables: Variables
}> = async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    await next()
    return
  }

  const contexto = c.get('contextoPermissoes')
  if (!contexto || !eMasterSistema(contexto)) {
    return c.json(
      {
        error: 'Acesso não autorizado para alterar cadastro institucional',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  await next()
}
