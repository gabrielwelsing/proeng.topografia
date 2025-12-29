'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Download,
  Trash2,
  History,
  MapPin,
  FileSpreadsheet,
  Lock,
  ChevronRight,
} from 'lucide-react';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from '@clerk/nextjs';

// --- CONFIGURAÇÕES ORIGINAIS ---
const PRECO_PROJETADO = 0.35;
const PRECO_EXISTENTE = 0.2;
const PRECO_RURAL = 1.4;
const CATEGORIAS_LISTA = [
  'AC',
  'EXT.RURAL',
  'EXT.URB',
  'MOD.URB',
  'AFAST/REM',
  'RL/BRT',
  'PASTO',
  'ESTRADA',
];

type TipoPoste = 'projetado' | 'existente' | 'rural';

interface ProjetoSalvo {
  id: number;
  ns: string;
  data: string;
  postes: { x: number; y: number; tipo: TipoPoste }[];
  total: number;
  categoriasGlobais: string[];
}

function SistemaLevantamento() {
  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const [etapa, setEtapa] = useState<'upload' | 'desenho'>('upload');
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [postes, setPostes] = useState<
    { x: number; y: number; tipo: TipoPoste }[]
  >([]);
  const [historico, setHistorico] = useState<ProjetoSalvo[]>([]);
  const [nsInput, setNsInput] = useState<string>('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<
    string[]
  >([]);
  const [xlsxReady, setXlsxReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagemRef = useRef<HTMLImageElement>(null);

  const isApproved = user?.publicMetadata?.status === 'approved';

  // --- EFEITOS (Carregamento e Scripts) ---
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const scriptId = 'xlsx-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src =
          'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.async = true;
        script.onload = () => setXlsxReady(true);
        document.head.appendChild(script);
      } else {
        setXlsxReady(true);
      }

      const salvos = localStorage.getItem('historicoProjetos');
      if (salvos) {
        try {
          const parsed = JSON.parse(salvos);
          // Sanitização para evitar erros se categoriasGlobais não existir em registros antigos
          const treated = parsed.map((p: any) => ({
            ...p,
            categoriasGlobais: Array.isArray(p.categoriasGlobais)
              ? p.categoriasGlobais
              : [],
          }));
          setHistorico(treated);
        } catch (e) {
          setHistorico([]);
        }
      }
    }
  }, []);

  // --- LÓGICA DO CANVAS (Redesenhar quando algo muda) ---
  useEffect(() => {
    if (etapa === 'desenho' && canvasRef.current && imagemRef.current) {
      const cvs = canvasRef.current;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      // Garante que o canvas tenha o tamanho exato da imagem exibida
      cvs.width = imagemRef.current.clientWidth;
      cvs.height = imagemRef.current.clientHeight;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      postes.forEach((p, i) => {
        let cor =
          p.tipo === 'existente'
            ? '#f97316'
            : p.tipo === 'rural'
            ? '#2563eb'
            : '#10b981';
        ctx.fillStyle = cor;
        // Desenha quadrado pequeno (10px de raio visual)
        ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(p.x - 10, p.y - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, p.x, p.y);
      });
    }
  }, [postes, etapa, arquivo]); // Redesenha ao adicionar postes ou mudar tamanho da janela (se houver resize)

  if (!isMounted) return null;

  // --- TELA DE BLOQUEIO ---
  if (!isApproved) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-w-md border border-amber-100">
          <Lock size={40} className="mx-auto mb-6 text-amber-500" />
          <h2 className="text-2xl font-black text-slate-800">
            Aguardando Aprovação
          </h2>
          <p className="text-slate-500 mt-4 leading-relaxed font-medium">
            Olá <strong>{user?.firstName}</strong>. Solicite a liberação do seu
            acesso ao administrador.
          </p>
          <div className="mt-8 pt-6 border-t flex justify-center">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    );
  }

  // --- FUNÇÕES DE LÓGICA ---
  const handleUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(URL.createObjectURL(file));
      setPostes([]);
      setCategoriasSelecionadas([]);
      setEtapa('desenho');
    }
  };

  const adicionarPoste = (e: any) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let tipo: TipoPoste = 'projetado';
    if (e.button === 2) tipo = 'existente';
    else if (e.shiftKey) tipo = 'rural';

    setPostes([...postes, { x, y, tipo }]);
  };

  const removerPoste = (index: number) => {
    const novos = [...postes];
    novos.splice(index, 1);
    setPostes(novos);
  };

  const salvarProjeto = () => {
    // --- TRAVAS DE SEGURANÇA (Solicitação do Print 3) ---
    if (nsInput.length < 10) return alert('ERRO: A NS deve conter 10 dígitos.');
    if (categoriasSelecionadas.length === 0) {
      return alert(
        'ERRO: Selecione pelo menos uma Categoria (Ex: AC, EXT.RURAL) na barra superior antes de salvar.'
      );
    }

    if (!imagemRef.current || !canvasRef.current) return;

    // Gerar imagem final
    const img = imagemRef.current;
    const cvsExp = document.createElement('canvas');
    cvsExp.width = img.naturalWidth;
    cvsExp.height = img.naturalHeight;
    const ctx = cvsExp.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const escala = img.naturalWidth / img.clientWidth; // Proporção entre tela e real

    postes.forEach((p, i) => {
      let cor =
        p.tipo === 'existente'
          ? '#f97316'
          : p.tipo === 'rural'
          ? '#2563eb'
          : '#10b981';
      const tam = 24 * escala; // Escala o tamanho do quadrado para a resolução real da imagem
      ctx.fillStyle = cor;
      ctx.fillRect(p.x * escala - tam / 2, p.y * escala - tam / 2, tam, tam);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * escala;
      ctx.strokeRect(p.x * escala - tam / 2, p.y * escala - tam / 2, tam, tam);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${12 * escala}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, p.x * escala, p.y * escala);
    });

    // Download
    const link = document.createElement('a');
    link.download = `Croqui_${nsInput}.png`;
    link.href = cvsExp.toDataURL('image/png');
    link.click();

    // Salvar Dados
    const vTotal =
      postes.filter((p) => p.tipo === 'projetado').length * PRECO_PROJETADO +
      postes.filter((p) => p.tipo === 'existente').length * PRECO_EXISTENTE +
      postes.filter((p) => p.tipo === 'rural').length * PRECO_RURAL;

    const novo = {
      id: Date.now(),
      ns: nsInput,
      data: new Date().toLocaleDateString('pt-BR'),
      postes,
      categoriasGlobais: categoriasSelecionadas,
      total: vTotal,
    };
    const h = [novo, ...historico];
    setHistorico(h);
    localStorage.setItem('historicoProjetos', JSON.stringify(h));

    // Reset
    setEtapa('upload');
    setNsInput('');
  };

  const exportarExcel = () => {
    if (!xlsxReady || !(window as any).XLSX)
      return alert('Carregando Excel...');
    const XLSX = (window as any).XLSX;
    const dados = historico.map((h) => ({
      NS: h.ns,
      DATA: h.data,
      QTD: h.postes.length,
      'TOTAL US': h.total.toFixed(2).replace('.', ','),
      CATEGORIAS: h.categoriasGlobais ? h.categoriasGlobais.join(', ') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Levantamentos');
    XLSX.writeFile(wb, 'Relatorio_ProEng.xlsx');
  };

  // Cálculos para o Resumo Lateral
  const qtdProj = postes.filter((p) => p.tipo === 'projetado').length;
  const qtdExist = postes.filter((p) => p.tipo === 'existente').length;
  const qtdRural = postes.filter((p) => p.tipo === 'rural').length;
  const totalAtual =
    qtdProj * PRECO_PROJETADO +
    qtdExist * PRECO_EXISTENTE +
    qtdRural * PRECO_RURAL;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* --- HEADER SLIM (Solicitação Print 2) --- */}
      {/* Altura reduzida para h-12 para maximizar espaço do croqui */}
      <header className="h-12 bg-white border-b flex items-center justify-between px-4 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-blue-900">
            <MapPin size={18} className="text-blue-700" />
            <h1 className="font-black text-sm tracking-tighter uppercase leading-none">
              ProEng
            </h1>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <input
            value={nsInput}
            onChange={(e) => setNsInput(e.target.value)}
            maxLength={10}
            placeholder="NS 10 dígitos"
            className="bg-slate-100 border-none rounded px-2 py-1 text-[11px] font-bold w-32 outline-none font-mono focus:ring-1 focus:ring-blue-400"
          />

          {/* --- CATEGORIAS NO HEADER (Solicitação: Categorias na barra superior) --- */}
          {etapa === 'desenho' && (
            <div className="flex gap-1 ml-2 overflow-x-auto no-scrollbar items-center">
              {CATEGORIAS_LISTA.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setCategoriasSelecionadas((prev) =>
                      prev.includes(cat)
                        ? prev.filter((c) => c !== cat)
                        : [...prev, cat]
                    )
                  }
                  className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all whitespace-nowrap ${
                    categoriasSelecionadas.includes(cat)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {etapa === 'desenho' && (
            <button
              onClick={salvarProjeto}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center gap-1"
            >
              <Download size={12} /> Salvar
            </button>
          )}
          {/* User Button menor */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{ elements: { userButtonBox: 'scale-75' } }}
          />
        </div>
      </header>

      {/* --- CORPO PRINCIPAL --- */}
      <main className="flex-1 flex overflow-hidden">
        {etapa === 'upload' ? (
          <div className="flex-1 p-6 grid grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto">
            {/* Upload Area */}
            <div className="col-span-8 border-2 border-dashed border-slate-300 rounded-3xl bg-white flex flex-col items-center justify-center relative hover:bg-blue-50 transition-all group cursor-pointer">
              <input
                type="file"
                onChange={handleUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <Upload
                size={32}
                className="text-blue-500 mb-2 group-hover:scale-110 transition-transform"
              />
              <h2 className="text-lg font-bold text-slate-700">
                Novo Levantamento
              </h2>
              <p className="text-slate-400 text-xs">
                Arraste ou clique para carregar
              </p>
            </div>

            {/* --- HISTÓRICO COMPACTO (Solicitação Print 1) --- */}
            {/* Itens menores para caber mais na tela */}
            <div className="col-span-4 bg-white rounded-3xl border flex flex-col overflow-hidden shadow-sm">
              <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                <span className="text-xs font-black uppercase text-slate-500 flex gap-2 items-center">
                  <History size={14} /> Histórico
                </span>
                <button
                  onClick={exportarExcel}
                  className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
                {historico.length === 0 && (
                  <div className="text-center text-[10px] text-slate-400 py-10">
                    Histórico vazio
                  </div>
                )}
                {historico.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white px-3 py-1.5 rounded-lg border border-slate-100 flex justify-between items-center hover:border-blue-300 shadow-sm transition-all group"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-blue-700">
                          NS {p.ns}
                        </span>
                        <span className="text-[8px] bg-slate-100 px-1 rounded text-slate-500">
                          {p.data}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">
                        {p.postes.length} itens{' '}
                        {p.categoriasGlobais && p.categoriasGlobais.length > 0
                          ? `• ${p.categoriasGlobais[0]}...`
                          : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-black text-emerald-600">
                        US {p.total.toFixed(2).replace('.', ',')}
                      </div>
                      <button
                        onClick={() => {
                          const n = historico.filter((x) => x.id !== p.id);
                          setHistorico(n);
                          localStorage.setItem(
                            'historicoProjetos',
                            JSON.stringify(n)
                          );
                        }}
                        className="text-slate-200 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* --- ÁREA DO CROQUI SEM ROLAGEM (Solicitação: Caber na página) --- */}
            <div className="flex-1 bg-slate-200 flex items-center justify-center relative overflow-hidden p-2">
              <div className="relative shadow-2xl bg-white border border-white flex items-center justify-center w-full h-full">
                {/* Imagem configurada com object-contain para nunca estourar a tela */}
                <img
                  ref={imagemRef}
                  src={arquivo!}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  alt="Croqui"
                />
                <canvas
                  ref={canvasRef}
                  onMouseDown={adicionarPoste}
                  onContextMenu={(e) => e.preventDefault()}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair z-10"
                  // O estilo inline aqui ajuda a manter o canvas alinhado com a imagem renderizada
                  style={{
                    width: imagemRef.current ? imagemRef.current.width : '100%',
                    height: imagemRef.current
                      ? imagemRef.current.height
                      : '100%',
                  }}
                />
              </div>

              {/* Botão Voltar */}
              <button
                onClick={() => setEtapa('upload')}
                className="absolute top-4 left-4 bg-white px-3 py-1 rounded shadow text-[10px] font-bold border hover:bg-slate-50"
              >
                ← VOLTAR
              </button>

              {/* --- LEGENDA NO CANTO INFERIOR ESQUERDO (Solicitação Print 1) --- */}
              <div className="absolute bottom-4 left-4 flex gap-3 bg-slate-800/90 text-white px-3 py-2 rounded-lg text-[9px] font-bold backdrop-blur-sm border border-white/10 shadow-xl pointer-events-none select-none">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-sm" />{' '}
                  Projetado (Click)
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-sm" /> Existente
                  (Dir)
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-sm" /> Rural
                  (Shift)
                </div>
              </div>
            </div>

            {/* --- RESUMO LATERAL REDUZIDO (Solicitação Print 4) --- */}
            {/* Largura reduzida para w-56 e fonte menor */}
            <aside className="w-56 bg-white border-l flex flex-col z-20 shrink-0 shadow-sm">
              <div className="p-3 bg-slate-50 border-b flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Resumo Atual
                </span>
                <span className="text-xs font-bold text-blue-700 font-mono mt-1">
                  {nsInput || '---'}
                </span>
              </div>

              {/* Lista de Pontos */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/20">
                {postes.map((p, i) => (
                  <div
                    key={i}
                    className="bg-white px-2 py-1 rounded border border-slate-100 flex justify-between items-center group hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 bg-slate-800 text-white rounded flex items-center justify-center font-bold text-[8px]">
                        {i + 1}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase ${
                          p.tipo === 'existente'
                            ? 'text-orange-500'
                            : p.tipo === 'rural'
                            ? 'text-blue-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {p.tipo.substring(0, 4)}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const novos = [...postes];
                        novos.splice(i, 1);
                        setPostes(novos);
                      }}
                      className="text-slate-200 hover:text-red-500"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Painel Totalizador Pequeno */}
              <div className="p-3 bg-slate-900 text-white">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                    Total
                  </span>
                  <span className="text-lg font-black text-emerald-400 leading-none">
                    US {totalAtual.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                  <div className="bg-white/10 rounded py-1 border border-white/5">
                    <div className="text-[7px] text-slate-400 mb-0.5">PROJ</div>
                    {qtdProj}
                  </div>
                  <div className="bg-white/10 rounded py-1 border border-white/5">
                    <div className="text-[7px] text-slate-400 mb-0.5">
                      EXIST
                    </div>
                    {qtdExist}
                  </div>
                  <div className="bg-white/10 rounded py-1 border border-white/5">
                    <div className="text-[7px] text-slate-400 mb-0.5">
                      RURAL
                    </div>
                    {qtdRural}
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey="pk_test_bGl2aW5nLWdydWItOTQuY2xlcmsuYWNjb3VudHMuZGV2JA">
      <SignedOut>
        <div className="h-screen flex items-center justify-center bg-slate-900 font-sans p-6">
          <div className="bg-white p-12 rounded-[2rem] text-center shadow-2xl max-w-sm w-full border-b-[8px] border-blue-600">
            <h1 className="text-4xl font-black text-slate-800 mb-8 tracking-tighter uppercase">
              ProEng
            </h1>
            <SignInButton mode="modal">
              <button className="bg-blue-600 hover:bg-blue-700 text-white w-full py-4 rounded-xl font-black text-lg shadow-lg transition-transform active:scale-95 uppercase tracking-wide">
                Acessar Sistema
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <SistemaLevantamento />
      </SignedIn>
    </ClerkProvider>
  );
}
