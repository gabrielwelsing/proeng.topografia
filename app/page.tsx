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
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Leaf,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  Car,
  HardHat,
} from 'lucide-react';
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from '@clerk/nextjs';

import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import html2canvas from 'html2canvas';

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
  'ALEX TEIXEIRA',
  'BRUNO',
  'CAIO',
  'ESMENDIO',
  'FABIANO',
  'FREELANCER',
  'GENIVALDO',
  'HENRIQUE',
  'JUNIOR',
  'KENEDY',
  'MAURICIO',
  'MAURO',
];

type TipoPoste = 'projetado' | 'existente' | 'rural';

interface PaginaData {
  id: number;
  imagem: string; // Base64
  width: number;
  height: number;
  postes: { x: number; y: number; tipo: TipoPoste }[];
}

interface ProjetoSalvo {
  id: number;
  ns: string;
  data: string;
  dataIso: string;
  paginas: PaginaData[];
  total: number;
  usKm: number;
  categoriasGlobais: string[];
  topografo: string;
  ambiental: string;
  servidao: string;
}

function SistemaLevantamento() {
  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);

  // Estados principais
  const [etapa, setEtapa] = useState<'upload' | 'desenho'>('upload');

  // Gerenciamento de Páginas e Zoom
  const [paginas, setPaginas] = useState<PaginaData[]>([]);
  const [paginaAtual, setPaginaAtual] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);

  const [historico, setHistorico] = useState<ProjetoSalvo[]>([]);

  // Inputs
  const [nsInput, setNsInput] = useState<string>('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<
    string[]
  >([]);
  const [topografoSelecionado, setTopografoSelecionado] = useState<string>('');
  const [ambiental, setAmbiental] = useState<string>('');
  const [servidao, setServidao] = useState<string>('');
  const [usKmInput, setUsKmInput] = useState<string>('');

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [mostrandoRelatorio, setMostrandoRelatorio] = useState(false);
  const [processandoSalvar, setProcessandoSalvar] = useState(false);
  const [processandoUpload, setProcessandoUpload] = useState(false);

  const [xlsxReady, setXlsxReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const relatorioRef = useRef<HTMLDivElement>(null);

  const isApproved = user?.publicMetadata?.status === 'approved';

  // --- HOOKS ---
  const formatarDataParaIso = (dataBR: string) => {
    if (!dataBR) return '';
    const partes = dataBR.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return '';
  };

  const historicoFiltrado = useMemo(() => {
    return historico.filter((item) => {
      const itemData = item.dataIso || formatarDataParaIso(item.data);
      if (filtroDataInicio && itemData < filtroDataInicio) return false;
      if (filtroDataFim && itemData > filtroDataFim) return false;
      return true;
    });
  }, [historico, filtroDataInicio, filtroDataFim]);

  const dadosRelatorioMatriz = useMemo(() => {
    const hoje = new Date();
    const diasDaSemana: { iso: string; formatado: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(hoje.getDate() - i);
      diasDaSemana.push({
        iso: d.toISOString().split('T')[0],
        formatado: d.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
      });
    }

    const matriz: any[] = TOPOGRAFOS_LISTA.map((nome) => {
      const diasObj: any = {};
      diasDaSemana.forEach((d) => (diasObj[d.iso] = 0));
      return { nome, dias: diasObj, total: 0 };
    });

    historico.forEach((h) => {
      const dataItem = h.dataIso;
      if (diasDaSemana.some((d) => d.iso === dataItem)) {
        const nomeTopo = h.topografo ? h.topografo.toUpperCase() : null;
        if (nomeTopo) {
          const linha = matriz.find((m) => m.nome === nomeTopo);
          if (linha) {
            linha.dias[dataItem] += 1;
            linha.total += 1;
          }
        }
      }
    });

    matriz.sort((a, b) => b.total - a.total);
    return { colunas: diasDaSemana, linhas: matriz };
  }, [historico]);

  const statsTotal = useMemo(() => {
    let p = 0,
      e = 0,
      r = 0;
    paginas.forEach((pag) => {
      p += pag.postes.filter((x) => x.tipo === 'projetado').length;
      e += pag.postes.filter((x) => x.tipo === 'existente').length;
      r += pag.postes.filter((x) => x.tipo === 'rural').length;
    });

    const valorKm = parseFloat(usKmInput.replace(',', '.') || '0');

    return {
      p,
      e,
      r,
      subtotalItens:
        p * PRECO_PROJETADO + e * PRECO_EXISTENTE + r * PRECO_RURAL,
      valorKm,
      total:
        p * PRECO_PROJETADO + e * PRECO_EXISTENTE + r * PRECO_RURAL + valorKm,
    };
  }, [paginas, usKmInput]);

  // --- EFEITOS ---
  useEffect(() => {
    setIsMounted(true);

    if (typeof window !== 'undefined') {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
      } catch (error) {
        console.error(error);
      }

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
            // Garante estrutura antiga e NOVA (onde imagem pode estar vazia)
            paginas: p.paginas || [
              {
                id: 0,
                imagem: '',
                width: 800,
                height: 1100,
                postes: p.postes || [],
              },
            ],
            categoriasGlobais: Array.isArray(p.categoriasGlobais)
              ? p.categoriasGlobais
              : [],
            topografo: p.topografo || '',
            ambiental: p.ambiental || '',
            servidao: p.servidao || '',
            usKm: p.usKm || 0,
            dataIso: p.dataIso || formatarDataParaIso(p.data),
          }));
          setHistorico(treated);
        } catch (e) {
          console.error('Erro ao carregar histórico', e);
          // Se der erro de parse, pode ser lixo no storage, não zera, só loga
        }
      }
    }
  }, []);

  // --- AJUSTE AUTOMÁTICO DE ZOOM ---
  useEffect(() => {
    if (etapa === 'desenho' && paginas[paginaAtual] && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const imgW = paginas[paginaAtual].width;
      const imgH = paginas[paginaAtual].height;

      const scaleX = (containerWidth - 40) / imgW;
      const scaleY = (containerHeight - 40) / imgH;

      let initialZoom = Math.min(scaleX, scaleY);
      if (initialZoom > 1) initialZoom = 1;

      setZoom(initialZoom);
    }
  }, [etapa, paginaAtual]);

  useEffect(() => {
    if (etapa === 'desenho' && canvasRef.current && paginas[paginaAtual]) {
      desenharCanvasAtual();
    }
  }, [etapa, paginaAtual, paginas, zoom]);

  const desenharCanvasAtual = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const pag = paginas[paginaAtual];
    cvs.width = pag.width * zoom;
    cvs.height = pag.height * zoom;

    // Se não tiver imagem (ex: carregado do histórico antigo), não desenha ou desenha placeholder
    if (!pag.imagem) return;

    const img = new Image();
    img.src = pag.imagem;
    img.onload = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0, pag.width * zoom, pag.height * zoom);

      pag.postes.forEach((p, i) => {
        const x = p.x * zoom;
        const y = p.y * zoom;

        let cor =
          p.tipo === 'existente'
            ? '#f97316'
            : p.tipo === 'rural'
            ? '#2563eb'
            : '#10b981';
        ctx.fillStyle = cor;
        ctx.fillRect(x - 10, y - 10, 20, 20);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 10, y - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, x, y);
      });
    };
  };

  const handleUpload = async (e: any) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessandoUpload(true);

    // ZERA TUDO
    setPaginas([]);
    setPaginaAtual(0);
    setCategoriasSelecionadas([]);
    setTopografoSelecionado('');
    setAmbiental('');
    setServidao('');
    setNsInput('');
    setUsKmInput('');

    const novasPaginas: PaginaData[] = [];
    const imagesForPdf: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File;

      if (file.type === 'application/pdf') {
        try {
          const url = URL.createObjectURL(file);
          const loadingTask = pdfjsLib.getDocument(url);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = viewport.width;
          tempCanvas.height = viewport.height;
          const tempContext = tempCanvas.getContext('2d');

          if (tempContext) {
            await page.render({
              canvasContext: tempContext,
              viewport: viewport,
            }).promise;
            const imgData = tempCanvas.toDataURL('image/png');

            novasPaginas.push({
              id: i,
              imagem: imgData,
              width: viewport.width,
              height: viewport.height,
              postes: [],
            });
            imagesForPdf.push(imgData);
          }
        } catch (err) {
          console.error(err);
        }
      } else if (file.type.startsWith('image/')) {
        const imgUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(evt.target?.result as string);
          reader.readAsDataURL(file);
        });

        const imgObj = new Image();
        imgObj.src = imgUrl;
        await new Promise((resolve) => (imgObj.onload = resolve));

        novasPaginas.push({
          id: i,
          imagem: imgUrl,
          width: imgObj.naturalWidth,
          height: imgObj.naturalHeight,
          postes: [],
        });
        imagesForPdf.push(imgUrl);
      }
    }

    const isSinglePdf =
      files.length === 1 && files[0].type === 'application/pdf';

    if (imagesForPdf.length > 0 && !isSinglePdf) {
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        let firstPage = true;

        for (const imgData of imagesForPdf) {
          const imgObj = new Image();
          imgObj.src = imgData;
          await new Promise((resolve) => (imgObj.onload = resolve));

          if (!firstPage) doc.addPage();

          const imgRatio = imgObj.naturalWidth / imgObj.naturalHeight;
          const pageRatio = pageWidth / pageHeight;

          let renderWidth, renderHeight;

          if (imgRatio > pageRatio) {
            renderWidth = pageWidth;
            renderHeight = pageWidth / imgRatio;
          } else {
            renderHeight = pageHeight;
            renderWidth = pageHeight * imgRatio;
          }

          const xPos = (pageWidth - renderWidth) / 2;
          const yPos = (pageHeight - renderHeight) / 2;

          doc.addImage(imgData, 'JPEG', xPos, yPos, renderWidth, renderHeight);

          firstPage = false;
        }
        doc.save('croqui_unificado_inicial.pdf');
      } catch (e) {
        console.error('Erro ao gerar PDF inicial', e);
      }
    }

    if (novasPaginas.length > 0) {
      setPaginas(novasPaginas);
      setEtapa('desenho');
    }
    setProcessandoUpload(false);
  };

  const adicionarPoste = (e: any) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xClick = e.clientX - rect.left;
    const yClick = e.clientY - rect.top;

    const xReal = xClick / zoom;
    const yReal = yClick / zoom;

    let tipo: TipoPoste =
      e.button === 2 ? 'existente' : e.shiftKey ? 'rural' : 'projetado';

    setPaginas((prev) => {
      const novoArray = [...prev];
      novoArray[paginaAtual] = {
        ...novoArray[paginaAtual],
        postes: [
          ...novoArray[paginaAtual].postes,
          { x: xReal, y: yReal, tipo },
        ],
      };
      return novoArray;
    });
  };

  const salvarProjeto = async () => {
    if (nsInput.length !== 10)
      return alert('ERRO: A NS deve conter exatamente 10 dígitos.');
    if (categoriasSelecionadas.length === 0)
      return alert('ERRO: Selecione pelo menos uma Categoria.');
    if (!topografoSelecionado)
      return alert('ERRO: Selecione o nome do Topógrafo.');
    if (!ambiental) return alert('ERRO: Selecione se é Ambiental SIM ou NÃO.');

    setProcessandoSalvar(true);

    try {
      // 1. GERA A IMAGEM UNIFICADA (Download)
      let larguraTotal = 0;
      let alturaTotal = 0;

      paginas.forEach((p) => {
        if (p.width > larguraTotal) larguraTotal = p.width;
        alturaTotal += p.height;
      });

      const canvasUnificado = document.createElement('canvas');
      canvasUnificado.width = larguraTotal;
      canvasUnificado.height = alturaTotal;
      const ctx = canvasUnificado.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, larguraTotal, alturaTotal);

        let yOffset = 0;

        for (const pag of paginas) {
          const img = new Image();
          img.src = pag.imagem;
          await new Promise((resolve) => (img.onload = resolve));

          const xPos = (larguraTotal - pag.width) / 2;

          ctx.drawImage(img, xPos, yOffset);

          pag.postes.forEach((pt, i) => {
            const pX = pt.x + xPos;
            const pY = pt.y + yOffset;

            let cor =
              pt.tipo === 'existente'
                ? '#f97316'
                : pt.tipo === 'rural'
                ? '#2563eb'
                : '#10b981';
            const referenciaBase = Math.max(larguraTotal, 1000);
            const tam = 24 * (referenciaBase / 1000);
            const fonte = 12 * (referenciaBase / 1000);

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

          yOffset += pag.height;
        }

        const link = document.createElement('a');
        link.download = `Croqui_${nsInput}_${topografoSelecionado}.png`;
        link.href = canvasUnificado.toDataURL('image/png');
        link.click();
      }

      // 2. SALVA NO HISTÓRICO (SEM AS IMAGENS PESADAS)
      const hoje = new Date();

      // **IMPORTANTE: Limpar imagens para não estourar a Cota**
      const paginasLeves = paginas.map((p) => ({
        ...p,
        imagem: '', // Remove a base64 gigante
      }));

      const novo: ProjetoSalvo = {
        id: Date.now(),
        ns: nsInput,
        data: hoje.toLocaleDateString('pt-BR'),
        dataIso: hoje.toISOString().split('T')[0],
        paginas: paginasLeves, // Salva a versão leve
        categoriasGlobais: categoriasSelecionadas,
        topografo: topografoSelecionado,
        ambiental,
        servidao,
        usKm: statsTotal.valorKm,
        total: statsTotal.total,
      };

      const h = [novo, ...historico];
      setHistorico(h);
      localStorage.setItem('historicoProjetos', JSON.stringify(h));

      // Reset
      setEtapa('upload');
      setNsInput('');
      setCategoriasSelecionadas([]);
      setTopografoSelecionado('');
      setAmbiental('');
      setServidao('');
      setUsKmInput('');
      setPaginas([]);
      setZoom(1);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(
        'Erro: Não foi possível salvar no Histórico (Cota Excedida ou Erro Interno). Mas sua imagem foi gerada.'
      );
    } finally {
      setProcessandoSalvar(false);
    }
  };

  const aplicarFiltroHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    setFiltroDataInicio(hoje);
    setFiltroDataFim(hoje);
  };

  const limparFiltros = () => {
    setFiltroDataInicio('');
    setFiltroDataFim('');
  };

  const gerarImagemRelatorio = async () => {
    setMostrandoRelatorio(true);
    setTimeout(async () => {
      if (relatorioRef.current) {
        try {
          const canvas = await html2canvas(relatorioRef.current, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
          });
          const link = document.createElement('a');
          link.download = `Relatorio_Matriz_${new Date()
            .toLocaleDateString('pt-BR')
            .replace(/\//g, '-')}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch (error) {
          alert('Erro ao gerar imagem.');
        } finally {
          setMostrandoRelatorio(false);
        }
      }
    }, 800);
  };

  const exportarExcel = () => {
    if (!xlsxReady || !(window as any).XLSX)
      return alert('Carregando Excel...');
    const XLSX = (window as any).XLSX;
    const dados = historicoFiltrado.map((h) => {
      const totalItens = h.paginas.reduce((acc, p) => acc + p.postes.length, 0);
      return {
        NS: h.ns,
        DATA: h.data,
        QTD: totalItens,
        'KM (US)': h.usKm ? h.usKm.toFixed(2).replace('.', ',') : '0,00',
        'TOTAL US': h.total.toFixed(2).replace('.', ','),
        CATEGORIAS: h.categoriasGlobais ? h.categoriasGlobais.join(', ') : '',
        TOPÓGRAFO: h.topografo || '',
        AMBIENTAL: h.ambiental || '',
        SERVIDÃO: h.servidao || '',
      };
    });
    if (dados.length === 0) return alert('Nada para exportar.');
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Levantamentos');
    XLSX.writeFile(wb, 'Relatorio_ProEng.xlsx');
  };

  const styles = {
    container: {
      backgroundColor: '#ffffff',
      padding: '20px',
      width: 'max-content',
      fontFamily: 'Arial, sans-serif',
      color: '#000',
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: '10px',
      borderBottom: '2px solid #000',
      paddingBottom: '5px',
    },
    table: { borderCollapse: 'collapse' as const, border: '1px solid #000' },
    th: {
      border: '1px solid #000',
      backgroundColor: '#f0f0f0',
      color: '#000',
      padding: '5px 10px',
      fontSize: '12px',
      fontWeight: 'bold',
      textAlign: 'center' as const,
    },
    td: {
      border: '1px solid #000',
      padding: '4px 10px',
      fontSize: '12px',
      color: '#000',
      textAlign: 'center' as const,
    },
    tdName: {
      border: '1px solid #000',
      padding: '4px 10px',
      fontSize: '12px',
      color: '#000',
      textAlign: 'left' as const,
      fontWeight: 'bold',
      whiteSpace: 'nowrap' as const,
    },
    totalCell: {
      border: '1px solid #000',
      padding: '4px 10px',
      fontSize: '12px',
      fontWeight: 'bold',
      backgroundColor: '#e6e6e6',
      textAlign: 'center' as const,
    },
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
          <div className="mt-8 pt-6 border-t flex justify-center">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans relative">
      {mostrandoRelatorio && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/95">
          <div ref={relatorioRef} style={styles.container}>
            <div style={styles.headerRow}>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                Relatório de Produção (NS)
              </h1>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                PROENG ENGENHARIA
              </span>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...styles.th,
                      textAlign: 'left',
                      minWidth: '150px',
                    }}
                  >
                    Topógrafos
                  </th>
                  {dadosRelatorioMatriz.colunas.map((c) => (
                    <th key={c.iso} style={styles.th}>
                      {c.formatado}
                    </th>
                  ))}
                  <th style={{ ...styles.th, backgroundColor: '#d0d0d0' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {dadosRelatorioMatriz.linhas.map((linha) => (
                  <tr key={linha.nome}>
                    <td style={styles.tdName}>{linha.nome}</td>
                    {dadosRelatorioMatriz.colunas.map((c) => (
                      <td key={c.iso} style={styles.td}>
                        {linha.dias[c.iso] > 0 ? linha.dias[c.iso] : ''}
                      </td>
                    ))}
                    <td style={styles.totalCell}>{linha.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <td style={{ ...styles.tdName, borderTop: '2px solid #000' }}>
                    Total Geral
                  </td>
                  {dadosRelatorioMatriz.colunas.map((c) => {
                    const totalDia = dadosRelatorioMatriz.linhas.reduce(
                      (acc: number, curr: any) => acc + curr.dias[c.iso],
                      0
                    );
                    return (
                      <td
                        key={c.iso}
                        style={{
                          ...styles.totalCell,
                          borderTop: '2px solid #000',
                        }}
                      >
                        {totalDia}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      ...styles.totalCell,
                      borderTop: '2px solid #000',
                      fontSize: '13px',
                      color: '#0000aa',
                    }}
                  >
                    {dadosRelatorioMatriz.linhas.reduce(
                      (acc: number, curr: any) => acc + curr.total,
                      0
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div
              style={{
                marginTop: '10px',
                fontSize: '10px',
                textAlign: 'right',
                color: '#666',
              }}
            >
              Gerado em {new Date().toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      )}

      {(processandoSalvar || processandoUpload) && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 size={48} className="text-white animate-spin mb-4" />
          <div className="text-white font-bold text-lg">
            {processandoUpload
              ? 'Gerando PDF Inicial...'
              : 'Gerando Imagem Final...'}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-auto min-h-[4.5rem] bg-white border-b flex items-start justify-between px-4 py-2 shrink-0 z-30 shadow-sm gap-4 transition-all">
        <div className="flex flex-col gap-2 shrink-0 border-r border-slate-100 pr-4">
          <div className="flex items-center gap-2 text-blue-900">
            <MapPin size={18} className="text-blue-700" />
            <h1 className="font-black text-sm tracking-tighter uppercase leading-none">
              ProEng
            </h1>
          </div>
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

        {etapa === 'desenho' ? (
          <div className="flex-1 flex flex-col gap-1.5 justify-center">
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
            <div className="flex flex-wrap gap-2 items-center">
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

              {/* AMBIENTAL E SERVIDÃO LADO A LADO */}
              <div className="flex ml-2 border-l pl-2 gap-3">
                {/* Ambiental */}
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Leaf size={8} /> Ambiental
                  </span>
                  <div className="flex gap-1 mt-0.5">
                    <button
                      onClick={() =>
                        setAmbiental((prev) => (prev === 'SIM' ? '' : 'SIM'))
                      }
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none transition-colors ${
                        ambiental === 'SIM'
                          ? 'bg-green-600 text-white border-green-600 shadow-sm'
                          : 'bg-white text-slate-300 border-slate-200 hover:border-green-300'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      onClick={() =>
                        setAmbiental((prev) => (prev === 'NÃO' ? '' : 'NÃO'))
                      }
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none transition-colors ${
                        ambiental === 'NÃO'
                          ? 'bg-red-500 text-white border-red-500 shadow-sm'
                          : 'bg-white text-slate-300 border-slate-200 hover:border-red-300'
                      }`}
                    >
                      NÃO
                    </button>
                  </div>
                </div>

                {/* Servidão (NOVO) */}
                <div className="flex flex-col items-center border-l pl-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <HardHat size={8} /> Servidão
                  </span>
                  <div className="flex gap-1 mt-0.5">
                    {['SST', 'SSC', 'SSTC'].map((sigla) => (
                      <button
                        key={sigla}
                        onClick={() =>
                          setServidao((prev) => (prev === sigla ? '' : sigla))
                        }
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none transition-colors ${
                          servidao === sigla
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-300 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {sigla}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1"></div>
        )}

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
              disabled={processandoSalvar}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Download size={12} /> Salvar (Unificado)
            </button>
          )}
        </div>
      </header>

      {/* CORPO PRINCIPAL */}
      <main className="flex-1 flex overflow-hidden">
        {etapa === 'upload' ? (
          <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto">
            <div className="lg:col-span-4 border-2 border-dashed border-slate-300 rounded-3xl bg-white flex flex-col items-center justify-center relative hover:bg-blue-50 transition-all group cursor-pointer shadow-sm">
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
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
                Carregue um ou vários croquis (IMG ou PDF)
              </p>
            </div>

            <div className="lg:col-span-8 bg-white rounded-3xl border flex flex-col overflow-hidden shadow-sm">
              <div className="p-3 border-b bg-slate-50 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-slate-500 flex gap-2 items-center">
                    <History size={14} /> Histórico
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={gerarImagemRelatorio}
                      className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors"
                    >
                      <BarChart3 size={14} /> Relatório 7 Dias
                    </button>
                    <button
                      onClick={exportarExcel}
                      className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded border border-emerald-100"
                    >
                      <FileSpreadsheet size={14} /> Baixar Excel
                    </button>
                  </div>
                </div>

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
                {historicoFiltrado.map((p) => {
                  const totalItens = p.paginas.reduce(
                    (acc, pg) => acc + pg.postes.length,
                    0
                  );
                  return (
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
                            {totalItens} itens
                          </span>
                          {p.topografo && (
                            <span className="text-[8px] font-bold bg-orange-100 text-orange-700 px-1 rounded uppercase">
                              {p.topografo}
                            </span>
                          )}
                          {p.ambiental === 'SIM' && (
                            <span className="text-[8px] font-bold bg-green-100 text-green-700 px-1 rounded uppercase flex items-center gap-0.5">
                              <Leaf size={8} /> AMB
                            </span>
                          )}
                          {p.servidao && (
                            <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-1 rounded uppercase flex items-center gap-0.5">
                              <HardHat size={8} /> {p.servidao}
                            </span>
                          )}
                          {p.usKm > 0 && (
                            <span className="text-[8px] font-bold bg-purple-100 text-purple-700 px-1 rounded uppercase flex items-center gap-0.5">
                              <Car size={8} /> KM
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
                            if (confirm('Deseja excluir?')) {
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
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 bg-slate-200 flex items-center justify-center relative overflow-hidden p-2">
              <div
                ref={containerRef}
                className="relative shadow-2xl bg-white border border-white flex items-center justify-center w-full h-full overflow-auto"
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={adicionarPoste}
                  onContextMenu={(e) => e.preventDefault()}
                  className="cursor-crosshair shadow-lg origin-top-left"
                />
              </div>

              <button
                onClick={() => setEtapa('upload')}
                className="absolute top-4 left-4 bg-white px-3 py-1 rounded shadow text-[10px] font-bold border hover:bg-slate-50"
              >
                ← VOLTAR
              </button>

              {/* CONTROLES DE ZOOM */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
                <div className="bg-white rounded-lg shadow border border-slate-200 p-1 flex flex-col gap-1">
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 0.2, 5.0))}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-600 border-y border-slate-100"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 0.2, 0.2))}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  >
                    <ZoomOut size={16} />
                  </button>
                </div>
                <div className="bg-black/50 text-white text-[9px] font-bold px-2 py-0.5 rounded text-center backdrop-blur">
                  {Math.round(zoom * 100)}%
                </div>
              </div>

              {paginas.length > 1 && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur border border-slate-200 shadow-xl rounded-full px-4 py-2 flex items-center gap-4 z-50">
                  <button
                    onClick={() =>
                      setPaginaAtual((curr) => Math.max(0, curr - 1))
                    }
                    disabled={paginaAtual === 0}
                    className="text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-xs font-black text-slate-700">
                    PÁGINA {paginaAtual + 1} / {paginas.length}
                  </span>
                  <button
                    onClick={() =>
                      setPaginaAtual((curr) =>
                        Math.min(paginas.length - 1, curr + 1)
                      )
                    }
                    disabled={paginaAtual === paginas.length - 1}
                    className="text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}

              <div className="absolute bottom-4 left-4 flex gap-3 bg-slate-800/90 text-white px-3 py-2 rounded-lg text-[9px] font-bold backdrop-blur-sm border border-white/10 shadow-xl pointer-events-none select-none z-50">
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
                {ambiental && (
                  <span
                    className={`text-[9px] font-bold mt-1 px-1 rounded w-fit ${
                      ambiental === 'SIM'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    AMBIENTAL: {ambiental}
                  </span>
                )}
                {servidao && (
                  <span className="text-[9px] font-bold mt-1 px-1 rounded w-fit bg-indigo-100 text-indigo-700">
                    SERVIDÃO: {servidao}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/20">
                <div className="text-[9px] text-center text-slate-400 font-bold mb-2">
                  Itens desta página:
                </div>
                {paginas[paginaAtual]?.postes.map((p, i) => (
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
                        const novasPaginas = [...paginas];
                        novasPaginas[paginaAtual].postes.splice(i, 1);
                        setPaginas(novasPaginas);
                      }}
                      className="text-slate-200 hover:text-red-500"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>

              {/* ÁREA DE COBRANÇA */}
              <div className="p-3 bg-slate-100 border-t border-b">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Car size={10} /> Adicionar Cobrança KM (US)
                  </span>
                  <input
                    type="text"
                    value={usKmInput}
                    onChange={(e) =>
                      setUsKmInput(e.target.value.replace(/[^0-9,.]/g, ''))
                    }
                    placeholder="0,00"
                    className="text-xs p-1 rounded border border-slate-300 font-mono text-right"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                    Total Geral
                  </span>
                  <span className="text-lg font-black text-emerald-400 leading-none">
                    US {statsTotal.total.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                  <div className="bg-white/10 rounded py-1 border border-white/5">
                    <div className="text-[7px] text-slate-400 mb-0.5">PROJ</div>
                    {statsTotal.p}
                  </div>
                  <div className="bg-white/10 rounded py-1 border border-white/5">
                    <div className="text-[7px] text-slate-400 mb-0.5">
                      EXIST
                    </div>
                    {statsTotal.e}
                  </div>
                  <div className="bg-white/10 rounded py-1 border border-white/5">
                    <div className="text-[7px] text-slate-400 mb-0.5">
                      RURAL
                    </div>
                    {statsTotal.r}
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
