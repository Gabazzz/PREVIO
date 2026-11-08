// Edge Function · enviar-para-partus
// Ponte entre o Previo (finanças pessoais) e o Partus (despesas da casa):
// quando um gasto é lançado aqui e marcado "Também lançar no Partus", esta
// função grava a despesa equivalente lá, usando a função adicionar_despesa
// do Partus (assim ela já respeita as regras de lá, como mês fechado).
//
// Só aceita chamadas autenticadas do usuário dono da conta — confere isso
// tanto pela validação automática do JWT (verify_jwt) quanto conferindo o
// id do usuário logado contra o id esperado abaixo.
//
// Deploy:
//   supabase secrets set PARTUS_SERVICE_ROLE_KEY=sb_secret_...   (secret key do projeto Partus)
//   supabase functions deploy enviar-para-partus
import { createClient } from 'npm:@supabase/supabase-js@2'

const PARTUS_URL = 'https://jemxtvmfdorosedwtjsx.supabase.co'
const PARTUS_MORADOR_ID = '690f1324-a416-46fc-ae09-97519abaf55e' // Bitencourt
const PREVIO_USER_ID = '368140f6-a5b1-4e9a-96d1-2da7a385fe1e'

const CATEGORIAS_VALIDAS = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405)

  try {
    // verify_jwt (ligado no deploy) já garante que existe um usuário Previo
    // válido logado; aqui confirmamos que é especificamente o dono da conta.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const sbAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user } } = await sbAuth.auth.getUser(token)
    if (!user || user.id !== PREVIO_USER_ID) {
      return json({ erro: 'Não autorizado' }, 403)
    }

    const { valor, descricao, categoria, data } = await req.json()
    const valorNum = Number(valor)
    if (!(valorNum > 0)) return json({ erro: 'Valor inválido' }, 400)

    const cat = CATEGORIAS_VALIDAS.includes(categoria) ? categoria : 'Outros'
    const item = (descricao && String(descricao).trim()) || cat

    const partus = createClient(PARTUS_URL, Deno.env.get('PARTUS_SERVICE_ROLE_KEY')!)
    const { error } = await partus.rpc('adicionar_despesa', {
      p_morador: PARTUS_MORADOR_ID,
      p_item: item.slice(0, 120),
      p_valor: valorNum,
      p_descricao: null,
      p_data: data || null,
      p_categoria: cat,
    })
    if (error) return json({ erro: error.message }, 400)

    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ erro: 'Erro inesperado' }, 500)
  }
})
