/* ==========================================================================
   Previo HUD — Ponte com o Partus (app de despesas da casa)
   ==========================================================================
   Quando o usuário marca "Também lançar no Partus?" num gasto, chamamos uma
   Edge Function do Supabase que grava a despesa equivalente lá. Não bloqueia
   o salvamento no Previo: se isso falhar, o lançamento aqui já está feito
   mesmo assim — só avisamos que a cópia pro Partus não foi. */

import { supabase } from './supabase-client.js';

export async function enviarParaPartus({ value, description, category, date }) {
  const { error } = await supabase.functions.invoke('enviar-para-partus', {
    body: { valor: value, descricao: description, categoria: category, data: date }
  });
  if (error) throw new Error(error.message || 'Não foi possível enviar ao Partus.');
}
