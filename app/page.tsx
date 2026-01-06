'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  Download,
  Trash2,
  History,
  MapPin,
  FileSpreadsheet,
  Lock,
  Filter,
  Calendar,
} from 'lucide-react';
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from '@clerk/nextjs';

// --- CONFIGURAÇÕES ---
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

const TOPOGRAFOS_LISTA = [
  'CAIO',
  'ALEX TEIXEIRA',
  'FABIANO',
  'BRUNO',
  'FREELANCER',
  'HENRIQUE',
  'MAURICIO',
  'GENIVALDO',
  'KENEDY',
  'JUNIOR',
  'MAURO',
];

type TipoPoste = 'projetado' | 'existente' | 'rural';

interface ProjetoSalvo {
  id: number;
  ns: string;
  data: string;
  dataIso: string;
  postes: { x: number; y: number; tipo: TipoPoste }[];
  total: number;
  categoriasGlobais: string[];
  topografo: string;
}

function SistemaLevantamento() {
  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);

  // Estados principais
  const [etapa, setEtapa] = useState<'upload' | 'desenho'>('upload');
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [postes, setPostes] = useState<
    { x: number; y: number; tipo: TipoPoste }[]
  >([]);
  const [historico, setHistorico] = useState<ProjetoSalvo[]>([]);

  // Inputs
  const [nsInput, setNsInput] = useState<string>('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<
    string[]
  >([]);
  const [topografoSelecionado, setTopografoSelecionado] = useState<string>('');

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');

  const [xlsxReady, setXlsxReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagemRef = useRef<HTMLImageElement>(null);

  const isApproved = user?.publicMetadata?.status === 'approved';

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
          const treated = parsed.map((p: any) => ({
            ...p,
            categoriasGlobais: Array.isArray(p.categoriasGlobais)
              ? p.categoriasGlobais
              : [],
            topografo: p.topografo || '',
            dataIso: p.dataIso || formatarDataParaIso(p.data),
          }));
          setHistorico(treated);
        } catch (e) {
          setHistorico([]);
        }
      }
    }
  }, []);

  const formatarDataParaIso = (dataBR: string) => {
    if (!dataBR) return '';
    const partes = dataBR.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return '';
  };

  // --- LÓGICA DO CANVAS (Sincronização de Tamanho) ---
  const atualizarTamanhoCanvas = () => {
    if (etapa === 'desenho' && canvasRef.current && imagemRef.current) {
      const cvs = canvasRef.current;
      const img = imagemRef.current;

      // O canvas deve ter EXATAMENTE o tamanho em pixels que a imagem está ocupando na tela
      if (img.clientWidth > 0 && img.clientHeight > 0) {
        cvs.width = img.clientWidth;
        cvs.height = img.clientHeight;
        desenharPontos();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('resize', atualizarTamanhoCanvas);
    const timeOut = setTimeout(atualizarTamanhoCanvas, 100);
    return () => {
      window.removeEventListener('resize', atualizarTamanhoCanvas);
      clearTimeout(timeOut);
    };
  }, [etapa, arquivo, postes]);

  const desenharPontos = () => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;

    ctx.clearRect(0, 0, cvs.width, cvs.height);

    postes.forEach((p, i) => {
      let cor =
        p.tipo === 'existente'
          ? '#f97316'
          : p.tipo === 'rural'
          ? '#2563eb'
          : '#10b981';
      ctx.fillStyle = cor;
      ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(p.x - 10, p.y - 10, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, p.x, p.y);
    });
  };

  const historicoFiltrado = useMemo(() => {
    return historico.filter((item) => {
      const itemData = item.dataIso || formatarDataParaIso(item.data);
      if (filtroDataInicio && itemData < filtroDataInicio) return false;
      if (filtroDataFim && itemData > filtroDataFim) return false;
      return true;
    });
  }, [historico, filtroDataInicio, filtroDataFim]);

  const aplicarFiltroHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    setFiltroDataInicio(hoje);
    setFiltroDataFim(hoje);
  };

  const limparFiltros = () => {
    setFiltroDataInicio('');
    setFiltroDataFim('');
  };

  if (!isMounted) return null;

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
            acesso.
          </p>
          <div className="mt-8 pt-6 border-t flex justify-center">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    );
  }

  const handleUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(URL.createObjectURL(file));
      setPostes([]);
      setCategoriasSelecionadas([]);
      setTopografoSelecionado('');
      setEtapa('desenho');
    }
  };

  const adicionarPoste = (e: any) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    // Método direto e robusto (offsetX pega a coordenada dentro do elemento clicado)
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    let tipo: TipoPoste = 'projetado';
    if (e.button === 2) tipo = 'existente';
    else if (e.shiftKey) tipo = 'rural';

    setPostes([...postes, { x, y, tipo }]);
  };

  const salvarProjeto = () => {
    // --- TRAVAS DE SEGURANÇA ---
    if (nsInput.length !== 10)
      return alert('ERRO: A NS deve conter exatamente 10 dígitos.');
    if (categoriasSelecionadas.length === 0)
      return alert('ERRO: Selecione pelo menos uma Categoria.');
    if (!topografoSelecionado)
      return alert('ERRO: Selecione o nome do Topógrafo.');

    if (!imagemRef.current || !canvasRef.current) return;

    const img = imagemRef.current;
    const cvsExp = document.createElement('canvas');
    cvsExp.width = img.naturalWidth;
    cvsExp.height = img.naturalHeight;
    const ctx = cvsExp.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    const escalaX = img.naturalWidth / canvasRef.current.width;
    const escalaY = img.naturalHeight / canvasRef.current.height;

    postes.forEach((p, i) => {
      let cor =
        p.tipo === 'existente'
          ? '#f97316'
          : p.tipo === 'rural'
          ? '#2563eb'
          : '#10b981';
      const referenciaBase = Math.max(img.naturalWidth, 1000);
      const tam = 24 * (referenciaBase / 1000);
      const fonte = 12 * (referenciaBase / 1000);

      const pX = p.x * escalaX;
      const pY = p.y * escalaY;

      ctx.fillStyle = cor;
      ctx.fillRect(pX - tam / 2, pY - tam / 2, tam, tam);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * (referenciaBase / 1000);
      ctx.strokeRect(pX - tam / 2, pY - tam / 2, tam, tam);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fonte}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, pX, pY);
    });

    const link = document.createElement('a');
    link.download = `Croqui_${nsInput}_${topografoSelecionado}.png`;
    link.href = cvsExp.toDataURL('image/png');
    link.click();

    const vTotal =
      postes.filter((p) => p.tipo === 'projetado').length * PRECO_PROJETADO +
      postes.filter((p) => p.tipo === 'existente').length * PRECO_EXISTENTE +
      postes.filter((p) => p.tipo === 'rural').length * PRECO_RURAL;

    const hoje = new Date();
    const novo = {
      id: Date.now(),
      ns: nsInput,
      data: hoje.toLocaleDateString('pt-BR'),
      dataIso: hoje.toISOString().split('T')[0],
      postes,
      categoriasGlobais: categoriasSelecionadas,
      topografo: topografoSelecionado,
      total: vTotal,
    };
    const h = [novo, ...historico];
    setHistorico(h);
    localStorage.setItem('historicoProjetos', JSON.stringify(h));

    setEtapa('upload');
    setNsInput('');
    setCategoriasSelecionadas([]);
    setTopografoSelecionado('');
  };

  const exportarExcel = () => {
    if (!xlsxReady || !(window as any).XLSX)
      return alert('Carregando Excel...');
    const XLSX = (window as any).XLSX;

    const dados = historicoFiltrado.map((h) => ({
      NS: h.ns,
      DATA: h.data,
      QTD: h.postes.length,
      'TOTAL US': h.total.toFixed(2).replace('.', ','),
      CATEGORIAS: h.categoriasGlobais ? h.categoriasGlobais.join(', ') : '',
      TOPÓGRAFO: h.topografo || '',
    }));

    if (dados.length === 0)
      return alert('Nada para exportar com os filtros atuais.');

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Levantamentos');
    XLSX.writeFile(wb, 'Relatorio_ProEng.xlsx');
  };

  const qtdProj = postes.filter((p) => p.tipo === 'projetado').length;
  const qtdExist = postes.filter((p) => p.tipo === 'existente').length;
  const qtdRural = postes.filter((p) => p.tipo === 'rural').length;
  const totalAtual =
    qtdProj * PRECO_PROJETADO +
    qtdExist * PRECO_EXISTENTE +
    qtdRural * PRECO_RURAL;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* --- HEADER OTIMIZADO (SEM SCROLL) --- */}
      <header className="h-auto min-h-[4.5rem] bg-white border-b flex items-start justify-between px-4 py-2 shrink-0 z-30 shadow-sm gap-4 transition-all">
        {/* BLOCO 1: LOGO + NS (Esquerda) */}
        <div className="flex flex-col gap-2 shrink-0 border-r border-slate-100 pr-4">
          {/* Logo */}
          <div className="flex items-center gap-2 text-blue-900">
            <MapPin size={18} className="text-blue-700" />
            <h1 className="font-black text-sm tracking-tighter uppercase leading-none">
              ProEng
            </h1>
          </div>

          {/* NS Input */}
          {etapa === 'desenho' && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <span className="text-[10px] font-bold text-slate-400">NS:</span>
              <input
                value={nsInput}
                onChange={(e) => setNsInput(e.target.value)}
                maxLength={10}
                placeholder="0000000000"
                className="bg-transparent border-none text-[11px] font-bold w-20 outline-none font-mono text-slate-700"
              />
            </div>
          )}
        </div>

        {/* BLOCO 2: CATEGORIAS E TOPÓGRAFOS (Centro Expandido) */}
        {etapa === 'desenho' ? (
          <div className="flex-1 flex flex-col gap-1.5 justify-center">
            {/* Linha Superior: Categorias */}
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[9px] font-bold text-slate-300 uppercase mr-1">
                Cat:
              </span>
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
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none transition-colors ${
                    categoriasSelecionadas.includes(cat)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Linha Inferior: Topógrafos */}
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[9px] font-bold text-slate-300 uppercase mr-1">
                Top:
              </span>
              {TOPOGRAFOS_LISTA.map((nome) => (
                <button
                  key={nome}
                  onClick={() => setTopografoSelecionado(nome)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none transition-colors ${
                    topografoSelecionado === nome
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-orange-300'
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1"></div>
        )}

        {/* BLOCO 3: BOTÕES DE AÇÃO (Direita) */}
        <div className="flex flex-col items-end gap-2 shrink-0 pl-2">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: { userButtonBox: 'scale-75 origin-right' },
            }}
          />
          {etapa === 'desenho' && (
            <button
              onClick={salvarProjeto}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Download size={12} /> Salvar
            </button>
          )}
        </div>
      </header>

      {/* --- CORPO PRINCIPAL --- */}
      <main className="flex-1 flex overflow-hidden">
        {etapa === 'upload' ? (
          <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto">
            {/* NOVO LEVANTAMENTO (35%) */}
            <div className="lg:col-span-4 border-2 border-dashed border-slate-300 rounded-3xl bg-white flex flex-col items-center justify-center relative hover:bg-blue-50 transition-all group cursor-pointer shadow-sm">
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
              <p className="text-slate-400 text-xs text-center px-4">
                Carregue o croqui aqui
              </p>
            </div>

            {/* HISTÓRICO (65%) */}
            <div className="lg:col-span-8 bg-white rounded-3xl border flex flex-col overflow-hidden shadow-sm">
              <div className="p-3 border-b bg-slate-50 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-slate-500 flex gap-2 items-center">
                    <History size={14} /> Histórico
                  </span>
                  <button
                    onClick={exportarExcel}
                    className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded border border-emerald-100"
                  >
                    <FileSpreadsheet size={14} /> Baixar Excel
                  </button>
                </div>

                {/* FILTROS DE DATA */}
                <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 shadow-sm flex-wrap">
                  <Filter size={12} className="text-slate-400" />
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400">
                      DE:
                    </span>
                    <input
                      type="date"
                      value={filtroDataInicio}
                      onChange={(e) => setFiltroDataInicio(e.target.value)}
                      className="text-[10px] bg-slate-50 border rounded px-1 text-slate-600 uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400">
                      ATÉ:
                    </span>
                    <input
                      type="date"
                      value={filtroDataFim}
                      onChange={(e) => setFiltroDataFim(e.target.value)}
                      className="text-[10px] bg-slate-50 border rounded px-1 text-slate-600 uppercase"
                    />
                  </div>
                  <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block"></div>
                  <button
                    onClick={aplicarFiltroHoje}
                    className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                  >
                    <Calendar size={10} /> Hoje
                  </button>
                  {(filtroDataInicio || filtroDataFim) && (
                    <button
                      onClick={limparFiltros}
                      className="text-[9px] font-bold text-red-400 hover:text-red-600 ml-auto"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
                {historicoFiltrado.length === 0 && (
                  <div className="text-center text-[10px] text-slate-400 py-10">
                    Nenhum registro encontrado.
                  </div>
                )}

                {historicoFiltrado.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white px-3 py-2 rounded-lg border border-slate-100 flex justify-between items-center hover:border-blue-300 shadow-sm transition-all group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-blue-700">
                          NS {p.ns}
                        </span>
                        <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono">
                          {p.data}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 font-bold">
                          {p.postes.length} itens
                        </span>
                        {p.topografo && (
                          <span className="text-[8px] font-bold bg-orange-100 text-orange-700 px-1 rounded uppercase">
                            {p.topografo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-black text-emerald-600">
                        US {p.total.toFixed(2).replace('.', ',')}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Deseja excluir este registro?')) {
                            const n = historico.filter((x) => x.id !== p.id);
                            setHistorico(n);
                            localStorage.setItem(
                              'historicoProjetos',
                              JSON.stringify(n)
                            );
                          }
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
            {/* --- ÁREA DO CROQUI --- */}
            <div className="flex-1 bg-slate-200 flex items-center justify-center relative overflow-hidden p-2">
              <div className="relative shadow-2xl bg-white border border-white flex items-center justify-center w-full h-full">
                <img
                  ref={imagemRef}
                  src={arquivo!}
                  onLoad={atualizarTamanhoCanvas}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  alt="Croqui"
                />
                <canvas
                  ref={canvasRef}
                  onMouseDown={adicionarPoste}
                  onContextMenu={(e) => e.preventDefault()}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair z-10"
                />
              </div>

              <button
                onClick={() => setEtapa('upload')}
                className="absolute top-4 left-4 bg-white px-3 py-1 rounded shadow text-[10px] font-bold border hover:bg-slate-50"
              >
                ← VOLTAR
              </button>

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

            {/* --- RESUMO LATERAL --- */}
            <aside className="w-56 bg-white border-l flex flex-col z-20 shrink-0 shadow-sm">
              <div className="p-3 bg-slate-50 border-b flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Resumo Atual
                </span>
                <span className="text-xs font-bold text-blue-700 font-mono mt-1">
                  {nsInput || '---'}
                </span>
                <span className="text-[9px] font-bold text-orange-600 mt-1">
                  {topografoSelecionado || 'Topógrafo ñ selecionado'}
                </span>
              </div>

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
