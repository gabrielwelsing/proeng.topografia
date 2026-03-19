'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
import proj4 from 'proj4';
import { createWorker } from 'tesseract.js';
import {
    FileUp, MapPin, Trash2, Download, ChevronLeft, ChevronRight,
    MousePointer2, Hash, CheckCircle2, XCircle, Crop, Type,
    Loader2, ZoomIn, ZoomOut, FilePlus, PlusSquare, Globe, ArrowLeft
} from 'lucide-react';

const WGS84 = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";

type AppMode = 'pre_projeto' | 'ambiental' | 'impedimentos';
type SidebarMode = 'empty' | 'ns_input' | 'list' | 'point_edit';
type SelectionMode = 'text' | 'ocr';

interface ApprovedPoint {
    id: string;
    title: string;
    utmE: string;
    utmN: string;
    lat: number;
    lon: number;
    zone: string;
    fromFile: string;
    isDivisa: boolean;
}

export default function EarthPage() {
    const { user, roles, loading } = useAuth();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    // --- MODO DO APP ---
    const [appMode, setAppMode] = useState<AppMode | null>(null);

    // --- ESTADOS ---
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('empty');
    const [selectionMode, setSelectionMode] = useState<SelectionMode>('text');
    const [nsNumber, setNsNumber] = useState('');

    // PDF & Canvas
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [isLoading, setIsLoading] = useState(false);
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);

    // Seleção OCR
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    // Dados
    const [approvedPoints, setApprovedPoints] = useState<ApprovedPoint[]>([]);
    const [utmZone, setUtmZone] = useState('23');
    const [hemisphere] = useState('S');
    const [tempPoint, setTempPoint] = useState({ e: '', n: '', title: '', isDivisa: false });

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
            } catch (error) {
                console.error(error);
            }
        }
    }, []);

    // --- AUTH REDIRECT ---
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    // --- UPLOAD ---
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);

        if (appMode === 'pre_projeto') {
            if (!nsNumber) {
                setNsNumber('');
                setSidebarMode('ns_input');
            } else {
                setSidebarMode('list');
            }
        } else {
            setSidebarMode('list');
        }

        setPdfFile(file);
        setSelectionMode('text');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadedPdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            setPdfDoc(loadedPdf);
            setTotalPages(loadedPdf.numPages);
            setPageNum(1);
            setIsLoading(false);
        } catch (err) {
            console.error(err);
            alert("Erro ao abrir PDF.");
            setIsLoading(false);
        }
    };

    // --- RENDERIZAÇÃO ---
    useEffect(() => {
        if (!pdfDoc) return;
        renderPage(pageNum);
    }, [pdfDoc, pageNum, scale]);

    const renderPage = async (num: number) => {
        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas?.getContext('2d');

            if (canvas && context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport }).promise;
            }

            const textLayerDiv = textLayerRef.current;
            if (textLayerDiv) {
                textLayerDiv.innerHTML = '';
                textLayerDiv.style.height = `${viewport.height}px`;
                textLayerDiv.style.width = `${viewport.width}px`;
                textLayerDiv.style.setProperty('--scale-factor', String(scale));

                const textContent = await page.getTextContent();
                pdfjsLib.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerDiv,
                    viewport: viewport,
                    textDivs: []
                });
            }
        } catch (err) { console.error(err); }
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

    // --- PROCESSAMENTO ---
    const processExtractedText = (text: string) => {
        if (!text) return;
        const cleanText = text.replace(/[^\d:.\-\s]/g, ' ');

        if (sidebarMode === 'ns_input') {
            const digitsOnly = cleanText.replace(/\D/g, '');
            const nsMatch = digitsOnly.match(/(\d{8,})/);
            if (nsMatch) setNsNumber(nsMatch[0]);
            return;
        }

        const regex = /(\d{6}[.,]?\d{0,3})[\D]{0,15}(\d{7}[.,]?\d{0,3})/;
        const match = regex.exec(cleanText);

        if (match) {
            const eVal = match[1].replace(',', '.');
            const nVal = match[2].replace(',', '.');
            setTempPoint({ e: eVal, n: nVal, title: '', isDivisa: false });
            setSidebarMode('point_edit');
        } else if (selectionMode === 'ocr') {
            alert("Números não identificados.");
        }
    };

    const handleTextLayerMouseUp = () => {
        if (selectionMode !== 'text') return;
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text) {
            processExtractedText(text);
            selection?.removeAllRanges();
        }
    };

    // --- OCR ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (selectionMode !== 'ocr') return;
        const rect = canvasWrapperRef.current?.getBoundingClientRect();
        if (!rect) return;

        setIsDrawing(true);
        setStartPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setCurrentRect(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || selectionMode !== 'ocr') return;
        const rect = canvasWrapperRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - startPos.x;
        const height = currentY - startPos.y;

        setCurrentRect({
            x: width > 0 ? startPos.x : currentX,
            y: height > 0 ? startPos.y : currentY,
            w: Math.abs(width),
            h: Math.abs(height)
        });
    };

    const handleMouseUp = async () => {
        if (!isDrawing || !currentRect || selectionMode !== 'ocr') { setIsDrawing(false); return; }
        setIsDrawing(false);
        if (currentRect.w < 5 || currentRect.h < 5) { setCurrentRect(null); return; }

        setIsOcrProcessing(true);
        try {
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("Canvas erro");

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = currentRect.w;
            tempCanvas.height = currentRect.h;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.drawImage(
                    canvas,
                    currentRect.x, currentRect.y, currentRect.w, currentRect.h,
                    0, 0, currentRect.w, currentRect.h
                );

                const imageBlob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve));
                if (!imageBlob) throw new Error("Imagem erro");

                const worker = await createWorker('eng');
                const ret = await worker.recognize(imageBlob);
                await worker.terminate();
                processExtractedText(ret.data.text);
            }
        } catch (err) { alert("Erro no OCR."); }
        finally { setIsOcrProcessing(false); setCurrentRect(null); }
    };

    // --- AÇÕES ---
    const savePoint = () => {
        try {
            const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere === 'S' ? 'south' : 'north'} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
            const x = parseFloat(tempPoint.e);
            const y = parseFloat(tempPoint.n);
            if (isNaN(x) || isNaN(y)) throw new Error("Coordenadas inválidas");
            const [lon, lat] = proj4(utmProj, WGS84, [x, y]);

            let finalTitle: string;
            if (appMode === 'ambiental' || appMode === 'impedimentos') {
                finalTitle = `${utmZone} k ${tempPoint.e}:${tempPoint.n}`;
            } else {
                finalTitle = `${tempPoint.title} - ${tempPoint.e}:${tempPoint.n} - NS: ${nsNumber}`;
            }

            setApprovedPoints([...approvedPoints, {
                id: Date.now().toString(),
                title: finalTitle,
                utmE: tempPoint.e,
                utmN: tempPoint.n,
                lat, lon,
                zone: `${utmZone}${hemisphere}`,
                fromFile: pdfFile?.name || 'Manual',
                isDivisa: tempPoint.isDivisa
            }]);
            setSidebarMode('list');
        } catch (error) { alert("Erro Conversão"); }
    };

    const confirmNS = () => { if (nsNumber.length < 3) { alert("NS Inválida"); return; } setSidebarMode('list'); };

    const handleManualAdd = () => {
        setTempPoint({ e: '', n: '', title: '', isDivisa: false });
        setSidebarMode('point_edit');
    };

    const exportKML = () => {
        const docName = appMode === 'ambiental'
            ? `Levantamento Ambiental`
            : appMode === 'impedimentos'
                ? `Levantamento Impedimentos`
                : `Levantamento NS ${nsNumber}`;

        const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${docName}</name>`;

        const kmlBody = approvedPoints.map((p, index) => {
            let iconUrl: string;

            if (appMode === 'ambiental' || appMode === 'impedimentos') {
                if (p.isDivisa) {
                    iconUrl = 'http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png';
                } else {
                    iconUrl = 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png';
                }
            } else {
                let iconNumber = index + 1;
                if (iconNumber <= 10) {
                    iconUrl = `http://maps.google.com/mapfiles/kml/paddle/${iconNumber}.png`;
                } else {
                    iconUrl = `http://maps.google.com/mapfiles/kml/paddle/wht-blank.png`;
                }
            }

            const description = (appMode === 'ambiental' || appMode === 'impedimentos')
                ? `E:${p.utmE} N:${p.utmN}${p.isDivisa ? ' | DIVISA' : ''}`
                : `NS: ${nsNumber} | E:${p.utmE} N:${p.utmN}`;

            return `<Placemark>
            <name>${p.title}</name>
            <description>${description}</description>
            <Style>
                <IconStyle>
                    <scale>1.1</scale>
                    <Icon>
                        <href>${iconUrl}</href>
                    </Icon>
                </IconStyle>
            </Style>
            <Point>
                <coordinates>${p.lon},${p.lat},0</coordinates>
            </Point>
        </Placemark>`;
        }).join('');

        // Ambiental: add a red LineString (path) connecting all points
        let kmlPath = '';
        if (appMode === 'ambiental' && approvedPoints.length >= 2) {
            const coordinates = approvedPoints.map(p => `${p.lon},${p.lat},0`).join('\n            ');
            kmlPath = `<Placemark>
            <name>Caminho Ambiental</name>
            <description>Caminho conectando os pontos do levantamento ambiental</description>
            <Style>
                <LineStyle>
                    <color>ff0000ff</color>
                    <width>3</width>
                </LineStyle>
            </Style>
            <LineString>
                <tessellate>1</tessellate>
                <coordinates>
            ${coordinates}
                </coordinates>
            </LineString>
        </Placemark>`;
        }

        const blob = new Blob([kmlHeader + kmlBody + kmlPath + `</Document></kml>`], { type: 'application/vnd.google-earth.kml+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = appMode === 'ambiental'
            ? `Ambiental_${new Date().toISOString().split('T')[0]}.kml`
            : appMode === 'impedimentos'
                ? `Impedimentos_${new Date().toISOString().split('T')[0]}.kml`
                : `NS_${nsNumber}.kml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleModeSelect = (mode: AppMode) => {
        setAppMode(mode);
        setSidebarMode('empty');
        setNsNumber('');
        setPdfFile(null);
        setPdfDoc(null);
        setApprovedPoints([]);
        setTempPoint({ e: '', n: '', title: '', isDivisa: false });
    };

    const handleChangeMode = () => {
        setAppMode(null);
        setSidebarMode('empty');
        setNsNumber('');
        setPdfFile(null);
        setPdfDoc(null);
        setApprovedPoints([]);
        setPageNum(1);
        setTotalPages(0);
        setTempPoint({ e: '', n: '', title: '', isDivisa: false });
    };

    const handleNewProcess = () => {
        if (approvedPoints.length > 0 || pdfDoc) {
            if (!confirm("Deseja realmente iniciar um novo processo? Isso limpará todos os pontos e o documento atual.")) {
                return;
            }
        }
        setPdfFile(null);
        setPdfDoc(null);
        setApprovedPoints([]);
        setNsNumber('');
        setSidebarMode('empty');
        setPageNum(1);
        setTotalPages(0);
        setTempPoint({ e: '', n: '', title: '', isDivisa: false });
    };

    // --- LOADING & AUTH GUARDS ---
    if (!isMounted || loading) return null;

    if (!user) return null;

    if (roles && !roles.admin && !roles.earth && !roles.pre_projeto && !roles.ambiental && !roles.topografia) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
                <div className="bg-white p-12 rounded-3xl shadow-2xl max-w-md border border-amber-100">
                    <Globe size={40} className="mx-auto mb-6 text-amber-500" />
                    <h2 className="text-2xl font-black text-slate-800">Acesso Restrito</h2>
                    <p className="text-slate-500 text-sm mt-3">Você não tem permissão para acessar este módulo.</p>
                    <button onClick={() => router.push('/hub')} className="mt-8 text-sm text-blue-600 underline font-bold">Voltar ao Hub</button>
                </div>
            </div>
        );
    }

    // ========================
    // POPUP DE SELEÇÃO DE MODO
    // ========================
    if (appMode === null) {
        const canAccessPre = roles?.admin || roles?.earth || roles?.pre_projeto || roles?.topografia;
        const canAccessAmb = roles?.admin || roles?.earth || roles?.ambiental;

        return (
            <div className="flex items-center justify-center h-screen w-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 font-sans">
                <div className="text-center">
                    {/* Back to Hub */}
                    <button
                        onClick={() => router.push('/hub')}
                        className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold"
                    >
                        <ArrowLeft size={18} /> Voltar ao Hub
                    </button>

                    {/* Logo */}
                    <div className="mb-10">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <Globe size={40} className="text-blue-400" />
                            <h1 className="text-4xl font-black text-white tracking-tight">Integração Earth</h1>
                        </div>
                        <p className="text-slate-400 text-sm">Selecione o modo de operação</p>
                        {(!canAccessPre || !canAccessAmb) && !roles?.admin && (
                            <p className="text-amber-400 text-[10px] mt-2 font-bold uppercase tracking-widest">Acesso parcial habilitado pelo administrador</p>
                        )}
                    </div>

                    {/* Cards de Seleção */}
                    <div className="flex gap-6">
                        {/* PRÉ PROJETO */}
                        <button
                            onClick={() => canAccessPre && handleModeSelect('pre_projeto')}
                            disabled={!canAccessPre}
                            className={`group border rounded-2xl p-8 w-64 text-left transition-all duration-300 ${canAccessPre
                                ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-blue-500/50 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10'
                                : 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed filter grayscale'
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${canAccessPre ? 'bg-blue-600/20 group-hover:bg-blue-600/30' : 'bg-slate-800'}`}>
                                <MapPin size={28} className={canAccessPre ? "text-blue-400" : "text-slate-600"} />
                            </div>
                            <h2 className={`text-xl font-bold mb-2 ${canAccessPre ? 'text-white' : 'text-slate-500'}`}>Pré Projeto</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Extração de coordenadas com identificação por NS. Ícones numerados no Google Earth.
                            </p>
                            {!canAccessPre && <p className="mt-4 text-[10px] font-bold text-red-400 uppercase tracking-tighter">Sem permissão</p>}
                        </button>

                        {/* AMBIENTAL */}
                        <button
                            onClick={() => canAccessAmb && handleModeSelect('ambiental')}
                            disabled={!canAccessAmb}
                            className={`group border rounded-2xl p-8 w-64 text-left transition-all duration-300 ${canAccessAmb
                                ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-emerald-500/50 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/10'
                                : 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed filter grayscale'
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${canAccessAmb ? 'bg-emerald-600/20 group-hover:bg-emerald-600/30' : 'bg-slate-800'}`}>
                                <Globe size={28} className={canAccessAmb ? "text-emerald-400" : "text-slate-600"} />
                            </div>
                            <h2 className={`text-xl font-bold mb-2 ${canAccessAmb ? 'text-white' : 'text-slate-500'}`}>Ambiental</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Levantamento ambiental simplificado. Quadrante e coordenada, com suporte a divisas.
                            </p>
                            {!canAccessAmb && <p className="mt-4 text-[10px] font-bold text-red-400 uppercase tracking-tighter">Sem permissão</p>}
                        </button>

                        {/* IMPEDIMENTOS */}
                        <button
                            onClick={() => canAccessAmb && handleModeSelect('impedimentos')}
                            disabled={!canAccessAmb}
                            className={`group border rounded-2xl p-8 w-64 text-left transition-all duration-300 ${canAccessAmb
                                ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-amber-500/50 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10'
                                : 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed filter grayscale'
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${canAccessAmb ? 'bg-amber-600/20 group-hover:bg-amber-600/30' : 'bg-slate-800'}`}>
                                <MapPin size={28} className={canAccessAmb ? "text-amber-400" : "text-slate-600"} />
                            </div>
                            <h2 className={`text-xl font-bold mb-2 ${canAccessAmb ? 'text-white' : 'text-slate-500'}`}>Impedimentos</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Igual ao ambiental, sem a linha de caminho no KML. Pontos individuais apenas.
                            </p>
                            {!canAccessAmb && <p className="mt-4 text-[10px] font-bold text-red-400 uppercase tracking-tighter">Sem permissão</p>}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ========================
    // APP PRINCIPAL
    // ========================
    const modeLabel = appMode === 'ambiental' ? 'Ambiental' : appMode === 'impedimentos' ? 'Impedimentos' : 'Pré Projeto';

    return (
        <div className="flex flex-col h-screen w-screen bg-gray-800 font-sans overflow-hidden">

            {/* HEADER */}
            <header className="flex-none bg-slate-900 text-white p-3 flex justify-between items-center shadow-md z-30 h-16 border-b border-slate-700">

                <div className="flex items-center gap-4">
                    {/* Botão Trocar Modo */}
                    <button onClick={handleChangeMode} className="text-slate-400 hover:text-white transition-colors p-1" title="Trocar Modo">
                        <ArrowLeft size={20} />
                    </button>

                    <h1 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                        <Globe size={22} /> Integração Earth
                    </h1>

                    {/* Badge do modo */}
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider ${appMode === 'ambiental'
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                        : appMode === 'impedimentos'
                            ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                            : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                        }`}>
                        {modeLabel}
                    </span>

                    <button
                        onClick={handleNewProcess}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded border border-slate-500 text-xs font-bold transition-all shadow-sm active:scale-95 ml-2"
                        title="Iniciar Novo Processo"
                    >
                        <PlusSquare size={14} /> Novo
                    </button>

                    {pdfDoc && (
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                            <button onClick={() => setSelectionMode('text')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${selectionMode === 'text' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                                <Type size={14} /> Texto
                            </button>
                            <button onClick={() => setSelectionMode('ocr')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${selectionMode === 'ocr' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                                <Crop size={14} /> Área (OCR)
                            </button>
                        </div>
                    )}
                </div>

                {/* Adicionar PDF Extra */}
                {pdfDoc && (
                    <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded border border-slate-500 flex items-center gap-2 text-sm transition-colors">
                        <FilePlus size={16} /> Abrir Outro PDF
                        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                    </label>
                )}

                {/* Controles */}
                {pdfDoc && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-full border border-slate-600">
                            <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="hover:text-blue-400 disabled:opacity-30"><ChevronLeft size={18} /></button>
                            <span className="font-mono text-xs w-10 text-center">{pageNum}/{totalPages}</span>
                            <button onClick={() => setPageNum(p => Math.min(totalPages, p + 1))} disabled={pageNum >= totalPages} className="hover:text-blue-400 disabled:opacity-30"><ChevronRight size={18} /></button>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600">
                            <button onClick={handleZoomOut} className="hover:text-blue-400 p-1"><ZoomOut size={16} /></button>
                            <span className="text-xs w-8 text-center">{Math.round(scale * 100)}%</span>
                            <button onClick={handleZoomIn} className="hover:text-blue-400 p-1"><ZoomIn size={16} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                            {appMode === 'pre_projeto' && nsNumber && <span className="text-xs bg-blue-900 px-2 py-1 rounded border border-blue-700 font-mono">NS:{nsNumber}</span>}
                            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600">
                                <span className="text-xs text-gray-400">Z:</span>
                                <input value={utmZone} onChange={(e) => setUtmZone(e.target.value)} className="w-6 bg-transparent text-center text-xs outline-none text-white" />
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* BODY */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* COLUNA ESQUERDA: PDF VIEWER */}
                <div
                    className="flex-1 bg-gray-700 overflow-auto relative flex justify-center p-4"
                    onContextMenu={(e) => {
                        if (sidebarMode === 'point_edit') {
                            e.preventDefault();
                            savePoint();
                        }
                    }}
                >

                    {isOcrProcessing && (
                        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm cursor-wait fixed">
                            <div className="bg-white p-4 rounded shadow-xl flex items-center gap-3"><Loader2 className="animate-spin text-purple-600" /> Processando Imagem...</div>
                        </div>
                    )}

                    {/* BOTÃO CENTRAL DE UPLOAD */}
                    {!pdfDoc && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <label className={`${(appMode === 'ambiental' || appMode === 'impedimentos') ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'} text-white px-8 py-4 rounded-xl shadow-xl cursor-pointer flex gap-3 items-center text-lg font-bold transition-transform hover:scale-105`}>
                                <FileUp size={24} /> Abrir PDF
                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                            <p className="mt-4 text-sm opacity-50">
                                {(appMode === 'ambiental' || appMode === 'impedimentos')
                                    ? 'Selecione o arquivo do levantamento'
                                    : 'Selecione o arquivo da Nota de Serviço'
                                }
                            </p>
                        </div>
                    )}

                    {pdfDoc && (
                        <div
                            ref={canvasWrapperRef}
                            className={`relative shadow-2xl transition-all origin-top ${selectionMode === 'ocr' ? 'cursor-crosshair' : ''}`}
                            style={{ height: 'fit-content' }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                        >
                            <canvas ref={canvasRef} className="block pointer-events-none bg-white" />
                            <div ref={textLayerRef} className="absolute inset-0 textLayer" style={{ pointerEvents: selectionMode === 'text' ? 'auto' : 'none' }} onMouseUp={handleTextLayerMouseUp}></div>
                            {currentRect && selectionMode === 'ocr' && (
                                <div className="absolute border-2 border-purple-500 bg-purple-500/20 z-40"
                                    style={{ left: currentRect.x, top: currentRect.y, width: currentRect.w, height: currentRect.h, pointerEvents: 'none' }}
                                ></div>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUNA DIREITA: SIDEBAR */}
                <div className="w-[400px] bg-white shadow-xl z-20 flex flex-col border-l border-gray-300">

                    {/* NS INPUT (apenas Pré Projeto) */}
                    {sidebarMode === 'ns_input' && appMode === 'pre_projeto' && (
                        <div className="flex-1 p-6 flex flex-col justify-center bg-blue-50">
                            <div className="text-center mb-6">
                                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><Hash size={32} /></div>
                                <h2 className="text-xl font-bold text-gray-800">Identificação NS</h2>
                                <p className="text-sm text-gray-600 mt-2">Digite, selecione texto ou use o OCR.</p>
                            </div>
                            <div className="bg-white p-4 rounded shadow-sm border border-blue-200">
                                <input value={nsNumber} onChange={(e) => setNsNumber(e.target.value)} placeholder="NS..." className="w-full text-lg border-b-2 border-blue-300 focus:border-blue-600 outline-none py-2 font-mono text-center text-black" autoFocus />
                            </div>
                            <button onClick={confirmNS} disabled={nsNumber.length < 3} className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded font-bold shadow flex justify-center items-center gap-2">Confirmar <ChevronRight size={18} /></button>
                        </div>
                    )}

                    {/* LISTA DE PONTOS */}
                    {sidebarMode === 'list' && (
                        <>
                            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                <h2 className="font-bold text-gray-700 flex items-center gap-2"><MousePointer2 size={16} /> Pontos</h2>
                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600">{approvedPoints.length}</span>
                            </div>

                            {/* BOTÃO ADICIONAR MANUAL */}
                            <div className="px-4 pt-3">
                                <button onClick={handleManualAdd} className={`w-full border text-sm py-2 rounded font-semibold flex justify-center gap-2 items-center transition-colors ${(appMode === 'ambiental' || appMode === 'impedimentos')
                                    ? 'bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                                    : 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50'
                                    }`}>
                                    <PlusSquare size={16} /> Adicionar Manualmente
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                                {approvedPoints.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-20"><Crop size={48} className="opacity-20 mx-auto mb-2" /><p>Lista Vazia</p></div>
                                ) : (
                                    approvedPoints.map((p, idx) => (
                                        <div key={idx} className={`bg-white border rounded p-3 shadow-sm flex gap-3 items-center group ${p.isDivisa ? 'border-orange-300 hover:border-orange-400' : 'border-gray-200 hover:border-blue-300'}`}>
                                            <div className={`${p.isDivisa ? 'bg-orange-500' : ((appMode === 'ambiental' || appMode === 'impedimentos') ? 'bg-emerald-500' : 'bg-orange-500')} text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-none`}>
                                                {p.isDivisa ? 'D' : idx + 1}
                                            </div>
                                            <div className="overflow-hidden flex-1">
                                                <div className="font-bold text-sm text-gray-800 truncate">{p.title}</div>
                                                <div className="text-xs text-gray-500 mt-1 font-mono font-semibold">
                                                    E: {p.utmE} N: {p.utmN}
                                                    {p.isDivisa && <span className="ml-2 text-orange-600 font-bold">DIVISA</span>}
                                                </div>
                                            </div>
                                            <button onClick={() => setApprovedPoints(prev => prev.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-4 border-t bg-white">
                                <button onClick={exportKML} disabled={approvedPoints.length === 0} className={`w-full ${(appMode === 'ambiental' || appMode === 'impedimentos') ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-300 text-white py-3 rounded font-bold shadow flex justify-center gap-2`}>
                                    <Download size={20} /> Baixar KML
                                </button>
                            </div>
                        </>
                    )}

                    {/* EDIÇÃO DE PONTO */}
                    {sidebarMode === 'point_edit' && (
                        <div className="flex-1 flex flex-col bg-white">
                            <div className={`${(appMode === 'ambiental' || appMode === 'impedimentos') ? 'bg-emerald-600' : 'bg-blue-600'} text-white p-4 shadow`}>
                                <h3 className="font-bold text-lg">Ponto #{approvedPoints.length + 1}</h3>
                                <p className="text-xs opacity-80">
                                    {(appMode === 'ambiental' || appMode === 'impedimentos') ? 'Edite os dados do ponto' : 'Edite os dados'}
                                </p>
                            </div>
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto">

                                {/* Nome/Título — apenas no Pré Projeto */}
                                {appMode === 'pre_projeto' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome</label>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            {['INICIO CONSTRUCAO CABO', 'FINAL CONSTRUCAO CABO', 'INICIO CONVERSAO CABO', 'FINAL CONVERSAO CABO'].map((text) => (
                                                <button
                                                    key={text}
                                                    type="button"
                                                    onClick={() => setTempPoint({ ...tempPoint, title: text })}
                                                    className={`text-[11px] font-bold py-2 px-2 rounded border transition-all ${tempPoint.title === text
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:border-blue-400'
                                                        }`}
                                                >
                                                    {text}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea value={tempPoint.title} onChange={(e) => setTempPoint({ ...tempPoint, title: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); savePoint(); } }} placeholder="Descrição personalizada..." className="w-full border-2 border-blue-100 p-3 rounded focus:border-blue-500 outline-none h-16 text-black font-medium text-sm" />
                                    </div>
                                )}

                                {/* Coordenadas */}
                                <div className="bg-gray-100 rounded p-4 border border-gray-200 grid grid-cols-2 gap-4">
                                    <div><span className="text-xs font-bold text-gray-500 block uppercase mb-1">Easting (X)</span><input value={tempPoint.e} onChange={(e) => setTempPoint({ ...tempPoint, e: e.target.value })} className="w-full font-mono font-bold text-black bg-white border border-gray-300 rounded p-2 focus:border-blue-500 outline-none" /></div>
                                    <div><span className="text-xs font-bold text-gray-500 block uppercase mb-1">Northing (Y)</span><input value={tempPoint.n} onChange={(e) => setTempPoint({ ...tempPoint, n: e.target.value })} className="w-full font-mono font-bold text-black bg-white border border-gray-300 rounded p-2 focus:border-blue-500 outline-none" /></div>
                                </div>

                                {/* BOTÃO DIVISA — apenas no modo Ambiental */}
                                {(appMode === 'ambiental' || appMode === 'impedimentos') && (
                                    <div>
                                        <button
                                            onClick={() => setTempPoint({ ...tempPoint, isDivisa: !tempPoint.isDivisa })}
                                            className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 ${tempPoint.isDivisa
                                                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                                                : 'bg-white border-orange-300 text-orange-600 hover:bg-orange-50'
                                                }`}
                                        >
                                            <MapPin size={18} />
                                            {tempPoint.isDivisa ? '✓ DIVISA ATIVA' : 'Marcar como Divisa'}
                                        </button>
                                        <p className="text-[10px] text-gray-400 text-center mt-2">
                                            {tempPoint.isDivisa
                                                ? 'Pino será: shaded_dot (divisória)'
                                                : 'Pino será: placemark_circle (padrão ambiental)'
                                            }
                                        </p>
                                    </div>
                                )}

                                {/* Preview do título */}
                                <div className="text-xs text-center text-gray-400 bg-gray-50 p-3 rounded border border-gray-200">
                                    <span className="font-bold text-gray-500 block mb-1">Prévia do ponto:</span>
                                    {(appMode === 'ambiental' || appMode === 'impedimentos')
                                        ? <span className="font-mono text-emerald-600 font-bold">{utmZone} k {tempPoint.e || '---'}:{tempPoint.n || '---'}</span>
                                        : <span className="font-mono text-blue-600">{tempPoint.title || '---'} - {tempPoint.e || '---'}:{tempPoint.n || '---'} - NS: {nsNumber}</span>
                                    }
                                </div>
                            </div>
                            <div className="p-4 border-t bg-gray-50 flex gap-3">
                                <button onClick={() => setSidebarMode('list')} className="flex-1 py-3 text-gray-600 hover:bg-gray-200 rounded font-medium flex items-center justify-center gap-2"><XCircle size={20} /> Voltar</button>
                                <button onClick={savePoint} className={`flex-1 py-3 ${(appMode === 'ambiental' || appMode === 'impedimentos') ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded font-bold shadow flex justify-center gap-2`}><CheckCircle2 size={20} /> Salvar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        .textLayer { position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; opacity: 0.2; line-height: 1.0; }
        .textLayer ::selection { background: rgba(0, 100, 255, 0.6); color: transparent; }
        .textLayer span { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
      `}
            </style>
        </div>
    );
}
