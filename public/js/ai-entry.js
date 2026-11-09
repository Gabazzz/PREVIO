/* ==========================================================================
   Evolução 8 — Entrada por IA / Linguagem Natural
   ========================================================================== */

import { DOM } from './dom.js';
import { supabase } from './supabase-client.js';
import { getLocalDateStr } from './utils.js';
import { openModal } from './transaction-modal.js';
import { voiceInputSupported, startVoiceInput, stopVoiceInput } from './voice-input.js';

const aiSheet = {
  overlay:      document.getElementById('modal-ai-entry'),
  input:        document.getElementById('ai-natural-input'),
  btnSubmit:    document.getElementById('btn-ai-submit'),
  btnClose:     document.getElementById('btn-ai-sheet-close'),
  btnManualExp: document.getElementById('btn-ai-manual-expense'),
  btnManualInc: document.getElementById('btn-ai-manual-income'),
  loading:      document.getElementById('ai-loading-state'),
  error:        document.getElementById('ai-error-state'),
  btnVoice:         document.getElementById('btn-ai-voice'),
  voiceStatus:      document.getElementById('ai-voice-status'),
  voiceStatusText:  document.getElementById('ai-voice-status-text'),
};

export function openAISheet() {
  aiSheet.input.value = '';
  aiSheet.error.style.display = 'none';
  aiSheet.loading.style.display = 'none';
  aiSheet.btnSubmit.disabled = false;
  stopVoiceInput();
  aiSheet.btnVoice.classList.remove('listening');
  aiSheet.voiceStatus.style.display = 'none';
  aiSheet.voiceStatus.classList.remove('voice-error');
  if (voiceInputSupported()) aiSheet.btnVoice.style.display = 'flex';
  aiSheet.overlay.classList.add('active');
  setTimeout(() => aiSheet.input.focus(), 300);
}

export function closeAISheet() {
  aiSheet.overlay.classList.remove('active');
}

aiSheet.btnClose.addEventListener('click', closeAISheet);
aiSheet.overlay.addEventListener('click', (e) => {
  if (e.target === aiSheet.overlay) closeAISheet();
});

aiSheet.btnManualExp.addEventListener('click', () => {
  closeAISheet();
  openModal('saída');
});

aiSheet.btnManualInc.addEventListener('click', () => {
  closeAISheet();
  openModal('entrada');
});

aiSheet.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleAISubmit();
  }
});

aiSheet.btnSubmit.addEventListener('click', handleAISubmit);

aiSheet.btnVoice.addEventListener('click', () => {
  if (aiSheet.btnVoice.classList.contains('listening')) {
    stopVoiceInput();
    return;
  }

  aiSheet.error.style.display = 'none';
  aiSheet.voiceStatus.classList.remove('voice-error');
  aiSheet.voiceStatus.style.display = 'flex';
  aiSheet.voiceStatusText.textContent = 'Ouvindo...';
  aiSheet.btnVoice.classList.add('listening');

  startVoiceInput({
    onResult: (transcript) => {
      const current = aiSheet.input.value.trim();
      aiSheet.input.value = current ? `${current} ${transcript}` : transcript;
      aiSheet.input.focus();
    },
    onError: (message) => {
      aiSheet.voiceStatusText.textContent = message;
      aiSheet.voiceStatus.classList.add('voice-error');
      setTimeout(() => {
        aiSheet.voiceStatus.style.display = 'none';
        aiSheet.voiceStatus.classList.remove('voice-error');
      }, 2500);
    },
    onEnd: () => {
      aiSheet.btnVoice.classList.remove('listening');
      if (!aiSheet.voiceStatus.classList.contains('voice-error')) {
        aiSheet.voiceStatus.style.display = 'none';
      }
    }
  });
});

async function callClaudeAPI(userText) {
  const today = getLocalDateStr();
  const yesterday = getLocalDateStr(new Date(Date.now() - 86400000));

  const systemPrompt = `Você é um parser financeiro. O usuário vai descrever uma transação financeira em linguagem natural, em português brasileiro informal.

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem comentários.

Campos obrigatórios:
- type: "saída" ou "entrada"
- value: número decimal (ex: 42.50)
- category: exatamente uma das opções abaixo:
  - Para saída: "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Outros"
  - Para entrada: "Salário", "Freela", "Rendimentos", "Outros"
- description: texto curto descritivo (máx 40 chars)
- date: data no formato YYYY-MM-DD
- recurring: true ou false
- pontual: true ou false (só pra saída — ver regras abaixo)
- va: true ou false (carteira de vale-alimentação, ex. Caju — ver regras abaixo)

Regras pra extrair o valor (campo "value"):
- "9 e 58", "9 reais e 58", "9 e 58 centavos" → 9.58 (reais e centavos, NUNCA concatenar como 958)
- "35 reais", "35" → 35.00
- "35,50" ou "35.50" → 35.50
- "trinta e cinco reais e vinte" → 35.20
- Só concatene dígitos em sequência quando a pessoa claramente falar um valor grande por extenso sem separador de centavos (ex.: "mil e duzentos" → 1200.00)
- O reconhecimento de voz às vezes transcreve "9 e 58" como se fosse hora, no formato "9:58" ou "09:58". Esta é uma transação financeira, então isso NUNCA é um horário — é sempre reais e centavos: "9:58" → 9.58, "14:30" → 14.30. Nunca descarte esse número nem interprete como horário do dia.

Regras de inferência:
- Sem menção de data ou "hoje" → ${today}
- "ontem" → ${yesterday}
- aluguel, internet, streaming, academia → recurring: true
- ifood, uber, mercado, restaurante, farmácia, compras → recurring: false
- "freela", "trabalho extra", "bico" → entrada, Freela
- "salário", "pagamento", "recebi", "caiu" → entrada
- "gastei", "paguei", "comprei", "fui" → saída
- pontual: true quando for parcela ("parcela do notebook", "2/12"), conta grande avulsa (energia, água, gás, celular quebrado, manutenção) ou compra única de valor alto que não é do dia a dia — esses gastos entram no saldo mas não devem contar na taxa de queima diária
- pontual: false (padrão) pra gasto comum do dia a dia (comida, transporte, lazer, compras pequenas) e sempre que recurring for true
- va: true quando a pessoa mencionar explicitamente VA, vale-alimentação, vale-refeição, Caju, Alelo, Sodexo, VR ou similar — tanto pro crédito mensal (entrada) quanto pro gasto no mercado pago com esse saldo (saída)
- va: false (padrão) quando não houver menção nenhuma a vale-alimentação/benefício — não assuma va:true só porque a categoria é Alimentação ou o estabelecimento é um mercado
- Se valor não identificado → value: 0
- Se não for transação financeira → {"error": "não interpretável"}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Faça login novamente.');

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }]
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const raw = data.content.map(b => b.text || '').join('').trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function handleAISubmit() {
  const text = aiSheet.input.value.trim();
  if (!text) return;

  aiSheet.loading.style.display = 'flex';
  aiSheet.error.style.display = 'none';
  aiSheet.btnSubmit.disabled = true;

  try {
    const result = await callClaudeAPI(text);
    aiSheet.loading.style.display = 'none';

    if (result.error || !result.type || result.value === undefined) {
      aiSheet.error.style.display = 'block';
      aiSheet.btnSubmit.disabled = false;
      return;
    }

    closeAISheet();

    setTimeout(() => {
      openModal(result.type);

      DOM.modalInputValue.value = result.value;
      DOM.modalInputDesc.value  = result.description || '';
      DOM.modalInputDate.value  = result.date || getLocalDateStr();
      DOM.modalInputRecurring.checked = !!result.recurring;
      DOM.modalInputPontual.checked = !!result.pontual;
      DOM.modalInputVa.checked = !!result.va;

      if (result.category) {
        const chips = DOM.categoryChipsList.querySelectorAll('.chip');
        chips.forEach(chip => {
          if (chip.textContent.trim() === result.category) chip.click();
        });
      }
    }, 280);

  } catch (err) {
    console.error('[AI Entry] Erro:', err);
    aiSheet.loading.style.display = 'none';
    aiSheet.error.style.display = 'block';
    aiSheet.btnSubmit.disabled = false;
  }
}
