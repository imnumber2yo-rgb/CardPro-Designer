/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  Printer, 
  RotateCw, 
  Layers, 
  Settings, 
  Type, 
  Image as ImageIcon, 
  Save, 
  FileJson, 
  Maximize, 
  Move, 
  ZoomIn, 
  ChevronRight, 
  ChevronLeft,
  X,
  FileText,
  Copy,
  Eye,
  Grid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---

const DPI = 96;

type CardPreset = {
  name: string;
  width: number; // inches
  height: number; // inches
};

const CARD_PRESETS: Record<string, CardPreset> = {
  'Business Card': { name: 'Business Card', width: 3.5, height: 2 },
  'Index Card': { name: 'Index Card', width: 5, height: 3 },
  'Postcard': { name: 'Postcard', width: 6, height: 4 },
  'Greeting Card': { name: 'Greeting Card', width: 7, height: 5 },
};

type PaperPreset = {
  name: string;
  width: number; // inches
  height: number; // inches
};

const PAPER_PRESETS: Record<string, PaperPreset> = {
  'Letter': { name: 'Letter', width: 8.5, height: 11 },
  'Legal': { name: 'Legal', width: 8.5, height: 14 },
  'A4': { name: 'A4', width: 8.27, height: 11.69 }, // 210mm x 297mm
};

type BlendingMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

type TextLayer = {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  letterSpacing: number;
  lineHeight: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  opacity: number;
  panel?: 'all' | 'front' | 'back';
};

type ImageLayer = {
  id: string;
  type: 'image';
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fit: 'fit' | 'fill' | 'custom';
  opacity: number;
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    grayscale: number;
    invert: number;
    hueRotate: number;
    blur: number;
  };
  blendMode: BlendingMode;
  panel?: 'all' | 'front' | 'back';
};

type Template = {
  id: string;
  name: string;
  createdAt: number;
  cardSize: string;
  isPortrait: boolean;
  imageLayers: ImageLayer[];
  textLayers: TextLayer[];
};

// --- App Component ---

export default function App() {
  // Designer State
  const [activeTab, setActiveTab] = useState<'assets' | 'layers' | 'text' | 'filters' | 'print'>('assets');
  const [cardSize, setCardSize] = useState<string>('Business Card');
  const [isPortrait, setIsPortrait] = useState(false);
  const [imageLayers, setImageLayers] = useState<ImageLayer[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [foldType, setFoldType] = useState<'side' | 'top'>('side');
  const [dragInfo, setDragInfo] = useState<{
    id: string;
    type: 'move' | 'resize' | 'rotate';
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialRot: number;
    initialScale: number;
    initialFontSize: number;
  } | null>(null);
  
  // Imposition State
  const [paperSize, setPaperSize] = useState<string>('Letter');
  const [impositionMode, setImpositionMode] = useState<'single' | 'grid' | 'custom'>('grid');
  const [autoRotate, setAutoRotate] = useState(true);
  const [customGrid, setCustomGrid] = useState({ rows: 1, cols: 1, gap: 0.125 });
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showBleedGuides, setShowBleedGuides] = useState(false);
  const [showRegMarks, setShowRegMarks] = useState(true);
  
  // Templates State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('My Card Design');

  // PDF State
  const [pdfFile, setPdfFile] = useState<{ data: Uint8Array, name: string } | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // Initialize PDF worker
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }, []);

  // PDF Handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (window as any).pdfjsLib) {
      setIsPdfLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        setPdfFile({ data, name: file.name });
        
        const loadingTask = (window as any).pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport }).promise;
          pages.push(canvas.toDataURL());
        }
        setPdfPages(pages);
        setIsPdfLoading(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const selectPdfPage = (src: string) => {
    const newLayer: ImageLayer = {
      id: `img_${Date.now()}`,
      type: 'image',
      src,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      fit: 'fill',
      opacity: 100,
      filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: 0,
        invert: 0,
        hueRotate: 0,
        blur: 0,
      },
      blendMode: 'normal',
    };
    setImageLayers([newLayer, ...imageLayers]);
    setSelectedLayerId(newLayer.id);
    setPdfFile(null);
    setPdfPages([]);
  };

  // Load Templates
  useEffect(() => {
    const saved = localStorage.getItem('card_designer_templates');
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load templates", e);
      }
    }
  }, []);

  // Click & Drag Interactive Transform logic
  useEffect(() => {
    if (!dragInfo) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;

      const cardSurface = document.getElementById('card-surface');
      if (!cardSurface) return;
      const rect = cardSurface.getBoundingClientRect();

      if (dragInfo.type === 'move') {
        const pctX = (dx / rect.width) * 100;
        const pctY = (dy / rect.height) * 100;
        
        const newX = parseFloat((dragInfo.initialX + pctX).toFixed(1));
        const newY = parseFloat((dragInfo.initialY + pctY).toFixed(1));

        if (imageLayers.some(l => l.id === dragInfo.id)) {
          updateImageLayer(dragInfo.id, { x: newX, y: newY });
        } else {
          updateTextLayer(dragInfo.id, { x: newX, y: newY });
        }
      } else if (dragInfo.type === 'resize') {
        const ratio = 1 + (dx / rect.width) * 1.5;
        if (imageLayers.some(l => l.id === dragInfo.id)) {
          const newScale = parseFloat(Math.max(0.1, Math.min(10, dragInfo.initialScale * ratio)).toFixed(2));
          updateImageLayer(dragInfo.id, { scale: newScale, fit: 'custom' });
        } else {
          const newFontSize = Math.max(8, Math.min(150, Math.round(dragInfo.initialFontSize * ratio)));
          updateTextLayer(dragInfo.id, { fontSize: newFontSize });
        }
      } else if (dragInfo.type === 'rotate') {
        const layerEl = document.getElementById(`layer-${dragInfo.id}`);
        if (layerEl) {
          const layerRect = layerEl.getBoundingClientRect();
          const centerX = layerRect.left + layerRect.width / 2;
          const centerY = layerRect.top + layerRect.height / 2;

          let angleCurrent = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
          let angleStart = Math.atan2(dragInfo.startY - centerY, dragInfo.startX - centerX) * (180 / Math.PI);
          
          let deltaAngle = angleCurrent - angleStart;
          let newRot = Math.round((dragInfo.initialRot + deltaAngle) % 360);
          if (newRot < 0) newRot += 360;

          if (imageLayers.some(l => l.id === dragInfo.id)) {
            updateImageLayer(dragInfo.id, { rotation: newRot });
          } else {
            updateTextLayer(dragInfo.id, { rotation: newRot });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDragInfo(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragInfo, imageLayers, textLayers]);

  const startDrag = (e: React.MouseEvent, layer: any, type: 'move' | 'resize' | 'rotate') => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    
    setDragInfo({
      id: layer.id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialX: layer.x,
      initialY: layer.y,
      initialRot: layer.rotation || 0,
      initialScale: layer.scale || 1,
      initialFontSize: layer.fontSize || 24,
    });
  };

  const saveTemplates = (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('card_designer_templates', JSON.stringify(newTemplates));
  };

  const handleSaveTemplate = () => {
    const newTemplate: Template = {
      id: Math.random().toString(36).substr(2, 9),
      name: templateName,
      createdAt: Date.now(),
      cardSize,
      isPortrait,
      imageLayers,
      textLayers,
    };
    saveTemplates([newTemplate, ...templates]);
  };

  const handleExportTemplates = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card_designer_templates_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            const merged = [...imported, ...templates];
            // Basic deduplication by ID
            const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
            saveTemplates(unique);
          }
        } catch (e) {
          alert("Failed to import templates. Invalid JSON format.");
        }
      };
      reader.readAsText(file);
    }
  };

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newLayer: ImageLayer = {
          id: `img_${Date.now()}`,
          type: 'image',
          src: event.target?.result as string,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          fit: 'fill',
          opacity: 100,
          filters: {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            grayscale: 0,
            invert: 0,
            hueRotate: 0,
            blur: 0,
          },
          blendMode: 'normal',
        };
        setImageLayers([newLayer, ...imageLayers]);
        setSelectedLayerId(newLayer.id);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTextLayer = () => {
    const newLayer: TextLayer = {
      id: `text_${Date.now()}`,
      type: 'text',
      content: 'New Text',
      x: 20,
      y: 20,
      rotation: 0,
      fontSize: 24,
      fontFamily: 'sans-serif',
      fontWeight: '400',
      color: '#000000',
      letterSpacing: 0,
      lineHeight: 1.2,
      strokeColor: '#000000',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      opacity: 100,
    };
    setTextLayers([newLayer, ...textLayers]);
    setSelectedLayerId(newLayer.id);
  };

  const updateImageLayer = (id: string, updates: Partial<ImageLayer>) => {
    setImageLayers(imageLayers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const updateTextLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers(textLayers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deleteLayer = (id: string) => {
    setImageLayers(imageLayers.filter(l => l.id !== id));
    setTextLayers(textLayers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const imgIdx = imageLayers.findIndex(l => l.id === id);
    const txtIdx = textLayers.findIndex(l => l.id === id);
    
    // Simplistic reordering - images are always below text for this design logic,
    // but within their own categories we can swap.
    if (imgIdx !== -1) {
      const newImages = [...imageLayers];
      if (direction === 'up' && imgIdx > 0) {
        [newImages[imgIdx], newImages[imgIdx-1]] = [newImages[imgIdx-1], newImages[imgIdx]];
      } else if (direction === 'down' && imgIdx < newImages.length - 1) {
        [newImages[imgIdx], newImages[imgIdx+1]] = [newImages[imgIdx+1], newImages[imgIdx]];
      }
      setImageLayers(newImages);
    } else if (txtIdx !== -1) {
      const newText = [...textLayers];
      if (direction === 'up' && txtIdx > 0) {
        [newText[txtIdx], newText[txtIdx-1]] = [newText[txtIdx-1], newText[txtIdx]];
      } else if (direction === 'down' && txtIdx < newText.length - 1) {
        [newText[txtIdx], newText[txtIdx+1]] = [newText[txtIdx+1], newText[txtIdx]];
      }
      setTextLayers(newText);
    }
  };

  // --- Calculations ---

  const currentPreset = CARD_PRESETS[cardSize];
  let cardWidthIn = isPortrait ? currentPreset.height : currentPreset.width;
  let cardHeightIn = isPortrait ? currentPreset.width : currentPreset.height;

  // Greeting Card expansion (calculating flat size)
  if (cardSize === 'Greeting Card') {
    if (foldType === 'side') {
      cardWidthIn = cardWidthIn * 2;
    } else {
      cardHeightIn = cardHeightIn * 2;
    }
  }

  const currentPaper = PAPER_PRESETS[paperSize];
  const paperWidthIn = currentPaper.width;
  const paperHeightIn = currentPaper.height;

  const calculateImposition = useMemo(() => {
    if (impositionMode === 'single') return { rows: 1, cols: 1, rotated: false };
    if (impositionMode === 'custom') return customGrid;

    // Grid Max Fill Logic
    const margin = 0.25; // Safe margin from edge
    const availableW = paperWidthIn - (margin * 2);
    const availableH = paperHeightIn - (margin * 2);

    // Try Orientation A
    const colsA = Math.floor(availableW / cardWidthIn);
    const rowsA = Math.floor(availableH / cardHeightIn);
    const totalA = colsA * rowsA;

    // Try Orientation B (rotate cards)
    const colsB = Math.floor(availableW / cardHeightIn);
    const rowsB = Math.floor(availableH / cardWidthIn);
    const totalB = colsB * rowsB;

    if (autoRotate && totalB > totalA) {
      return { rows: rowsB, cols: colsB, rotated: true };
    }
    return { rows: rowsA, cols: colsA, rotated: false };
  }, [impositionMode, customGrid, cardWidthIn, cardHeightIn, paperWidthIn, paperHeightIn, autoRotate]);

  // --- Components ---

  const CardPreview = ({ scale = 1, isPrint = false }: { scale?: number, isPrint?: boolean }) => {
    return (
      <div 
        id={isPrint ? undefined : "card-surface"}
        className="relative shadow-2xl overflow-hidden bg-white"
        style={{
          width: `${cardWidthIn * DPI * scale}px`,
          height: `${cardHeightIn * DPI * scale}px`,
          transform: `scale(1)`,
          transformOrigin: 'top left',
        }}
      >
        {/* Fold Indicator & Surface Labels for Greeting Cards */}
        {cardSize === 'Greeting Card' && !isPrint && (
          <div className="absolute inset-0 pointer-events-none flex z-50">
             {foldType === 'side' ? (
               <div className="w-full h-full flex">
                  <div className="flex-1 border-r border-dashed border-black/20 flex items-center justify-center bg-black/[0.01]">
                    <span className="text-[10px] text-black/20 uppercase font-black tracking-widest -rotate-90">Back Cover</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-black/[0.01]">
                    <span className="text-[10px] text-black/20 uppercase font-black tracking-widest -rotate-90">Front Cover</span>
                  </div>
               </div>
             ) : (
               <div className="w-full h-full flex flex-col">
                  <div className="flex-1 border-b border-dashed border-black/20 flex items-center justify-center bg-black/[0.01]">
                    <span className="text-[10px] text-black/20 uppercase font-black tracking-widest">Back Cover (Upside Down)</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-black/[0.01]">
                    <span className="text-[10px] text-black/20 uppercase font-black tracking-widest">Front Cover</span>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* Image Layers */}
        {[...imageLayers].reverse().map((layer) => {
          const isDivided = cardSize === 'Greeting Card';
          const isSide = foldType === 'side';
          let panelLeft = '0%';
          let panelTop = '0%';
          let panelWidth = '100%';
          let panelHeight = '100%';

          if (isDivided && layer.panel && layer.panel !== 'all') {
            if (isSide) {
              if (layer.panel === 'back') {
                panelWidth = '50%';
              } else if (layer.panel === 'front') {
                panelLeft = '50%';
                panelWidth = '50%';
              }
            } else { // top
              if (layer.panel === 'back') {
                panelHeight = '50%';
              } else if (layer.panel === 'front') {
                panelTop = '50%';
                panelHeight = '50%';
              }
            }
          }

          const isSelected = !isPrint && selectedLayerId === layer.id;

          return (
            <div 
              key={layer.id}
              id={`layer-${layer.id}`}
              className="absolute pointer-events-auto"
              style={{
                zIndex: 10 + (isSelected ? 50 : 0),
                left: panelLeft,
                top: panelTop,
                width: panelWidth,
                height: panelHeight,
                overflow: (isDivided && layer.panel && layer.panel !== 'all') ? 'hidden' : 'visible',
              }}
            >
              <div 
                className={`relative w-full h-full ${isSelected ? 'outline outline-2 outline-dashed outline-orange-500' : ''}`}
                style={{
                  opacity: layer.opacity / 100,
                  mixBlendMode: layer.blendMode,
                }}
              >
                <img 
                  src={layer.src} 
                  alt=""
                  onMouseDown={(e) => !isPrint && startDrag(e, layer, 'move')}
                  className="absolute cursor-move origin-center"
                  style={{
                    top: `${layer.y}%`,
                    left: `${layer.x}%`,
                    width: layer.fit === 'fill' ? '100.5%' : layer.fit === 'fit' ? 'auto' : `${layer.scale * 100}%`,
                    height: layer.fit === 'fill' ? '100.5%' : layer.fit === 'fit' ? '100%' : 'auto',
                    objectFit: layer.fit === 'fit' ? 'contain' : layer.fit === 'fill' ? 'cover' : 'none',
                    transform: `rotate(${layer.rotation || 0}deg) scale(${layer.scale || 1})`,
                    filter: `
                      brightness(${layer.filters.brightness}%) 
                      contrast(${layer.filters.contrast}%) 
                      saturate(${layer.filters.saturation}%) 
                      grayscale(${layer.filters.grayscale}%) 
                      invert(${layer.filters.invert}%) 
                      hue-rotate(${layer.filters.hueRotate}deg) 
                      blur(${layer.filters.blur}px)
                    `,
                  }}
                />

                {isSelected && (
                  <div 
                    className="absolute inset-0 pointer-events-none z-[1001]"
                    style={{
                      top: `${layer.y}%`,
                      left: `${layer.x}%`,
                    }}
                  >
                    <div 
                      className="absolute"
                      style={{
                        transform: `rotate(${layer.rotation || 0}deg)`,
                      }}
                    >
                      {/* Rotation Handle */}
                      <button
                        title="Rotate Layer"
                        onMouseDown={(e) => startDrag(e, layer, 'rotate')}
                        className="absolute -top-12 left-0 -translate-x-1/2 w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-700 hover:scale-110 text-white shadow-xl flex items-center justify-center pointer-events-auto transition-transform"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      {/* Resize Handle */}
                      <button
                        title="Scale Image"
                        onMouseDown={(e) => startDrag(e, layer, 'resize')}
                        className="absolute top-12 left-0 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-lg bg-orange-600 hover:bg-orange-700 hover:scale-110 text-white shadow-xl flex items-center justify-center pointer-events-auto transition-transform cursor-se-resize"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Text Layers */}
        {[...textLayers].reverse().map((layer) => {
          const isDivided = cardSize === 'Greeting Card';
          const isSide = foldType === 'side';
          let panelLeft = 0;
          let panelTop = 0;
          let panelMultWidth = 1;
          let panelMultHeight = 1;

          if (isDivided && layer.panel && layer.panel !== 'all') {
            if (isSide) {
              if (layer.panel === 'back') {
                panelMultWidth = 0.5;
              } else if (layer.panel === 'front') {
                panelLeft = 50;
                panelMultWidth = 0.5;
              }
            } else { // top
              if (layer.panel === 'back') {
                panelMultHeight = 0.5;
              } else if (layer.panel === 'front') {
                panelTop = 50;
                panelMultHeight = 0.5;
              }
            }
          }

          const isSelected = !isPrint && selectedLayerId === layer.id;

          return (
            <div 
              key={layer.id}
              id={`layer-${layer.id}`}
              className={`absolute select-none whitespace-pre origin-center ${isSelected ? 'outline outline-2 outline-orange-500 rounded px-1' : ''}`}
              style={{
                zIndex: 100 + (isSelected ? 50 : 0),
                left: `${panelLeft + (layer.x * panelMultWidth)}%`,
                top: `${panelTop + (layer.y * panelMultHeight)}%`,
                transform: `rotate(${layer.rotation}deg)`,
                color: layer.color,
                fontSize: `${layer.fontSize}px`,
                fontFamily: layer.fontFamily,
                fontWeight: layer.fontWeight,
                letterSpacing: `${layer.letterSpacing}em`,
                lineHeight: layer.lineHeight,
                opacity: layer.opacity / 100,
                WebkitTextStroke: `${layer.strokeWidth}px ${layer.strokeColor}`,
                textShadow: `${layer.shadowOffsetX}px ${layer.shadowOffsetY}px ${layer.shadowBlur}px ${layer.shadowColor}`,
                cursor: isPrint ? 'default' : 'move',
              }}
              onMouseDown={(e) => !isPrint && startDrag(e, layer, 'move')}
            >
              {layer.content}

              {isSelected && (
                <>
                  {/* Rotation handle floating above top */}
                  <button
                    title="Rotate Text"
                    onMouseDown={(e) => startDrag(e, layer, 'rotate')}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-700 hover:scale-110 text-white shadow-xl flex items-center justify-center pointer-events-auto transition-transform"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Resize scale handle at bottom-right corner */}
                  <button
                    title="Adjust Font Size"
                    onMouseDown={(e) => startDrag(e, layer, 'resize')}
                    className="absolute -bottom-8 -right-8 w-8 h-8 rounded-lg bg-orange-600 hover:bg-orange-700 hover:scale-110 text-white shadow-xl flex items-center justify-center pointer-events-auto transition-transform cursor-se-resize"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const PrintLayout = () => {
    const { rows, cols, rotated } = calculateImposition;
    const finalW = rotated ? cardHeightIn : cardWidthIn;
    const finalH = rotated ? cardWidthIn : cardHeightIn;

    return (
      <div 
        className="bg-white mx-auto print-sheet relative"
        style={{
          width: `${paperWidthIn}in`,
          height: `${paperHeightIn}in`,
          boxShadow: '0 0 20px rgba(0,0,0,0.5)',
          pageBreakAfter: 'always',
        }}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          {/* Main Grid */}
          <div 
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${finalW}in)`,
              gridTemplateRows: `repeat(${rows}, ${finalH}in)`,
              gap: `${impositionMode === 'custom' ? customGrid.gap : 0}in`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => (
              <div key={i} className="relative printable-card" style={{ width: `${finalW}in`, height: `${finalH}in` }}>
                <div style={{ transform: rotated ? 'rotate(90deg)' : 'none', transformOrigin: 'center', width: rotated ? `${finalH}in` : '100%', height: rotated ? `${finalW}in` : '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CardPreview scale={1} isPrint />
                </div>
                
                {/* Crop Marks */}
                {showCropMarks && (
                  <>
                    <div className="absolute -top-4 left-0 w-[0.5pt] h-4 bg-black" />
                    <div className="absolute -top-4 right-0 w-[0.5pt] h-4 bg-black" />
                    <div className="absolute top-0 -left-4 w-4 h-[0.5pt] bg-black" />
                    <div className="absolute bottom-0 -left-4 w-4 h-[0.5pt] bg-black" />
                    <div className="absolute -bottom-4 left-0 w-[0.5pt] h-4 bg-black" />
                    <div className="absolute -bottom-4 right-0 w-[0.5pt] h-4 bg-black" />
                    <div className="absolute top-0 -right-4 w-4 h-[0.5pt] bg-black" />
                    <div className="absolute bottom-0 -right-4 w-4 h-[0.5pt] bg-black" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bleed Guide Outline (Full Page) */}
        {showBleedGuides && (
           <div className="absolute inset-[0.125in] border border-dashed border-red-500/30 pointer-events-none" />
        )}

        {/* Registration Marks */}
        {showRegMarks && (
          <>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center opacity-50">
              <div className="absolute w-8 h-[0.5pt] bg-black" />
              <div className="absolute h-8 w-[0.5pt] bg-black" />
              <div className="absolute w-4 h-4 rounded-full border border-black" />
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center opacity-50">
              <div className="absolute w-8 h-[0.5pt] bg-black" />
              <div className="absolute h-8 w-[0.5pt] bg-black" />
              <div className="absolute w-4 h-4 rounded-full border border-black" />
            </div>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center opacity-50">
              <div className="absolute w-8 h-[0.5pt] bg-black" />
              <div className="absolute h-8 w-[0.5pt] bg-black" />
              <div className="absolute w-4 h-4 rounded-full border border-black" />
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center opacity-50">
              <div className="absolute w-8 h-[0.5pt] bg-black" />
              <div className="absolute h-8 w-[0.5pt] bg-black" />
              <div className="absolute w-4 h-4 rounded-full border border-black" />
            </div>
          </>
        )}
      </div>
    );
  };

  const selectedLayer = useMemo(() => {
    return imageLayers.find(l => l.id === selectedLayerId) || textLayers.find(l => l.id === selectedLayerId);
  }, [selectedLayerId, imageLayers, textLayers]);

  // --- Main Render ---

  if (isPrintPreview) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
        <div className="h-16 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-8 no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsPrintPreview(false)} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-white font-medium">Print Production Layout</h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Production Sheet
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-12 overflow-auto bg-[#0a0a0a] flex justify-center no-print">
          <PrintLayout />
        </div>

        {/* Print Content Hidden in UI, only for @media print */}
        <div className="hidden print:block">
           <PrintLayout />
        </div>

        <style>
          {`
            @media print {
              body, html {
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * { 
                visibility: hidden; 
                margin: 0; 
                padding: 0; 
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #root, #root * { visibility: hidden; }
              .print-sheet, .print-sheet * { visibility: visible; }
              .print-sheet { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 100% !important; 
                height: 100% !important;
                margin: 0 !important; 
                padding: 0 !important;
                background-color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page { size: ${currentPaper.name === 'A4' ? 'A4' : currentPaper.name === 'Legal' ? 'legal' : 'letter'}; margin: 0; }
              .no-print { display: none !important; }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-gray-300 font-sans selection:bg-orange-500/30">
      
      {/* --- Left Panes: File Ingestion & Layers --- */}
      <div className="w-80 h-full border-r border-white/10 flex flex-col bg-[#0a0a0b]">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-orange-600 flex items-center justify-center">
            <Maximize className="w-5 h-5 text-white" />
          </div>
          <input 
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-white font-medium p-0 text-sm"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 p-1 bg-[#050505] mx-4 my-2 rounded-lg">
          {[
            { id: 'assets', icon: Upload },
            { id: 'layers', icon: Layers },
            { id: 'text', icon: Type },
            { id: 'filters', icon: Settings },
            { id: 'print', icon: Grid },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex justify-center py-2 rounded-md transition-all ${
                activeTab === tab.id ? 'bg-[#1a1a1c] text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <AnimatePresence mode="wait">
            {activeTab === 'assets' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pt-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Upload Asset</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-white/10 rounded-xl hover:bg-white/5 cursor-pointer transition-all group">
                      <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-orange-500 mb-1" />
                      <span className="text-[10px] text-gray-500">Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-white/10 rounded-xl hover:bg-white/5 cursor-pointer transition-all group">
                      <FileText className="w-5 h-5 text-gray-400 group-hover:text-orange-500 mb-1" />
                      <span className="text-[10px] text-gray-500">PDF</span>
                      <input type="file" className="hidden" accept="application/pdf" onChange={handlePdfUpload} />
                    </label>
                  </div>
                </div>

                {isPdfLoading && (
                  <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg text-orange-500 text-xs">
                    <RotateCw className="w-3 h-3 animate-spin" /> Analyzing PDF document...
                  </div>
                )}

                <div>
                   <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3 block">Card Geometry</label>
                   <div className="grid grid-cols-1 gap-2">
                    {Object.keys(CARD_PRESETS).map(preset => (
                      <button
                        key={preset}
                        onClick={() => setCardSize(preset)}
                        className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                          cardSize === preset ? 'border-orange-500/50 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="font-medium">{preset}</div>
                        <div className="text-[10px] opacity-60">{CARD_PRESETS[preset].width}" x {CARD_PRESETS[preset].height}"</div>
                      </button>
                    ))}
                   </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                   <div className="text-xs flex items-center gap-2">
                      <Move className="w-3 h-3" /> Orientation
                   </div>
                   <button 
                    onClick={() => setIsPortrait(!isPortrait)}
                    className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-all ${
                      isPortrait ? 'bg-orange-600 text-white' : 'bg-[#1a1a1c] text-gray-400'
                    }`}
                   >
                     {isPortrait ? 'Portrait' : 'Landscape'}
                   </button>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1.5 text-left">
                   <div className="flex items-center gap-2 text-blue-400">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Print Orientation Suggestion</span>
                   </div>
                   <div className="text-[10px] text-gray-400 leading-relaxed font-sans font-medium">
                     {cardSize === 'Business Card' && (
                       <span>
                         <strong>Standard Layout:</strong> Use <strong>Landscape</strong> for front containing core logo/contact details, and a high contrast solid back page. Avoid vertical text on horizontal layouts to prevent printing orientation mismatch.
                       </span>
                     )}
                     {cardSize === 'Index Card' && (
                       <span>
                         <strong>Index/Media Cards:</strong> Use <strong>Landscape</strong> with front side containing dominant header line grids and back side for raw details.
                       </span>
                     )}
                     {cardSize === 'Postcard' && (
                       <span>
                         <strong>Heavy Postcards:</strong> Use <strong>Landscape</strong> with front page for primary graphic artwork (covering full page bleeding margins), and back page sectioned vertically (left for copy, right for postal stamp and recipient address bounds).
                       </span>
                     )}
                     {cardSize === 'Greeting Card' && (
                       <span>
                         {foldType === 'side' 
                           ? "Side Flip Fold: Layout is 14\" x 5\" (Landscape flat spread). Left half represents the Back Cover, right half represents the Front Cover (Portrait is recommended for Front Cover images)." 
                           : "Top Flip Fold: Layout is 7\" x 10\" (Portrait flat spread). Top half represents the Back Cover (Rotate assets 180°), bottom half represents the Front Cover (Portrait is recommended)."}
                       </span>
                     )}
                   </div>
                </div>

                {cardSize === 'Greeting Card' && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 border-t border-white/5">
                     <div>
                       <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Fold Configuration</label>
                       <div className="flex p-1 bg-black/20 rounded-lg border border-white/5">
                          <button 
                            onClick={() => setFoldType('side')}
                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${foldType === 'side' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                          >
                            Side Flip
                          </button>
                          <button 
                            onClick={() => setFoldType('top')}
                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${foldType === 'top' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                          >
                            Top Flip
                          </button>
                       </div>
                     </div>
                     <div className="p-3 bg-orange-600/10 border border-orange-500/20 rounded-xl">
                        <div className="flex items-center gap-2 text-orange-500 mb-1">
                           <ImageIcon className="w-3 h-3" />
                           <span className="text-[10px] font-bold uppercase">Orientation Guide</span>
                        </div>
                        <p className="text-[9px] text-gray-400 leading-relaxed">
                          {foldType === 'side' 
                            ? "For side-fold cards: The Front Cover is on the RIGHT side. The Back Cover is on the LEFT." 
                            : "For top-fold cards: The Front Cover is on the BOTTOM side. Rotate your Back Cover assets 180° on the TOP half."}
                        </p>
                     </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'layers' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pt-2">
                 <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block">Layers Hierarchy</label>
                 <div className="space-y-2">
                  {[...textLayers, ...imageLayers].map((layer) => (
                    <div 
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedLayerId === layer.id ? 'bg-orange-500/10 border-orange-500/50 text-white' : 'bg-white/5 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="p-1.5 rounded bg-black/40 text-gray-400">
                        {layer.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium truncate">
                          {layer.type === 'text' ? (layer as TextLayer).content : `Image Asset #${layer.id.slice(-4)}`}
                        </div>
                        <div className="text-[9px] text-gray-500 uppercase">{layer.type}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); }} className="p-1 hover:text-white"><ChevronRight className="w-3 h-3 -rotate-90" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="p-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  {(textLayers.length + imageLayers.length) === 0 && (
                    <div className="py-8 text-center text-gray-600 text-xs">No layers yet</div>
                  )}
                 </div>
              </motion.div>
            )}

            {activeTab === 'text' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pt-2">
                 <button 
                  onClick={addTextLayer}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition-all"
                 >
                   <Plus className="w-4 h-4" /> Add Text Layer
                 </button>

                 {selectedLayer?.type === 'text' && (
                   <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                     <div>
                       <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Content</label>
                       <textarea 
                        value={(selectedLayer as TextLayer).content}
                        onChange={(e) => updateTextLayer(selectedLayer.id, { content: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none h-20"
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Font Size</label>
                          <input 
                            type="number" 
                            value={(selectedLayer as TextLayer).fontSize}
                            onChange={(e) => updateTextLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Weight</label>
                          <select 
                            value={(selectedLayer as TextLayer).fontWeight}
                            onChange={(e) => updateTextLayer(selectedLayer.id, { fontWeight: e.target.value })}
                            className="w-full bg-[#1a1a1c] border border-white/10 rounded-lg px-1 py-1.5 text-xs text-white outline-none"
                          >
                            <option value="300">Light</option>
                            <option value="400">Regular</option>
                            <option value="600">Semibold</option>
                            <option value="800">Bold</option>
                          </select>
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={(selectedLayer as TextLayer).color}
                            onChange={(e) => updateTextLayer(selectedLayer.id, { color: e.target.value })}
                            className="h-8 w-12 bg-transparent border-none rounded cursor-pointer"
                          />
                          <input 
                            type="text" 
                            value={(selectedLayer as TextLayer).color}
                            onChange={(e) => updateTextLayer(selectedLayer.id, { color: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 text-xs text-white outline-none uppercase"
                          />
                        </div>
                     </div>
                   </div>
                 )}
              </motion.div>
            )}

            {activeTab === 'filters' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pt-2">
                 {selectedLayer?.type === 'image' ? (
                   <div className="space-y-4">
                     <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] text-gray-500 uppercase font-bold">Blending Mode</label>
                          <span className="text-[10px] text-gray-400 capitalize">{(selectedLayer as ImageLayer).blendMode}</span>
                        </div>
                        <select 
                          value={(selectedLayer as ImageLayer).blendMode}
                          onChange={(e) => updateImageLayer(selectedLayer.id, { blendMode: e.target.value as any })}
                          className="w-full bg-[#1a1a1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="multiply">Multiply</option>
                          <option value="screen">Screen</option>
                          <option value="overlay">Overlay</option>
                          <option value="darken">Darken</option>
                          <option value="lighten">Lighten</option>
                        </select>
                     </div>

                     {[
                       { key: 'brightness', label: 'Brightness', min: 0, max: 200, unit: '%' },
                       { key: 'contrast', label: 'Contrast', min: 0, max: 200, unit: '%' },
                       { key: 'saturation', label: 'Saturation', min: 0, max: 200, unit: '%' },
                       { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, unit: '%' },
                       { key: 'invert', label: 'Invert', min: 0, max: 100, unit: '%' },
                       { key: 'hueRotate', label: 'Hue Rotate', min: 0, max: 360, unit: '°' },
                       { key: 'blur', label: 'Blur', min: 0, max: 20, unit: 'px' },
                     ].map((filter) => (
                       <div key={filter.key}>
                         <div className="flex justify-between mb-1.5">
                           <label className="text-[10px] text-gray-500 uppercase font-bold">{filter.label}</label>
                           <span className="text-[10px] text-gray-400 font-mono">{(selectedLayer as ImageLayer).filters[filter.key as keyof ImageLayer['filters']]}{filter.unit}</span>
                         </div>
                         <input 
                          type="range"
                          min={filter.min}
                          max={filter.max}
                          value={(selectedLayer as ImageLayer).filters[filter.key as keyof ImageLayer['filters']]}
                          onChange={(e) => updateImageLayer(selectedLayer.id, { 
                            filters: { ...(selectedLayer as ImageLayer).filters, [filter.key]: Number(e.target.value) } 
                          })}
                          className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                         />
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="py-12 text-center text-gray-600 text-xs">Select an image layer to apply filters</div>
                 )}
              </motion.div>
            )}

            {activeTab === 'print' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pt-2">
                 <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Stock Paper Size</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {Object.keys(PAPER_PRESETS).map(p => (
                          <button
                            key={p}
                            onClick={() => setPaperSize(p)}
                            className={`flex justify-between items-center px-4 py-2.5 rounded-xl border text-xs transition-all ${
                              paperSize === p ? 'border-orange-500/50 bg-orange-500/10 text-white' : 'border-white/5 bg-white/5 text-gray-400'
                            }`}
                          >
                            <span>{p}</span>
                            <span className="text-[9px] opacity-60 font-mono">{PAPER_PRESETS[p].width}" x {PAPER_PRESETS[p].height}"</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Imposition Engine</label>
                      <div className="flex rounded-lg overflow-hidden border border-white/10 p-1 bg-black/20">
                         {['single', 'grid', 'custom'].map(mode => (
                           <button
                            key={mode}
                            onClick={() => setImpositionMode(mode as any)}
                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${
                              impositionMode === mode ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-400'
                            }`}
                           >
                             {mode}
                           </button>
                         ))}
                      </div>
                    </div>

                    {impositionMode === 'custom' && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                        <div>
                          <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Rows</label>
                          <input 
                            type="number" value={customGrid.rows} 
                            onChange={e => setCustomGrid({...customGrid, rows: Math.max(1, Number(e.target.value))})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Cols</label>
                          <input 
                            type="number" value={customGrid.cols} 
                            onChange={e => setCustomGrid({...customGrid, cols: Math.max(1, Number(e.target.value))})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Gap (Inches)</label>
                          <input 
                            type="number" step="0.01" value={customGrid.gap} 
                            onChange={e => setCustomGrid({...customGrid, gap: Number(e.target.value)})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <label className="flex items-center gap-3 cursor-pointer group">
                           <input type="checkbox" checked={showCropMarks} onChange={e => setShowCropMarks(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
                           <span className="text-xs group-hover:text-gray-200 transition-colors">Render Crop Marks</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                           <input type="checkbox" checked={showBleedGuides} onChange={e => setShowBleedGuides(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
                           <span className="text-xs group-hover:text-gray-200 transition-colors">Show Bleed Guides (0.125")</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                           <input type="checkbox" checked={showRegMarks} onChange={e => setShowRegMarks(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
                           <span className="text-xs group-hover:text-gray-200 transition-colors">Registration Crosshairs</span>
                        </label>
                        {impositionMode === 'grid' && (
                          <label className="flex items-center gap-3 cursor-pointer group mt-2 pt-2 border-t border-white/5">
                            <input type="checkbox" checked={autoRotate} onChange={e => setAutoRotate(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
                            <span className="text-xs group-hover:text-gray-200 transition-colors">Maximize Yield (Auto-Rotate)</span>
                          </label>
                        )}
                    </div>
                    
                    <button 
                      onClick={() => setIsPrintPreview(true)}
                      className="w-full py-4 mt-6 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-orange-600/20"
                    >
                      Process Imposition & Print
                    </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* --- Center Pane: Design Canvas --- */}
      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[#050505] relative overflow-hidden">
        {/* Dynamic Canvas Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
           <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(#222 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="z-10 flex flex-col items-center">
          <div className="mb-4 flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-gray-500 font-mono tracking-tight bg-white/5 px-2 py-1 rounded border border-white/5">
                {cardWidthIn}" x {cardHeightIn}" @ 96DPI
              </span>
              {selectedLayer && (
                <div className="flex items-center gap-3 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
                  <span className="text-[10px] text-orange-400 font-bold uppercase">Active: {selectedLayer.type}</span>
                  <button onClick={() => setSelectedLayerId(null)} className="text-orange-400 hover:text-white"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          </div>

          <div className="relative group perspective-1000">
             <div className="absolute -inset-1 border border-orange-500/20 rounded-lg blur-xl opacity-0 group-hover:opacity-10 dark:opacity-20 transition-opacity" />
             <div className="relative border border-white/10 rounded-lg shadow-2xl p-4 bg-[#111] backdrop-blur-xl">
               <CardPreview scale={1} />
             </div>
          </div>

          <div className="mt-8 flex gap-4">
             <div className="flex items-center gap-1 bg-[#1a1a1c] p-1 rounded-lg border border-white/5">
                <button className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
                <div className="px-2 text-[10px] font-mono text-gray-500">100%</div>
                <button className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors"><RotateCw className="w-3.5 h-3.5 opacity-40" /></button>
             </div>
          </div>
        </div>

      {/* Global Toolbar overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#151619]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-8 shadow-2xl">
         <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => setActiveTab('assets')}>
            <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
            <span className="text-[8px] uppercase font-bold tracking-widest text-gray-600 group-hover:text-gray-400">Media</span>
         </div>
         <div className="h-6 w-[1px] bg-white/10" />
         <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={addTextLayer}>
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
            <span className="text-[8px] uppercase font-bold tracking-widest text-gray-600 group-hover:text-gray-400">Add Layer</span>
         </div>
         <div className="h-6 w-[1px] bg-white/10" />
         <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => setIsPrintPreview(true)}>
            <Printer className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
            <span className="text-[8px] uppercase font-bold tracking-widest text-gray-600 group-hover:text-gray-400">Print</span>
         </div>
      </div>

      {/* PDF Page Selector Modal */}
      <AnimatePresence>
        {pdfPages.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
          >
            <div className="w-full max-w-5xl h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                 <div>
                   <h2 className="text-2xl font-bold text-white mb-2 underline decoration-orange-500 underline-offset-8">Select PDF Page</h2>
                   <p className="text-gray-500 text-sm">Source: {pdfFile?.name}</p>
                 </div>
                 <button onClick={() => { setPdfPages([]); setPdfFile(null); }} className="p-3 bg-white/5 rounded-full hover:bg-white/10 text-white">
                   <X className="w-6 h-6" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-orange-500/50">
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
                    {pdfPages.map((src, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => selectPdfPage(src)}
                        className="group relative cursor-pointer border border-white/5 rounded-xl overflow-hidden hover:border-orange-500/50 transition-all bg-white/5"
                      >
                         <img src={src} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                         <div className="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/10 transition-colors flex items-center justify-center">
                            <Plus className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300" />
                         </div>
                         <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white">
                           PAGE {idx + 1}
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* --- Right Pane: Template Mgmt & Layer Details --- */}
      <div className="w-80 h-full border-l border-white/10 flex flex-col bg-[#0a0a0b]">
        {selectedLayer ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Transform Engine</h2>
              <button 
                onClick={() => setSelectedLayerId(null)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Common Transforms */}
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Pos X (%)</label>
                      <input 
                        type="number" 
                        value={selectedLayer.x}
                        onChange={(e) => selectedLayer.type === 'image' ? updateImageLayer(selectedLayer.id, { x: Number(e.target.value) }) : updateTextLayer(selectedLayer.id, { x: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Pos Y (%)</label>
                      <input 
                        type="number" 
                        value={selectedLayer.y}
                        onChange={(e) => selectedLayer.type === 'image' ? updateImageLayer(selectedLayer.id, { y: Number(e.target.value) }) : updateTextLayer(selectedLayer.id, { y: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Rotation</label>
                      <span className="text-[10px] text-gray-400 font-mono">{selectedLayer.rotation}°</span>
                    </div>
                    <input 
                      type="range" min="0" max="360" value={selectedLayer.rotation}
                      onChange={(e) => selectedLayer.type === 'image' ? updateImageLayer(selectedLayer.id, { rotation: Number(e.target.value) }) : updateTextLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                      className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                 </div>

                 {selectedLayer.type === 'image' && (
                    <>
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <label className="text-[10px] text-gray-500 uppercase font-bold">Scaling</label>
                          <span className="text-[10px] text-gray-400 font-mono">{(selectedLayer as ImageLayer).scale.toFixed(2)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="5" step="0.1" value={(selectedLayer as ImageLayer).scale}
                          onChange={(e) => updateImageLayer(selectedLayer.id, { scale: Number(e.target.value), fit: 'custom' })}
                          className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Canvas Bounds</label>
                        <div className="flex gap-2 p-1 bg-black/20 rounded-lg border border-white/5">
                           {['fit', 'fill', 'custom'].map(m => (
                             <button
                              key={m}
                              onClick={() => updateImageLayer(selectedLayer.id, { fit: m as any })}
                              className={`flex-1 py-1 text-[9px] uppercase font-bold rounded capitalize ${
                                (selectedLayer as ImageLayer).fit === m ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-400'
                              }`}
                             >
                               {m}
                             </button>
                           ))}
                        </div>
                      </div>
                    </>
                 )}

                 {cardSize === 'Greeting Card' && (
                    <div className="animate-in fade-in slide-in-from-top-2 p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                      <label className="text-[10px] text-gray-400 uppercase font-bold block">Cover Allocation (Divided Canvas)</label>
                      <div className="flex gap-2 p-1 bg-black/20 rounded-lg border border-white/5">
                        {[
                          { key: 'all', label: 'Full Spread' },
                          { key: 'front', label: 'Front Cover' },
                          { key: 'back', label: 'Back Cover' }
                        ].map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => selectedLayer.type === 'image' 
                              ? updateImageLayer(selectedLayer.id, { panel: opt.key as any }) 
                              : updateTextLayer(selectedLayer.id, { panel: opt.key as any })}
                            className={`flex-1 py-1 text-[9px] uppercase font-bold rounded ${
                              (selectedLayer.panel || 'all') === opt.key ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-gray-400 leading-relaxed font-sans font-medium">
                        Fit the layer securely inside a single side cover context. Back covers are rendered on the Left (Side fold) or Top (Top fold).
                      </p>
                    </div>
                 )}

                 <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Opacity</label>
                      <span className="text-[10px] text-gray-400 font-mono">{selectedLayer.opacity}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={selectedLayer.opacity}
                      onChange={(e) => selectedLayer.type === 'image' ? updateImageLayer(selectedLayer.id, { opacity: Number(e.target.value) }) : updateTextLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                      className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                 </div>
              </div>
              
              {/* Text Specific FX */}
              {selectedLayer.type === 'text' && (
                <div className="pt-6 border-t border-white/5 space-y-4">
                   <h3 className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Advanced FX</h3>
                   <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Text Stroke</label>
                      <div className="flex gap-4">
                        <input 
                          type="color" value={(selectedLayer as TextLayer).strokeColor} 
                          onChange={(e) => updateTextLayer(selectedLayer.id, { strokeColor: e.target.value })}
                          className="w-10 h-8 bg-transparent border-none p-0 cursor-pointer"
                        />
                        <input 
                          type="range" min="0" max="10" step="1" value={(selectedLayer as TextLayer).strokeWidth}
                          onChange={(e) => updateTextLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) })}
                          className="flex-1 accent-orange-500 h-1 mt-3.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Drop Shadow</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          type="color" value={(selectedLayer as TextLayer).shadowColor} 
                          onChange={(e) => updateTextLayer(selectedLayer.id, { shadowColor: e.target.value })}
                          className="w-full h-8 bg-transparent border-none p-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] text-gray-500">Blur:</span>
                           <input 
                              type="number" value={(selectedLayer as TextLayer).shadowBlur}
                              onChange={(e) => updateTextLayer(selectedLayer.id, { shadowBlur: Number(e.target.value) })}
                              className="w-full bg-white/5 border border-white/10 rounded px-1 text-[10px] text-white"
                           />
                        </div>
                      </div>
                   </div>
                </div>
              )}

              <button 
                onClick={() => deleteLayer(selectedLayer.id)}
                className="w-full py-3 mt-8 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] uppercase font-bold transition-all"
              >
                Permanently Delete Layer
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Template Browser</h2>
              <div className="flex gap-2">
                 <button 
                  onClick={handleSaveTemplate} 
                  title="Save Current Design"
                  className="p-1.5 bg-orange-600 rounded text-white hover:bg-orange-700"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                 <button 
                  onClick={handleExportTemplates}
                  title="Export Templates (JSON)"
                  className="p-1.5 bg-white/5 rounded text-gray-400 hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                 <label 
                  title="Import Templates (JSON)"
                  className="p-1.5 bg-white/5 rounded text-gray-400 hover:text-white cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input type="file" accept=".json" className="hidden" onChange={handleImportTemplates} />
                </label>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
               {templates.map((t) => (
                 <div key={t.id} className="group p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-orange-500/30 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                       <span className="text-xs font-medium text-white truncate pr-2">{t.name}</span>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {
                            saveTemplates(templates.filter(item => item.id !== t.id));
                          }} className="p-1 text-gray-500 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                       </div>
                    </div>
                    <div className="flex gap-2 mb-4">
                       <div className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase font-bold">{(t.cardSize)}</div>
                       <div className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase font-bold">{t.imageLayers.length + t.textLayers.length} LYRS</div>
                    </div>
                    <button 
                      onClick={() => {
                        setCardSize(t.cardSize);
                        setIsPortrait(t.isPortrait);
                        setImageLayers(t.imageLayers);
                        setTextLayers(t.textLayers);
                        setTemplateName(t.name);
                      }}
                      className="w-full py-2 bg-orange-500/10 text-orange-500 rounded-lg text-[10px] font-bold uppercase transition-all hover:bg-orange-500 hover:text-white"
                    >
                      Restore Design
                    </button>
                 </div>
               ))}
               
               {templates.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                       <Save className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-500 max-w-[160px]">No saved states found. Click the save icon to store your progress.</p>
                 </div>
               )}
            </div>

            <div className="p-4 border-t border-white/10 bg-[#050505]">
               <div className="text-[10px] text-gray-500 uppercase font-bold mb-4">Storage Metrics</div>
               <div className="flex items-center justify-between text-[11px] mb-1">
                  <span>Persistence API</span>
                  <span className="text-green-500">Browser/Local</span>
               </div>
               <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-600 w-1/4" />
               </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
