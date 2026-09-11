import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const editorSource = readFileSync(new URL('../ui-editors.js', import.meta.url), 'utf8');

describe('stock module editor live preview', () => {
    it('adds the custom-module style testing sandbox and floating preview', () => {
        expect(editorSource).toContain('id="rt_pe_template"');
        expect(editorSource).toContain('id="rt_pe_preview"');
        expect(editorSource).toContain('id="rt_pe_preview_header"');
        expect(editorSource).toContain('id="rt_pe_preview_view"');
        expect(editorSource).toContain('UI 实时预览');
    });

    it('renders sandbox changes through the normal stock-card renderer', () => {
        expect(editorSource).toContain('buildStockModulePreviewMemo(templateEl.value, blockTag)');
        expect(editorSource).toContain('renderMemoAsCards(previewMemo, blockTag.toUpperCase(), _sectionPages)');
        expect(editorSource).toContain('templateEl.oninput = schedulePreview');
    });

    it('keeps mobile behavior aligned with the custom module preview', () => {
        expect(editorSource).toContain('const isSmallScreen = window.innerWidth <= 700;');
        expect(editorSource).toContain('if (previewEl && !isSmallScreen)');
    });

    it('lets both live preview windows expand from their bottom-right corners', () => {
        expect(editorSource).toContain('id="rt_cfe_preview_resizer" class="rt-resizer-br"');
        expect(editorSource).toContain('id="rt_pe_preview_resizer" class="rt-resizer-br"');
        expect(editorSource).toContain("makeResizableBR(previewEl, previewResizer, 'rpg_tracker_geometry_custom_module_preview')");
        expect(editorSource).toContain("makeResizableBR(previewEl, previewResizer, 'rpg_tracker_geometry_stock_module_preview')");
        expect(editorSource).not.toContain('position:fixed;resize:both');
    });

    it('does not overwrite the main framework geometry when a preview is moved', () => {
        expect(editorSource).toContain("makeDraggable(previewEl, previewHeader, 'rpg_tracker_geometry_custom_module_preview')");
        expect(editorSource).toContain("makeDraggable(previewEl, previewHeader, 'rpg_tracker_geometry_stock_module_preview')");
    });
});
