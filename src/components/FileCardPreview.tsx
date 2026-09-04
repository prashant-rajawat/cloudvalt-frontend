import React, { useState, useEffect, useRef } from "react";
import { FileItem, FolderItem } from "../types/index.js";
import { fetchSignedDownloadUrl } from "../lib/api.js";
import {
  Image as ImageIcon,
  Film,
  Music,
  Play,
  Loader2,
  Folder,
  File,
  FileText
} from "lucide-react";

interface FileCardPreviewProps {
  item: FileItem | FolderItem;
  type: "file" | "folder";
  authToken: string;
}

export function FileCardPreview({ item, type, authToken }: FileCardPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy loading using IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Fetch file resource (image, video, text) only when visible
  useEffect(() => {
    if (!isVisible || type === "folder") return;

    const file = item as FileItem;
    const isImage = file.category === "image" || (file.mimeType && file.mimeType.startsWith("image/"));
    const isVideo = file.category === "video" || (file.mimeType && file.mimeType.startsWith("video/"));
    const ext = file.extension?.toLowerCase() || "";
    const isText = ["txt", "json", "js", "ts", "jsx", "tsx", "css", "html", "py", "sh", "md", "sql", "xml", "yaml", "yml"].includes(ext);

    // If file already has a direct publicUrl or thumbnailUrl, use it
    if (file.thumbnailUrl) {
      setUrl(file.thumbnailUrl);
      return;
    }
    if (file.publicUrl && isImage) {
      setUrl(file.publicUrl);
      return;
    }

    if (!isImage && !isVideo && !isText) return;

    setLoading(true);
    fetchSignedDownloadUrl(authToken, file.storagePath)
      .then(async (res) => {
        if (res.success && res.signedUrl) {
          setUrl(res.signedUrl);

          // For text/code files, load a small snippet for realistic card preview
          if (isText && file.sizeBytes < 500 * 1024) {
            try {
              const textRes = await fetch(res.signedUrl);
              if (textRes.ok) {
                const text = await textRes.text();
                setTextContent(text.slice(0, 250));
              }
            } catch (err) {
              console.error("Failed to read text file contents", err);
            }
          }
        } else {
          setUrl(`/api/storage/stream?path=${encodeURIComponent(file.storagePath)}`);
        }
      })
      .catch((err) => {
        console.warn("Signed URL fetch fallback to stream endpoint", err);
        setUrl(`/api/storage/stream?path=${encodeURIComponent(file.storagePath)}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isVisible, item.id, type, authToken]);

  // 1. FOLDER PREVIEW
  if (type === "folder") {
    const folder = item as FolderItem;
    const folderColor = folder.color || "blue";

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-center bg-blue-50/40 relative overflow-hidden select-none transition-colors p-4"
      >
        {/* Large Folder Illustration matching reference */}
        <div className="relative w-20 h-16 transition-transform duration-300 group-hover:scale-105 flex items-center justify-center">
          {/* Back tab */}
          <div className="absolute top-0 left-2 w-8 h-4 bg-blue-400 rounded-t-md" />
          {/* Main folder body */}
          <div className="absolute top-2 inset-x-0 bottom-0 bg-blue-500 rounded-xl shadow-md flex items-center justify-center overflow-hidden border border-blue-400">
            {/* Folder shine gradient */}
            <div className="w-full h-full bg-gradient-to-tr from-blue-600/30 via-transparent to-white/20" />
          </div>
        </div>
      </div>
    );
  }

  const file = item as FileItem;
  const extension = file.extension?.toLowerCase() || "";
  const isImage = file.category === "image" || (file.mimeType && file.mimeType.startsWith("image/"));
  const isVideo = file.category === "video" || (file.mimeType && file.mimeType.startsWith("video/"));

  // 2. IMAGE PREVIEW (Png, Jpg, Webp, Gif, Svg, etc.) - Edge to edge
  if (isImage) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-100 overflow-hidden relative flex items-center justify-center"
      >
        {url && !error ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-slate-300" />
              </div>
            )}
            <img
              src={url}
              alt={file.name}
              onLoad={() => setImgLoaded(true)}
              onError={() => setError(true)}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-[10px] font-medium text-slate-400">Loading image...</span>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 flex flex-col items-center justify-center text-slate-400 gap-1">
            <ImageIcon className="w-10 h-10 text-slate-300" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {extension || "IMAGE"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. VIDEO PREVIEW (MP4, WebM, MOV, AVI, MKV)
  if (isVideo) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-900 overflow-hidden relative flex items-center justify-center group/video"
      >
        {url && !error ? (
          <video
            src={url}
            className="w-full h-full object-cover opacity-80"
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center">
            <Film className="w-12 h-12 text-slate-600" />
          </div>
        )}

        {/* Centered Circular Play Button matching reference */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xs border border-white/60 text-white shadow-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110">
            <Play className="w-5 h-5 fill-white ml-0.5 text-white" />
          </div>
        </div>

        {/* Duration / Format Tag in Bottom-Right Corner */}
        <div className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-semibold text-white tracking-wider">
          02:14
        </div>
      </div>
    );
  }

  // 4. PDF DOCUMENT PREVIEW - Professional Google Drive-style PDF tile with centered red PDF logo
  if (extension === "pdf") {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-gradient-to-b from-red-50/25 via-slate-50/70 to-slate-100/50 p-3 flex items-center justify-center relative select-none"
      >
        {/* Document Sheet Shape with subtle shadow, border, and dog-ear corner */}
        <div className="w-[82px] h-[104px] sm:w-[94px] sm:h-[116px] bg-white rounded-lg shadow-sm border border-slate-200/90 flex flex-col items-center justify-center relative overflow-hidden transition-transform duration-200 group-hover:scale-[1.03]">
          {/* Top-right folded dog-ear corner */}
          <div className="absolute top-0 right-0 w-4 h-4 bg-slate-100/90 border-b border-l border-slate-200 rounded-bl-sm pointer-events-none" />

          {/* Centered Large Red PDF Document Icon & Bold PDF Label */}
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-500 via-red-600 to-rose-600 text-white flex flex-col items-center justify-center shadow-md shadow-red-500/20 border border-red-400/30">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.2]" />
              <span className="text-[9px] sm:text-[10px] font-black tracking-wider leading-none mt-0.5 text-white uppercase">
                PDF
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. MICROSOFT WORD DOCUMENTS (DOC, DOCX, RTF) - matching reference meeting-notes.docx
  if (["docx", "doc", "rtf", "odt"].includes(extension)) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-100/60 p-3 flex items-center justify-center relative select-none"
      >
        {/* Document Page Sheet */}
        <div className="w-[76%] h-[90%] bg-white rounded-md shadow-xs border border-slate-200/90 p-3.5 flex flex-col justify-between relative overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
          {/* Top Bar with blue W badge */}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-xs bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
              W
            </div>
          </div>

          {/* Document Title & Lines */}
          <div className="space-y-1.5 my-auto">
            <h4 className="text-[10px] font-bold text-slate-800 leading-tight">
              Meeting Notes
            </h4>
            <p className="text-[7.5px] text-slate-400 font-medium leading-tight">
              Team Sync - June 2025
            </p>
            <div className="space-y-1 pt-1.5">
              <div className="h-1 w-full bg-slate-200/80 rounded-full" />
              <div className="h-1 w-5/6 bg-slate-200/80 rounded-full" />
              <div className="h-1 w-4/6 bg-slate-200/80 rounded-full" />
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[7px] text-slate-300">
            <span>Draft</span>
            <span>CloudVault</span>
          </div>
        </div>
      </div>
    );
  }

  // 6. EXCEL SPREADSHEETS (XLS, XLSX, CSV, TSV) - matching reference sales-report.xlsx
  if (["xlsx", "xls", "csv", "tsv", "ods"].includes(extension)) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-100/60 p-3 flex items-center justify-center relative select-none"
      >
        {/* Spreadsheet Sheet Grid */}
        <div className="w-[82%] h-[90%] bg-white rounded-md shadow-xs border border-slate-200/90 p-2.5 flex flex-col justify-between overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
          {/* Top Bar with green X badge */}
          <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
            <div className="w-4 h-4 rounded-xs bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
              X
            </div>
            <span className="text-[9px] font-bold text-slate-800">Q3 Sales Report</span>
          </div>

          {/* Grid + mini chart */}
          <div className="flex items-center justify-between my-auto gap-2">
            {/* Rows simulation */}
            <div className="space-y-1 flex-1">
              <div className="h-1 w-full bg-slate-200/80 rounded-full" />
              <div className="h-1 w-4/5 bg-slate-200/80 rounded-full" />
              <div className="h-1 w-full bg-slate-200/80 rounded-full" />
              <div className="h-1 w-3/4 bg-slate-200/80 rounded-full" />
            </div>

            {/* Mini bar chart graphic matching reference */}
            <div className="w-11 h-8 bg-blue-50/50 rounded flex items-end justify-center gap-0.5 p-1 border border-blue-100/60 shrink-0">
              <div className="w-1.5 h-3 bg-blue-400 rounded-t-xs" />
              <div className="w-1.5 h-5 bg-blue-500 rounded-t-xs" />
              <div className="w-1.5 h-6 bg-blue-600 rounded-t-xs" />
              <div className="w-1.5 h-4 bg-blue-400 rounded-t-xs" />
            </div>
          </div>

          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[7px] text-slate-400">
            <span>Summary</span>
            <span className="text-emerald-600 font-semibold">Active</span>
          </div>
        </div>
      </div>
    );
  }

  // 7. POWERPOINT PRESENTATIONS (PPT, PPTX, KEY)
  if (["pptx", "ppt", "key", "odp"].includes(extension)) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-100/60 p-3 flex items-center justify-center relative select-none"
      >
        {/* Presentation Slide Canvas */}
        <div className="w-[84%] aspect-[16/10] bg-white rounded-md shadow-xs border border-amber-200/80 p-2.5 flex flex-col justify-between overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
          {/* Top Slide Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-xs bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                P
              </div>
              <span className="text-[9px] font-bold text-slate-800 truncate">Presentation</span>
            </div>
            <span className="text-[7.5px] font-semibold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">Slide 1</span>
          </div>

          {/* Slide Body Content */}
          <div className="space-y-1 my-auto">
            <div className="h-1.5 w-3/4 bg-amber-400/80 rounded-full" />
            <div className="h-1 w-full bg-slate-200/70 rounded-full" />
            <div className="h-1 w-4/5 bg-slate-200/70 rounded-full" />
          </div>

          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[7px] text-slate-400">
            <span>Deck</span>
            <span>CloudVault</span>
          </div>
        </div>
      </div>
    );
  }

  // 8. AUDIO FILES (MP3, WAV, AAC, M4A, FLAC, OGG) - matching reference song.mp3
  if (file.category === "audio" || ["mp3", "wav", "m4a", "aac", "flac", "ogg", "wma"].includes(extension)) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-gradient-to-b from-purple-50/90 via-purple-50/60 to-indigo-50/80 flex flex-col items-center justify-between p-3.5 relative select-none overflow-hidden"
      >
        {/* Centered circular purple music note icon */}
        <div className="w-9 h-9 rounded-full bg-purple-200/80 text-purple-600 flex items-center justify-center shadow-xs mt-1 transition-transform duration-200 group-hover:scale-105">
          <Music className="w-4 h-4 fill-purple-600" />
        </div>

        {/* Purple Audio Waveform Equalizer */}
        <div className="flex items-center justify-center gap-0.5 w-full my-auto px-2 text-purple-400">
          <div className="h-2 w-0.5 bg-purple-300 rounded-full" />
          <div className="h-3 w-0.5 bg-purple-400 rounded-full" />
          <div className="h-5 w-0.5 bg-purple-500 rounded-full" />
          <div className="h-7 w-0.5 bg-purple-600 rounded-full" />
          <div className="h-4 w-0.5 bg-purple-400 rounded-full" />
          <div className="h-6 w-0.5 bg-purple-500 rounded-full" />
          <div className="h-8 w-0.5 bg-purple-600 rounded-full" />
          <div className="h-5 w-0.5 bg-purple-500 rounded-full" />
          <div className="h-7 w-0.5 bg-purple-600 rounded-full" />
          <div className="h-4 w-0.5 bg-purple-400 rounded-full" />
          <div className="h-6 w-0.5 bg-purple-500 rounded-full" />
          <div className="h-8 w-0.5 bg-purple-600 rounded-full" />
          <div className="h-5 w-0.5 bg-purple-500 rounded-full" />
          <div className="h-3 w-0.5 bg-purple-400 rounded-full" />
          <div className="h-2 w-0.5 bg-purple-300 rounded-full" />
        </div>

        {/* Timestamps in bottom row matching reference */}
        <div className="w-full flex items-center justify-between text-[9px] text-slate-500 font-medium px-1">
          <span>0:00</span>
          <span>3:45</span>
        </div>
      </div>
    );
  }

  // 9. ARCHIVE FILES (ZIP, RAR, 7Z, TAR, GZ) - matching reference backup.zip
  if (file.category === "archive" || ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(extension)) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-100/60 flex flex-col items-center justify-center p-3 relative select-none"
      >
        {/* Warm yellow/amber document with zipper and ZIP text matching reference */}
        <div className="relative w-16 h-20 bg-amber-400 rounded-lg shadow-sm flex flex-col items-center justify-between p-1.5 transition-transform duration-200 group-hover:scale-105 border border-amber-300">
          {/* Folded top-right corner */}
          <div className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-bl-md rounded-tr-lg border-b border-l border-amber-300/60" />

          {/* Zipper teeth vertical illustration */}
          <div className="w-2.5 py-1 flex flex-col items-center gap-0.5">
            <div className="w-2 h-1 bg-amber-600 rounded-xs" />
            <div className="w-1.5 h-1 bg-amber-700 rounded-xs" />
            <div className="w-2 h-1 bg-amber-600 rounded-xs" />
            <div className="w-1.5 h-1 bg-amber-700 rounded-xs" />
          </div>

          {/* Bold ZIP text */}
          <span className="text-[12px] font-black text-amber-900 tracking-wider">
            ZIP
          </span>

          <div className="w-full h-1 bg-amber-500/40 rounded-full" />
        </div>
      </div>
    );
  }

  // 10. TEXT & CODE FILES
  const isCodeOrText = ["txt", "json", "js", "ts", "jsx", "tsx", "css", "html", "py", "sh", "md", "sql", "xml", "yaml", "yml"].includes(extension);

  if (isCodeOrText) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-900 p-2.5 flex items-center justify-center relative select-none font-mono text-[9px] overflow-hidden"
      >
        <div className="w-[90%] h-[90%] bg-slate-950 rounded-md border border-slate-800 p-2 flex flex-col justify-between overflow-hidden shadow-xs">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1 mb-1">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500/80" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              {extension || "CODE"}
            </span>
          </div>

          {/* Snippet / Code Lines */}
          <div className="flex-1 overflow-hidden text-[8px] leading-relaxed text-slate-300 opacity-90 select-none">
            {textContent ? (
              <pre className="whitespace-pre-wrap break-all line-clamp-3 font-mono opacity-85">
                {textContent}
              </pre>
            ) : (
              <div className="space-y-0.5">
                <div className="text-indigo-400">import <span className="text-blue-300">&#123; createVault &#125;</span></div>
                <div className="text-emerald-400">export default <span className="text-amber-300">config</span></div>
                <div className="text-slate-500">// file contents...</div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800/80 pt-0.5 flex items-center justify-between text-[7px] text-slate-500">
            <span>UTF-8</span>
            <span>Source</span>
          </div>
        </div>
      </div>
    );
  }

  // 11. GENERIC FALLBACK
  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-100/60 p-3 flex items-center justify-center relative select-none"
    >
      <div className="w-[76%] h-[90%] bg-white rounded-md shadow-xs border border-slate-200/90 p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
            <File className="w-3 h-3" />
          </div>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{extension || "FILE"}</span>
        </div>
        <div className="space-y-1.5 my-auto">
          <div className="h-1.5 w-3/4 bg-slate-300/60 rounded-full" />
          <div className="h-1 w-full bg-slate-200/60 rounded-full" />
          <div className="h-1 w-2/3 bg-slate-200/60 rounded-full" />
        </div>
        <div className="pt-1 border-t border-slate-100 text-[7px] text-slate-400 font-medium">
          File Resource
        </div>
      </div>
    </div>
  );
}
