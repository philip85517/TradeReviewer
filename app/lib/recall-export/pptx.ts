import type PptxGenJS from 'pptxgenjs';
import { RecallExportError } from './manifest';
import { pptxText, type RecallPptxManifest } from './pptx-manifest';

const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const FONT = 'Microsoft YaHei';
const COLORS = { background: '0F172A', foreground: 'E8EDF6', muted: 'ACBBD0', blue: '77B7FF', gold: 'EBC477', grid: '334155' };

function pngSize(data: string) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(data)) throw new RecallExportError('PPTX 仅接受内嵌 PNG 留存图片');
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), char => char.charCodeAt(0)); }
    catch { throw new RecallExportError('留存 PNG 数据无效'); }
    if (bytes.length < 33 || [137, 80, 78, 71, 13, 10, 26, 10].some((byte, index) => bytes[index] !== byte)) throw new RecallExportError('留存 PNG 数据无效');
    const view = new DataView(bytes.buffer);
    let offset = 8; let ended = false;
    while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset); const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
        if (offset + length + 12 > bytes.length) throw new RecallExportError('留存 PNG 不完整');
        if (type === 'IEND') { ended = length === 0 && offset + 12 === bytes.length; break; }
        offset += length + 12;
    }
    const width = view.getUint32(16); const height = view.getUint32(20);
    if (!ended || !width || !height) throw new RecallExportError('留存 PNG 尺寸或结尾无效');
    return { width, height };
}
function wrap(text: string, units: number): string[] {
    const output: string[] = []; let line = ''; let size = 0;
    for (const character of pptxText(text)) {
        const weight = /[\u0000-\u00ff]/.test(character) ? 0.55 : 1;
        if (character === '\n' || size + weight > units) { output.push(line); line = ''; size = 0; if (character === '\n') continue; }
        line += character; size += weight;
    }
    output.push(line); return output;
}
/** Fixed readable type; split content into bounded rows/pages instead of shrinking. */
export function paginateRecallPptxRows(rows: string[][], columns: number[]) {
    const pages: { rows: string[][]; heights: number[] }[] = [];
    let page = { rows: [] as string[][], heights: [] as number[] }; let height = 0;
    for (const row of rows) {
        const lines = row.map((cell, index) => wrap(cell, Math.floor((columns[index] - 0.24) * 72 / 18)));
        const count = Math.max(...lines.map(cell => cell.length));
        for (let offset = 0; offset < count; offset += 3) {
            const lineCount = Math.min(3, count - offset); const rowHeight = 0.18 + lineCount * 0.29;
            if (page.rows.length && height + rowHeight > 5.05) { pages.push(page); page = { rows: [], heights: [] }; height = 0; }
            page.rows.push(lines.map(cell => cell.slice(offset, offset + 3).join('\n'))); page.heights.push(rowHeight); height += rowHeight;
        }
    }
    if (page.rows.length) pages.push(page);
    return pages;
}
function provenance(manifest: RecallPptxManifest) {
    const reference = (bundle: RecallPptxManifest['summary']['bundle']) => bundle ? {
        bundleId: bundle.id, captureRevision: bundle.documentRevision, evidenceDigest: bundle.executionEvidence.digest,
        planVersionIds: bundle.planVersionIds, riskBaselineIds: bundle.riskBaselineIds, evaluationRevisionIds: bundle.evaluationRevisionIds ?? null,
        manualEvaluationRevisionIds: bundle.manualEvaluationRevisionIds ?? null,
        metricMethodVersion: bundle.actualMetrics?.methodVersion ?? null, metricSource: bundle.actualMetrics?.source ?? null,
        captureContext: bundle.captureContext,
    } : null;
    return { version: manifest.version, source: manifest.source, documentRevision: manifest.documentRevision, episodeId: manifest.episodeId, generatedAt: manifest.generatedAt,
        stages: manifest.stages.map(stage => ({ phase: stage.phase, snapshotId: stage.snapshot?.id ?? null, reference: reference(stage.bundle), warnings: stage.warnings })),
        summary: { snapshotId: manifest.summary.snapshotId, reference: reference(manifest.summary.bundle) },
        texts: manifest.texts.map(({ text: _text, ...entry }) => { void _text; return entry; }) };
}

/** The heavy generator is imported only for an explicit export action. */
export async function createRecallPptxBlob(manifest: RecallPptxManifest): Promise<Blob> {
    // Validate all images before doing any rendering or download side effects.
    const sizes = manifest.stages.map(stage => stage.snapshot ? pngSize(stage.snapshot.imageDataUrl) : null);
    const { default: Pptx } = await import('pptxgenjs');
    const deck = new Pptx();
    deck.layout = 'LAYOUT_WIDE'; deck.author = 'TradeReview'; deck.subject = '已留存复盘成果'; deck.title = '三阶段交易复盘';
    deck.theme = { headFontFace: FONT, bodyFontFace: FONT };
    let slideNumber = 0;
    const source = manifest.source === 'completed' ? '上次完成版本' : '已留存草稿 · 不含当前未留存编辑';
    function slide(title: string, subtitle = source): PptxGenJS.Slide {
        const current = deck.addSlide(); current.background = { color: COLORS.background };
        current.addText(pptxText(title), { x: 0.55, y: 0.32, w: 12.2, h: 0.48, fontFace: FONT, fontSize: 27, bold: true, color: COLORS.foreground, margin: 0, breakLine: false });
        current.addText(pptxText(subtitle), { x: 0.55, y: 0.9, w: 12.2, h: 0.36, fontFace: FONT, fontSize: 14, color: COLORS.muted, margin: 0 });
        current.addText(String(++slideNumber), { x: 12.1, y: 7.08, w: 0.6, h: 0.2, fontSize: 11, color: COLORS.muted, align: 'right', margin: 0 });
        return current;
    }
    for (const [index, stage] of manifest.stages.entries()) {
        const current = slide(stage.title, stage.snapshot ? `${source} · ${stage.snapshot.timeframe} · 截止 ${stage.snapshot.cursor}` : source);
        const size = sizes[index];
        if (stage.snapshot && size) {
            const scale = Math.min(12.23 / size.width, 5.3 / size.height); const width = size.width * scale; const height = size.height * scale;
            current.addImage({ data: stage.snapshot.imageDataUrl, x: (13.333333 - width) / 2, y: 1.35 + (5.3 - height) / 2, w: width, h: height, altText: `${stage.title} / ${stage.snapshot.id}` });
        } else current.addText('该阶段尚无已留存快照\n未以其他阶段图片替代', { x: 1.0, y: 3, w: 11.3, h: 1.0, fontSize: 24, color: COLORS.gold, align: 'center', margin: 0 });
        const warning = stage.bundle ? (stage.warnings.length ? '历史构图差异保留，详见备注' : `留存修订 ${stage.bundle.documentRevision}`) : '结构化版本未知；保留原图';
        current.addText(warning, { x: 0.55, y: 6.78, w: 11.6, h: 0.3, fontSize: 14, color: COLORS.gold, margin: 0 });
        current.addNotes(pptxText(JSON.stringify({ phase: stage.phase, snapshotId: stage.snapshot?.id ?? null, bundleId: stage.bundle?.id ?? null, warnings: stage.warnings })));
    }
    function tables(title: string, rows: string[][], headers: string[], widths: number[]) {
        for (const [index, page] of paginateRecallPptxRows(rows, widths).entries()) {
            const current = slide(index === 0 ? title : `${title} · 续 ${index + 1}`);
            const tableRows: PptxGenJS.TableRow[] = [headers.map(text => ({ text, options: { bold: true, color: COLORS.blue, fill: { color: COLORS.background } } })), ...page.rows.map(row => row.map(text => ({ text: pptxText(text) })))];
            current.addTable(tableRows, { x: 0.55, y: 1.4, w: 12.23, colW: widths, rowH: [0.45, ...page.heights], fontFace: FONT, fontSize: 18, color: COLORS.foreground, fill: { color: COLORS.background },
                border: { type: 'solid', color: COLORS.grid, pt: 0.6 }, margin: [0.06, 0.08, 0.06, 0.08], valign: 'middle', autoPage: false });
            current.addNotes(pptxText(`TRADEREVIEW_FROZEN_MANIFEST\n${JSON.stringify(provenance(manifest))}`));
        }
    }
    tables('交易总结表', manifest.summary.rows, ['项目', '已留存计划', '实际 / 评价'], [2.15, 4.65, 5.43]);
    if (manifest.summary.details.length) tables('交易明细与口径', manifest.summary.details, ['项目 / 来源', '已留存明细'], [3.1, 9.13]);
    if (manifest.texts.length) tables('图上文字 · 稳定身份去重', manifest.texts.map(entry => [`${entry.drawingId}\n修订 ${entry.revision.startsWith('legacy:') ? '旧版' : entry.revision}\n归属 ${entry.ownerId}`, entry.text]), ['来源', '可编辑文字'], [3.1, 9.13]);
    const data = await deck.write({ outputType: 'arraybuffer', compression: true });
    if (!(data instanceof ArrayBuffer)) throw new RecallExportError('PPTX 生成器未返回有效文件');
    // PptxGenJS 4 declares one slide master per slide but emits a shared master.
    // Remove only its dangling master declarations; retain every actual part.
    const { default: JSZip } = await import('jszip');
    const archive = await JSZip.loadAsync(data);
    const contentTypes = archive.file('[Content_Types].xml');
    if (!contentTypes) throw new RecallExportError('PPTX 缺少内容类型清单');
    const xml = await contentTypes.async('string');
    const corrected = xml.replace(/<Override\b[^>]*\bPartName="(\/ppt\/slideMasters\/slideMaster\d+\.xml)"[^>]*\/>/g,
        (declaration, path: string) => archive.file(path.slice(1)) ? declaration : '');
    if (corrected === xml) return new Blob([data], { type: MIME });
    archive.file('[Content_Types].xml', corrected);
    return new Blob([await archive.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })], { type: MIME });
}
