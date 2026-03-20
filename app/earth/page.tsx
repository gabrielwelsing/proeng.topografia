'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/app/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
import proj4 from 'proj4';
import { createWorker } from 'tesseract.js';
import dynamic from 'next/dynamic';
import {
    FileUp, MapPin, Trash2, Download, ChevronLeft, ChevronRight,
    MousePointer2, Hash, CheckCircle2, XCircle, Crop, Type,
    Loader2, ZoomIn, ZoomOut, FilePlus, PlusSquare, Globe, ArrowLeft, Eye, Map as MapIcon,
    Zap, Sparkles, Edit2
} from 'lucide-react';

const MapPreview = dynamic(() => import('./MapPreview'), { ssr: false });

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
    pdfPage?: number;
    pdfX?: number;
    pdfY?: number;
    pointNumber?: number;
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
    const [tempPoint, setTempPoint] = useState<{e: string, n: string, title: string, isDivisa: boolean, pointNumber: number}>({ e: '', n: '', title: '', isDivisa: false, pointNumber: 1 });
    const [isConferencia, setIsConferencia] = useState(false);
    const [showMap, setShowMap] = useState(true);
    const [isAutoExtracting, setIsAutoExtracting] = useState(false);
    const [highlightRect, setHighlightRect] = useState<{x: number, y: number, w: number, h: number, page: number} | null>(null);
    const [editPointIndex, setEditPointIndex] = useState<number | null>(null);

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

        // All modes require NS — show NS input if not yet provided
        if (!nsNumber) {
            setNsNumber('');
            setSidebarMode('ns_input');
        } else {
            setSidebarMode('list');
        }

        setPdfFile(file);
        setSelectionMode('text');

        // Check if file is a Word document (conferência mode)
        const isWordFile = file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');

        if (isWordFile) {
            // Word files can't be rendered as PDF — go straight to manual entry mode
            setIsLoading(false);
            setSidebarMode('list');
            return;
        }

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
            const nsMatch = digitsOnly.match(/(\d{10})/);
            if (nsMatch) setNsNumber(nsMatch[0]);
            return;
        }

        const regex = /(\d{6}[.,]?\d{0,3})[\D]{0,15}(\d{7}[.,]?\d{0,3})/;
        const match = regex.exec(cleanText);

        if (match) {
            const eVal = match[1].replace(',', '.');
            const nVal = match[2].replace(',', '.');
            const nextNum = approvedPoints.length > 0 ? Math.max(...approvedPoints.map(p => p.pointNumber || 0)) + 1 : 1;
            setTempPoint({ e: eVal, n: nVal, title: '', isDivisa: false, pointNumber: nextNum });
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

    // --- FIREBASE SYNC ---
    const syncPointsToFirebase = async (pointsToSync: ApprovedPoint[], currentZone: string) => {
        if (!nsNumber || nsNumber.length !== 10) return;
        try {
            const pointsData = pointsToSync.map((p, i) => ({
                id: p.id,
                title: p.title,
                utmE: p.utmE,
                utmN: p.utmN,
                lat: p.lat,
                lon: p.lon,
                zone: p.zone,
                fromFile: p.fromFile,
                isDivisa: p.isDivisa,
                pointNumber: p.pointNumber || (i + 1),
                originMode: appMode || 'unknown',
                pdfPage: p.pdfPage || null,
                pdfX: p.pdfX || null,
                pdfY: p.pdfY || null,
            }));
            await setDoc(doc(db, 'earth_levantamentos', nsNumber), {
                nsNumber,
                utmZone: currentZone,
                lastUpdated: new Date().toISOString(),
                lastMode: appMode,
                points: pointsData
            }, { merge: true });
        } catch (err) {
            console.error('Erro ao sincronizar com Firebase:', err);
        }
    };

    // --- AÇÕES ---
    const savePoint = () => {
        try {
            const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere === 'S' ? 'south' : 'north'} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
            const x = parseFloat(tempPoint.e);
            const y = parseFloat(tempPoint.n);
            if (isNaN(x) || isNaN(y)) throw new Error("Coordenadas inválidas");
            const [lon, lat] = proj4(utmProj, WGS84, [x, y]);

            const pNum = tempPoint.pointNumber || 1;
            let finalTitle = tempPoint.title;
            
            if (appMode === 'ambiental' || appMode === 'impedimentos') {
                finalTitle = `P${pNum} ${utmZone}k ${tempPoint.e}:${tempPoint.n}`;
            } else {
                finalTitle = `${tempPoint.title} - ${tempPoint.e}:${tempPoint.n} - NS: ${nsNumber}`;
            }

            const pointData = {
                title: finalTitle,
                utmE: tempPoint.e,
                utmN: tempPoint.n,
                lat, lon,
                zone: `${utmZone}${hemisphere}`,
                fromFile: pdfFile?.name || 'Manual',
                isDivisa: tempPoint.isDivisa,
                pointNumber: pNum
            };

            let updatedPoints;
            if (editPointIndex !== null) {
                // UPDATE EXISITNG POINT
                updatedPoints = [...approvedPoints];
                updatedPoints[editPointIndex] = {
                    ...updatedPoints[editPointIndex],
                    ...pointData
                };
            } else {
                // ADD NEW POINT
                const newPoint: ApprovedPoint = {
                    id: Date.now().toString(),
                    ...pointData
                };
                updatedPoints = [...approvedPoints, newPoint];
            }

            // Order by pointNumber
            updatedPoints.sort((a, b) => (a.pointNumber || 0) - (b.pointNumber || 0));

            setApprovedPoints(updatedPoints);
            setSidebarMode('list');
            setEditPointIndex(null);

            // Sync to Firebase in background
            syncPointsToFirebase(updatedPoints, utmZone);
        } catch (error) { alert("Erro Conversão"); }
    };

    const handleDeletePoint = (indexToDelete: number) => {
        let updatedPoints = [...approvedPoints];
        updatedPoints.splice(indexToDelete, 1);

        if (updatedPoints.length > 0 && indexToDelete <= updatedPoints.length - 1) {
            const confirmResequence = window.confirm("Deseja renumerar os pontos seguintes e remover a lacuna da contagem (manter sequência contínua)?");
            if (confirmResequence) {
                updatedPoints = updatedPoints.map((p, i) => {
                    if (i >= indexToDelete) {
                        const oldNum = p.pointNumber || (i + 2);
                        const newNum = oldNum - 1;
                        let newTitle = p.title;
                        const pRegex = new RegExp(`\\bP${oldNum}\\b`, 'i');
                        newTitle = newTitle.replace(pRegex, `P${newNum}`);
                        return { ...p, pointNumber: newNum, title: newTitle };
                    }
                    return p;
                });
            }
        }

        setApprovedPoints(updatedPoints);
        syncPointsToFirebase(updatedPoints, utmZone);
    };

    const confirmNS = async () => {
        if (nsNumber.length !== 10) { alert("A NS deve conter exatamente 10 dígitos."); return; }

        // Check Firebase for existing points saved under this NS
        try {
            const docRef = doc(db, 'earth_levantamentos', nsNumber);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const savedPoints = data?.points;
                const savedZone = data?.utmZone;

                if (savedPoints && Array.isArray(savedPoints) && savedPoints.length > 0) {
                    const shouldImport = window.confirm(
                        `Existem ${savedPoints.length} ponto(s) armazenados desta NS.\nDeseja importar as informações?`
                    );

                    if (shouldImport) {
                        const importedPoints: ApprovedPoint[] = savedPoints.map((p: any, idx: number) => ({
                            id: p.id || Date.now().toString(),
                            title: p.title || '',
                            utmE: p.utmE || '',
                            utmN: p.utmN || '',
                            lat: p.lat || 0,
                            lon: p.lon || 0,
                            zone: p.zone || '',
                            fromFile: p.fromFile || 'Importado',
                            isDivisa: p.isDivisa || false,
                            pointNumber: p.pointNumber || (idx + 1),
                            pdfPage: p.pdfPage || null,
                            pdfX: p.pdfX || null,
                            pdfY: p.pdfY || null,
                        }));
                        setApprovedPoints(importedPoints);

                        // Restore UTM zone (quadrante)
                        if (savedZone) {
                            setUtmZone(savedZone);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Erro ao buscar NS no Firebase:', err);
        }

        setSidebarMode('list');
    };

    const handleManualAdd = () => {
        const nextNum = approvedPoints.length > 0 ? Math.max(...approvedPoints.map(p => p.pointNumber || 0)) + 1 : 1;
        setTempPoint({ e: '', n: '', title: '', isDivisa: false, pointNumber: nextNum });
        setEditPointIndex(null);
        setSidebarMode('point_edit');
    };

    const handleEditPoint = (index: number) => {
        const p = approvedPoints[index];
        // Strip the standard prefix (e.g., "P1 23k " or "P1 - ") if needed, 
        // or just let them edit the whole string. For simplicity, we just pass the raw title.
        // But for pre_projeto, the title includes a lot of extra info.
        let editTitle = p.title;
        if (appMode === 'pre_projeto') {
            const split = p.title.split(' - ');
            if (split.length > 0) editTitle = split[0];
        }

        setTempPoint({
            e: p.utmE,
            n: p.utmN,
            title: editTitle,
            isDivisa: p.isDivisa,
            pointNumber: p.pointNumber || (index + 1)
        });
        setEditPointIndex(index);
        setSidebarMode('point_edit');
    };

    const autoExtractFromPdf = async () => {
        if (!pdfDoc) return;
        if (!nsNumber || nsNumber.length !== 10) {
            alert('Por favor, informe a Nota de Serviço (exatos 10 dígitos) no painel lateral antes de extrair os pontos principais.');
            setSidebarMode('ns_input');
            return;
        }
        setIsAutoExtracting(true);
        try {
            const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere === 'S' ? 'south' : 'north'} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;

            interface TextNode {
                str: string;
                x: number;
                y: number;
                page: number;
            }

            const allTextNodes: TextNode[] = [];

            // Scan all pages
            for (let p = 1; p <= pdfDoc.numPages; p++) {
                const page = await pdfDoc.getPage(p);
                const textContent = await page.getTextContent();
                for (const item of textContent.items) {
                    if (!('str' in item) || !item.str.trim()) continue;
                    const tx = item.transform;
                    // tx[4]=x, tx[5]=y in PDF coordinates
                    allTextNodes.push({
                        str: item.str.trim(),
                        x: tx[4],
                        y: tx[5],
                        page: p
                    });
                }
            }

            // 1) Find Px labels: P1, P2, P66, P70, etc.
            const pxRegex = /^P(\d+)$/i;
            const pxNodes: { num: number; x: number; y: number; page: number }[] = [];
            for (const node of allTextNodes) {
                const m = pxRegex.exec(node.str);
                if (m) {
                    pxNodes.push({ num: parseInt(m[1]), x: node.x, y: node.y, page: node.page });
                }
            }

            // 2) Find coordinate patterns: 6-digit E and 7-digit N
            // They can appear as combined (e.g. "756180:7930199") or split across nearby text nodes
            interface CoordNode {
                e: string;
                n: string;
                x: number;
                y: number;
                page: number;
            }
            const coordNodes: CoordNode[] = [];

            // Pattern A: combined in one node like "756180:7930199" or "756180/7930199" or "756180 7930199"
            const combinedRegex = /(\d{6}[.,]?\d{0,3})[:\s\/\-;](\d{7}[.,]?\d{0,3})/;
            for (const node of allTextNodes) {
                const m = combinedRegex.exec(node.str);
                if (m) {
                    coordNodes.push({
                        e: m[1].replace(',', '.'),
                        n: m[2].replace(',', '.'),
                        x: node.x,
                        y: node.y,
                        page: node.page
                    });
                }
            }

            // Pattern B: look for standalone 6-digit and 7-digit numbers very close together
            const eRegex = /^(\d{6}[.,]?\d{0,3})$/;
            const nRegex = /^(\d{7}[.,]?\d{0,3})$/;
            const eNodes = allTextNodes.filter(n => eRegex.test(n.str));
            const nNodes = allTextNodes.filter(n => nRegex.test(n.str));

            for (const eNode of eNodes) {
                // Find nearest N node on same page within 200 PDF units
                let bestN: TextNode | null = null;
                let bestDist = 200;
                for (const nNode of nNodes) {
                    if (nNode.page !== eNode.page) continue;
                    const dist = Math.sqrt((eNode.x - nNode.x) ** 2 + (eNode.y - nNode.y) ** 2);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestN = nNode;
                    }
                }
                if (bestN) {
                    // Check if this pair is not already captured by combined regex
                    const eVal = eNode.str.replace(',', '.');
                    const nVal = bestN.str.replace(',', '.');
                    const alreadyExists = coordNodes.some(
                        c => c.e === eVal && c.n === nVal && c.page === eNode.page
                    );
                    if (!alreadyExists) {
                        coordNodes.push({
                            e: eVal,
                            n: nVal,
                            x: (eNode.x + bestN.x) / 2,
                            y: (eNode.y + bestN.y) / 2,
                            page: eNode.page
                        });
                    }
                }
            }

            if (pxNodes.length === 0 && coordNodes.length === 0) {
                alert('Nenhum ponto (Px) ou coordenada encontrada no PDF.');
                setIsAutoExtracting(false);
                return;
            }

            // 3) Match each Px to its nearest coordinate
            interface MatchedPoint {
                pNum: number;
                e: string;
                n: string;
                pdfX: number;
                pdfY: number;
                pdfPage: number;
            }

            const matched: MatchedPoint[] = [];
            const usedCoords = new Set<number>();

            if (pxNodes.length > 0 && coordNodes.length > 0) {
                // For each Px, find nearest coord on same page first, then cross-page
                for (const px of pxNodes) {
                    let bestIdx = -1;
                    let bestDist = Infinity;
                    for (let i = 0; i < coordNodes.length; i++) {
                        if (usedCoords.has(i)) continue;
                        const c = coordNodes[i];
                        // Same page gets big priority
                        const pagePenalty = c.page === px.page ? 0 : 10000;
                        const dist = Math.sqrt((px.x - c.x) ** 2 + (px.y - c.y) ** 2) + pagePenalty;
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestIdx = i;
                        }
                    }
                    if (bestIdx >= 0) {
                        const c = coordNodes[bestIdx];
                        usedCoords.add(bestIdx);
                        matched.push({
                            pNum: px.num,
                            e: c.e,
                            n: c.n,
                            pdfX: px.x,
                            pdfY: px.y,
                            pdfPage: px.page
                        });
                    }
                }
            } else if (coordNodes.length > 0) {
                // No Px labels found — just use coordinates in order
                coordNodes.forEach((c, i) => {
                    matched.push({
                        pNum: i + 1,
                        e: c.e,
                        n: c.n,
                        pdfX: c.x,
                        pdfY: c.y,
                        pdfPage: c.page
                    });
                });
            }

            // 4) Sort by Px number ascending
            matched.sort((a, b) => a.pNum - b.pNum);

            // 5) Convert to ApprovedPoint[]
            const newPoints: ApprovedPoint[] = [];
            for (const m of matched) {
                try {
                    const x = parseFloat(m.e);
                    const y = parseFloat(m.n);
                    if (isNaN(x) || isNaN(y)) continue;
                    const [lon, lat] = proj4(utmProj, WGS84, [x, y]);
                    const title = (appMode === 'ambiental' || appMode === 'impedimentos')
                        ? `P${m.pNum} ${utmZone}k ${m.e}:${m.n}`
                        : `P${m.pNum} - ${m.e}:${m.n} - NS: ${nsNumber}`;
                    newPoints.push({
                        id: `auto_${m.pNum}_${Date.now()}`,
                        title,
                        utmE: m.e,
                        utmN: m.n,
                        lat, lon,
                        zone: `${utmZone}${hemisphere}`,
                        fromFile: pdfFile?.name || 'Auto-Extract',
                        isDivisa: false,
                        pdfPage: m.pdfPage,
                        pdfX: m.pdfX,
                        pdfY: m.pdfY,
                        pointNumber: m.pNum,
                    });
                } catch { /* skip invalid coords */ }
            }

            if (newPoints.length === 0) {
                alert('Coordenadas encontradas mas não puderam ser convertidas. Verifique o Fuso UTM.');
                setIsAutoExtracting(false);
                return;
            }

            const merged = [...approvedPoints, ...newPoints];
            setApprovedPoints(merged);
            setSidebarMode('list');
            syncPointsToFirebase(merged, utmZone);

            alert(`✅ ${newPoints.length} ponto(s) extraídos e adicionados com sucesso!`);
        } catch (err) {
            console.error('Erro ao auto-extrair:', err);
            alert('Erro durante a extração automática. Tente manualmente.');
        } finally {
            setIsAutoExtracting(false);
        }
    };
    // --- HIGHLIGHT POINT ON PDF ---
    const highlightPoint = (point: ApprovedPoint) => {
        if (!point.pdfPage || !point.pdfX || !point.pdfY || !pdfDoc) return;

        // Navigate to the correct page
        setPageNum(point.pdfPage);

        // Calculate highlight position (PDF coords → canvas coords)
        // PDF Y is inverted (0 at bottom), canvas Y is 0 at top
        // We need the page viewport to convert
        (async () => {
            const page = await pdfDoc.getPage(point.pdfPage!);
            const viewport = page.getViewport({ scale });
            // Transform PDF coordinates to canvas coordinates
            const canvasX = point.pdfX! * scale;
            const canvasY = viewport.height - (point.pdfY! * scale);

            setHighlightRect({
                x: canvasX - 40,
                y: canvasY - 20,
                w: 80,
                h: 40,
                page: point.pdfPage!
            });

            // Scroll the PDF viewer to the highlighted area
            setTimeout(() => {
                const wrapper = canvasWrapperRef.current?.parentElement;
                if (wrapper) {
                    wrapper.scrollTo({
                        left: Math.max(0, canvasX - wrapper.clientWidth / 2),
                        top: Math.max(0, canvasY - wrapper.clientHeight / 2),
                        behavior: 'smooth'
                    });
                }
            }, 300);

            // Auto-dismiss highlight after 4 seconds
            setTimeout(() => setHighlightRect(null), 4000);
        })();
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
                } else if (isConferencia) {
                    iconUrl = 'http://maps.google.com/mapfiles/kml/paddle/ltblu-blank.png';
                } else {
                    iconUrl = 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png';
                }
            } else {
                let iconNumber = p.pointNumber || (index + 1);
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
        
        let fileName = `NS_${nsNumber}.kml`;
        if (!nsNumber) {
            fileName = appMode === 'ambiental'
                ? `Ambiental_${new Date().toISOString().split('T')[0]}.kml`
                : appMode === 'impedimentos'
                    ? `Impedimentos_${new Date().toISOString().split('T')[0]}.kml`
                    : `Export_${new Date().toISOString().split('T')[0]}.kml`;
        }
        link.download = fileName;
        
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
        setTempPoint({ e: '', n: '', title: '', isDivisa: false, pointNumber: 1 });
        setIsConferencia(false);
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
        setTempPoint({ e: '', n: '', title: '', isDivisa: false, pointNumber: 1 });
        setIsConferencia(false);
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
            <header className="flex-none bg-slate-900 text-white p-3 flex justify-between items-center shadow-md z-30 border-b border-slate-700">

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

                    {/* BOTÃO CONFERÊNCIA — apenas Impedimentos */}
                    {appMode === 'impedimentos' && (
                        <button
                            onClick={() => setIsConferencia(prev => !prev)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isConferencia
                                ? 'bg-yellow-500 border-yellow-400 text-black shadow-lg shadow-yellow-500/30'
                                : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white hover:border-yellow-500/50'
                                }`}
                        >
                            <Eye size={14} />
                            Conferência
                        </button>
                    )}

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
                        <FilePlus size={16} /> {isConferencia ? 'Abrir Outro Arquivo' : 'Abrir Outro PDF'}
                        <input type="file" accept={isConferencia ? '.pdf,.doc,.docx' : '.pdf'} className="hidden" onChange={handleFileUpload} />
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
                                <FileUp size={24} /> {isConferencia ? 'Abrir Arquivo' : 'Abrir PDF'}
                                <input type="file" accept={isConferencia ? '.pdf,.doc,.docx' : '.pdf'} className="hidden" onChange={handleFileUpload} />
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
                            {/* HIGHLIGHT OVERLAY */}
                            {highlightRect && highlightRect.page === pageNum && (
                                <div
                                    className="absolute z-50 pointer-events-none"
                                    style={{
                                        left: highlightRect.x - 10,
                                        top: highlightRect.y - 10,
                                        width: highlightRect.w + 20,
                                        height: highlightRect.h + 20,
                                    }}
                                >
                                    <div className="w-full h-full border-4 border-red-500 bg-red-500/15 rounded-lg animate-pulse" />
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg">
                                        📍 Ponto aqui
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUNA DIREITA: SIDEBAR */}
                <div className="w-[400px] bg-white shadow-xl z-20 flex flex-col border-l border-gray-300">

                    {/* NS INPUT (todos os modos) */}
                    {sidebarMode === 'ns_input' && (() => {
                        const isAmb = appMode === 'ambiental';
                        const isImp = appMode === 'impedimentos';
                        const isGreen = isAmb || isImp;
                        const bgColor = isAmb ? 'bg-emerald-50' : isImp ? 'bg-amber-50' : 'bg-blue-50';
                        const iconBg = isAmb ? 'bg-emerald-100 text-emerald-600' : isImp ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600';
                        const borderColor = isAmb ? 'border-emerald-200' : isImp ? 'border-amber-200' : 'border-blue-200';
                        const inputBorder = isAmb ? 'border-emerald-300 focus:border-emerald-600' : isImp ? 'border-amber-300 focus:border-amber-600' : 'border-blue-300 focus:border-blue-600';
                        const btnColor = isAmb ? 'bg-emerald-600 hover:bg-emerald-700' : isImp ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700';
                        return (
                            <div className={`flex-1 p-6 flex flex-col justify-center ${bgColor}`}>
                                <div className="text-center mb-6">
                                    <div className={`${iconBg} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}><Hash size={32} /></div>
                                    <h2 className="text-xl font-bold text-gray-800">Identificação NS</h2>
                                    <p className="text-sm text-gray-600 mt-2">Digite, selecione texto ou use o OCR.</p>
                                </div>
                                <div className={`bg-white p-4 rounded shadow-sm border ${borderColor}`}>
                                    <input value={nsNumber} onChange={(e) => setNsNumber(e.target.value)} placeholder="NS..." maxLength={10} className={`w-full text-lg border-b-2 ${inputBorder} outline-none py-2 font-mono text-center text-black`} autoFocus />
                                </div>
                                <button onClick={confirmNS} disabled={nsNumber.length < 3} className={`mt-8 w-full ${btnColor} disabled:opacity-50 text-white py-3 rounded font-bold shadow flex justify-center items-center gap-2`}>Confirmar <ChevronRight size={18} /></button>
                            </div>
                        );
                    })()}

                    {/* LISTA DE PONTOS */}
                    {sidebarMode === 'list' && (
                        <>
                            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                <h2 className="font-bold text-gray-700 flex items-center gap-2"><MousePointer2 size={16} /> Pontos</h2>
                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600">{approvedPoints.length}</span>
                            </div>

                            {/* BOTÕES DE AÇÃO */}
                            <div className="px-4 pt-3 space-y-2">
                                {/* BOTÃO AUTO-EXTRAIR */}
                                {pdfDoc && (
                                    <button
                                        onClick={autoExtractFromPdf}
                                        disabled={isAutoExtracting}
                                        className={`w-full text-sm py-2.5 rounded-lg font-bold flex justify-center gap-2 items-center transition-all shadow-sm ${
                                            isAutoExtracting
                                                ? 'bg-purple-200 text-purple-400 cursor-wait'
                                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white hover:shadow-md'
                                        }`}
                                    >
                                        {isAutoExtracting
                                            ? <><Loader2 size={16} className="animate-spin" /> Extraindo...</>
                                            : <><Sparkles size={16} /> Extrair Automaticamente</>
                                        }
                                    </button>
                                )}
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
                                        <div
                                            key={idx}
                                            className={`bg-white border rounded p-3 shadow-sm flex gap-3 items-center group cursor-pointer transition-all ${p.isDivisa ? 'border-orange-300 hover:border-orange-400' : 'border-gray-200 hover:border-blue-300 hover:shadow-md'}`}
                                            onClick={() => highlightPoint(p)}
                                            title={p.pdfPage ? `Clique para localizar na página ${p.pdfPage}` : ''}
                                        >
                                            <div className={`${p.isDivisa ? 'bg-orange-500' : ((appMode === 'ambiental' || appMode === 'impedimentos') ? 'bg-emerald-500' : 'bg-orange-500')} text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-none`}>
                                                {p.isDivisa ? 'D' : (p.pointNumber || (idx + 1))}
                                            </div>
                                            <div className="overflow-hidden flex-1">
                                                <div className="font-bold text-sm text-gray-800 truncate">{p.title}</div>
                                                <div className="text-xs text-gray-500 mt-1 font-mono font-semibold">
                                                    E: {p.utmE} N: {p.utmN}
                                                    {p.isDivisa && <span className="ml-2 text-orange-600 font-bold">DIVISA</span>}
                                                </div>
                                                {p.pdfPage && <div className="text-[10px] text-blue-400 mt-0.5">📄 Pág. {p.pdfPage} — clique para localizar</div>}
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleEditPoint(idx); }} className="text-gray-400 hover:text-blue-500 transition-colors" title="Editar"><Edit2 size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeletePoint(idx); }} className="text-red-300 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                            {/* MAP PREVIEW */}
                            {approvedPoints.length > 0 && (
                                <div className="border-t border-gray-200">
                                    <button
                                        onClick={() => setShowMap(prev => !prev)}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold transition-colors ${
                                            showMap
                                                ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                        }`}
                                    >
                                        <MapIcon size={14} />
                                        {showMap ? 'Ocultar Mapa' : 'Mostrar Mapa'}
                                    </button>
                                    {showMap && (
                                        <div style={{ height: '250px', width: '100%' }}>
                                            <MapPreview points={approvedPoints} appMode={appMode!} />
                                        </div>
                                    )}
                                </div>
                            )}
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
                                <h3 className="font-bold text-lg">
                                    {editPointIndex !== null ? `Editar Ponto #${editPointIndex + 1}` : `Novo Ponto #${approvedPoints.length + 1}`}
                                </h3>
                                <p className="text-xs opacity-80">
                                    {(appMode === 'ambiental' || appMode === 'impedimentos') ? 'Edite os dados geográficos' : 'Edite os dados do ponto'}
                                </p>
                            </div>
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto">

                                {/* Número do Ponto */}
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Número do Ponto</label>
                                    <input 
                                        type="number" 
                                        value={tempPoint.pointNumber} 
                                        onChange={(e) => {
                                            const newNum = parseInt(e.target.value) || 1;
                                            let newTitle = tempPoint.title;
                                            if (newTitle === `P${tempPoint.pointNumber}`) newTitle = `P${newNum}`;
                                            setTempPoint({ ...tempPoint, pointNumber: newNum, title: newTitle });
                                        }} 
                                        className="w-full font-mono text-black bg-white border-2 border-gray-200 rounded p-2 focus:border-blue-500 outline-none font-bold" 
                                    />
                                </div>

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
                                <button onClick={() => { setSidebarMode('list'); setEditPointIndex(null); }} className="flex-1 py-3 text-gray-600 hover:bg-gray-200 rounded font-medium flex items-center justify-center gap-2"><XCircle size={20} /> Cancelar</button>
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
