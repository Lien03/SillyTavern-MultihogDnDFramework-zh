import { getSettings } from './state-manager.js';
import {
    fetchOllamaModels,
    fetchOpenAIModels,
} from './llm-client.js';
import { saveSettings } from './src/app/runtime-bridge.js';

/** Shared connection overlay for every onboarding character-creation path. */
export function getCharacterCreationConnectionSettings(baseSettings) {
    const s = baseSettings || getSettings();
    return {
        connectionSource: s.characterCreationConnectionSource || 'default',
        connectionProfileId: s.characterCreationConnectionProfileId || '',
        completionPresetId: s.characterCreationCompletionPresetId || '',
        ollamaUrl: s.characterCreationOllamaUrl || 'http://localhost:11434',
        ollamaModel: s.characterCreationOllamaModel || '',
        openaiUrl: s.characterCreationOpenaiUrl || '',
        openaiKey: s.characterCreationOpenaiKey || '',
        openaiModel: s.characterCreationOpenaiModel || '',
        maxTokens: s.maxTokens || 0,
        debugMode: !!s.debugMode,
    };
}

/** Convert legacy name-based selections to the internal Connection Manager profile ID. */
export function resolveCharacterCreationProfileId(savedValue, profiles = []) {
    const value = String(savedValue || '').trim();
    if (!value) return '';
    const direct = profiles.find(profile => profile?.id === value);
    if (direct) return direct.id;
    const byName = profiles.find(profile => profile?.name === value);
    if (byName) return byName.id;
    return profiles.length ? '' : value;
}

function setOptions(select, values, emptyLabel, selectedValue) {
    if (!(select instanceof HTMLSelectElement)) return;
    select.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = emptyLabel;
    select.append(empty);
    for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.append(option);
    }
    select.value = selectedValue || '';
}

/** Bind the shared Character Creation connection controls. */
export function bindCharacterCreationConnectionSettings(rootEl) {
    const drawer = rootEl?.querySelector('.rt-character-creation-connection-controls');
    if (!drawer || drawer.dataset.rtConnectionBound === '1') return;
    drawer.dataset.rtConnectionBound = '1';

    const s = getSettings();
    const context = SillyTavern.getContext();
    const source = drawer.querySelector('#rt-character-creation-connection-source');
    const profileGroup = drawer.querySelector('#rt-character-creation-profile-group');
    const profile = drawer.querySelector('#rt-character-creation-connection-profile');
    const ollamaGroup = drawer.querySelector('#rt-character-creation-ollama-group');
    const ollamaUrl = drawer.querySelector('#rt-character-creation-ollama-url');
    const ollamaModel = drawer.querySelector('#rt-character-creation-ollama-model');
    const ollamaRefresh = drawer.querySelector('#rt-character-creation-ollama-refresh');
    const openaiGroup = drawer.querySelector('#rt-character-creation-openai-group');
    const openaiUrl = drawer.querySelector('#rt-character-creation-openai-url');
    const openaiKey = drawer.querySelector('#rt-character-creation-openai-key');
    const openaiModel = drawer.querySelector('#rt-character-creation-openai-model');
    const openaiManual = drawer.querySelector('#rt-character-creation-openai-model-manual');
    const openaiRefresh = drawer.querySelector('#rt-character-creation-openai-refresh');
    const preset = drawer.querySelector('#rt-character-creation-completion-preset');

    const updatePanels = () => {
        const value = source instanceof HTMLSelectElement ? source.value : 'default';
        if (profileGroup instanceof HTMLElement) profileGroup.style.display = value === 'profile' ? '' : 'none';
        if (ollamaGroup instanceof HTMLElement) ollamaGroup.style.display = value === 'ollama' ? 'flex' : 'none';
        if (openaiGroup instanceof HTMLElement) openaiGroup.style.display = value === 'openai' ? 'flex' : 'none';
    };
    const persistInput = (element, key, fallback = '') => {
        if (!(element instanceof HTMLInputElement)) return;
        element.value = String(s[key] || fallback);
        element.addEventListener('input', () => {
            getSettings()[key] = element.value;
            saveSettings();
        });
    };

    if (source instanceof HTMLSelectElement) {
        source.value = s.characterCreationConnectionSource || 'default';
        source.addEventListener('change', () => {
            getSettings().characterCreationConnectionSource = source.value || 'default';
            updatePanels();
            saveSettings();
        });
    }
    updatePanels();

    persistInput(ollamaUrl, 'characterCreationOllamaUrl', 'http://localhost:11434');
    persistInput(openaiUrl, 'characterCreationOpenaiUrl');
    persistInput(openaiKey, 'characterCreationOpenaiKey');
    persistInput(openaiManual, 'characterCreationOpenaiModel');

    if (ollamaModel instanceof HTMLSelectElement) {
        setOptions(ollamaModel, s.characterCreationOllamaModel ? [s.characterCreationOllamaModel] : [], '-- 选择模型 --', s.characterCreationOllamaModel);
        ollamaModel.addEventListener('change', () => {
            getSettings().characterCreationOllamaModel = ollamaModel.value;
            saveSettings();
        });
    }
    ollamaRefresh?.addEventListener('click', async (event) => {
        event.preventDefault();
        const url = ollamaUrl instanceof HTMLInputElement ? ollamaUrl.value.trim() : '';
        if (!url) return toastr['info']('请先输入 Ollama URL。');
        try {
            const models = await fetchOllamaModels(url);
            const names = models.map(model => typeof model === 'string' ? model : model.name).filter(Boolean);
            setOptions(ollamaModel, names, '-- 选择模型 --', getSettings().characterCreationOllamaModel);
            toastr['success']('Ollama 模型已更新。');
        } catch (_) {
            toastr['error']('获取 Ollama 模型失败。');
        }
    });

    if (openaiModel instanceof HTMLSelectElement) {
        setOptions(openaiModel, [], '-- 选择模型 --', '');
        openaiModel.addEventListener('change', () => {
            if (!openaiModel.value) return;
            if (openaiManual instanceof HTMLInputElement) openaiManual.value = '';
            getSettings().characterCreationOpenaiModel = openaiModel.value;
            saveSettings();
        });
    }
    openaiRefresh?.addEventListener('click', async (event) => {
        event.preventDefault();
        const url = openaiUrl instanceof HTMLInputElement ? openaiUrl.value.trim() : '';
        const key = openaiKey instanceof HTMLInputElement ? openaiKey.value : '';
        if (!url) return toastr['info']('请先输入端点 URL。');
        try {
            const models = await fetchOpenAIModels(url, key);
            const names = models.map(model => typeof model === 'string' ? model : (model.id || model.name)).filter(Boolean);
            setOptions(openaiModel, names, '-- 选择模型 --', getSettings().characterCreationOpenaiModel);
            toastr['success']('模型已更新。');
        } catch (_) {
            toastr['warning']('无法自动检测模型，请手动输入模型名称。');
        }
    });

    const connectionProfiles = Array.isArray(context.extensionSettings?.connectionManager?.profiles)
        ? context.extensionSettings.connectionManager.profiles
        : [];
    const savedProfileId = resolveCharacterCreationProfileId(s.characterCreationConnectionProfileId, connectionProfiles);
    if (savedProfileId !== String(s.characterCreationConnectionProfileId || '')) {
        s.characterCreationConnectionProfileId = savedProfileId;
        saveSettings();
    }
    const service = context.ConnectionManagerRequestService;
    const connectionManagerDisabled = context.extensionSettings?.disabledExtensions?.includes('connection-manager');
    let profileDropdownBound = false;
    if (profile instanceof HTMLSelectElement && service?.handleDropdown && !connectionManagerDisabled) {
        try {
            service.handleDropdown(
                '#rt-character-creation-connection-profile',
                savedProfileId,
                selectedProfile => {
                    getSettings().characterCreationConnectionProfileId = selectedProfile?.id || '';
                    saveSettings();
                },
            );
            profileDropdownBound = true;
        } catch (error) {
            console.warn('[RPG Tracker] Could not bind Character Creation profile dropdown:', error);
        }
    }
    if (profile instanceof HTMLSelectElement && !profileDropdownBound) {
        profile.innerHTML = '<option value="">-- 未选择配置 --</option>';
        const supportedProfiles = connectionProfiles.filter(candidate => {
            try {
                return typeof service?.isProfileSupported !== 'function' || service.isProfileSupported(candidate);
            } catch (_) {
                return false;
            }
        });
        for (const candidate of supportedProfiles) {
            const option = document.createElement('option');
            option.value = candidate.id;
            option.textContent = candidate.name || candidate.id;
            profile.append(option);
        }
        profile.value = savedProfileId;
        profile.addEventListener('change', () => {
            getSettings().characterCreationConnectionProfileId = profile.value;
            saveSettings();
        });
    }

    if (preset instanceof HTMLSelectElement) {
        const manager = SillyTavern.getContext().getPresetManager?.();
        const presets = manager?.getAllPresets?.() || [];
        setOptions(preset, presets, '-- 使用当前设置 --', s.characterCreationCompletionPresetId);
        preset.addEventListener('change', () => {
            getSettings().characterCreationCompletionPresetId = preset.value;
            saveSettings();
        });
    }
}
