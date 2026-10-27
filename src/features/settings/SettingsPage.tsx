import { useEffect, useRef, useState } from 'react';
import { MAX_IMPORT_BYTES } from '../../storage/schema.ts';
import { progressStore, useProgress } from '../../storage/store.ts';
import { parseImport, serializeExport } from '../../storage/transfer.js';
import { Icon } from '../../ui/Icon.tsx';
import { getAiStatus, type AiStatus } from '../ai/aiClient.ts';
import { syncManager } from '../sync/syncManager.ts';
import { useSyncStatus } from '../sync/useSync.ts';
import { updateSettings, useSettings, type FontSize, type Theme } from './settings.ts';

function SyncSection() {
  const sync = useSyncStatus();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const enable = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await syncManager.enable(password);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-section" aria-labelledby="sync-title">
      <h2 id="sync-title">
        <Icon name="sync" /> 跨设备同步
      </h2>
      <p>
        进度与代码草稿始终先保存在本机浏览器。开启同步后，会用部署时生成的同步密码与本站服务器交换数据，在你的多台设备之间合并进度。离线时照常学习，联网后自动同步。
      </p>
      <p className="muted small">同步密码保存在本机浏览器中。在别人的电脑上使用后，请点击“在本机退出同步”。这是单人使用的简易方案，不是多用户账号系统。</p>
      {sync.enabled ? (
        <>
          <p role="status">
            状态：<strong>{sync.label}</strong>
          </p>
          {sync.message && <div className={`notice ${sync.phase === 'error' || sync.phase === 'unauthorized' ? 'notice-error' : 'notice-info'}`}>{sync.message}</div>}
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => void syncManager.syncNow()} disabled={sync.phase === 'syncing'}>
              <Icon name="sync" /> 立即同步
            </button>
            <button type="button" className="btn" onClick={() => syncManager.disable()}>
              在本机退出同步
            </button>
          </div>
        </>
      ) : (
        <form
          className="sync-form"
          onSubmit={(e) => {
            e.preventDefault();
            void enable();
          }}
        >
          <label htmlFor="sync-password">同步密码</label>
          <input
            id="sync-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="tsw-XXXXX-XXXXX-…"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || password.trim().length < 8}>
            {busy ? '正在验证…' : '开启同步'}
          </button>
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function AiSection() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    void getAiStatus().then(setStatus);
  }, []);
  return (
    <section className="settings-section" aria-labelledby="ai-title">
      <h2 id="ai-title">
        <Icon name="chat" /> 问 AI（可选）
      </h2>
      {status === null ? (
        <p>正在检查…</p>
      ) : status.configured ? (
        <p>
          已配置：课页右侧有 AI 问答栏（顶栏的“问 AI”按钮可以展开或收起），示例与练习上的“问 AI”会把那段代码带到问答栏。可以在问答栏中选择模型（{status.models.map((m) => m.label).join('、')}），默认 <code>{status.model}</code>。需要上面的同步密码。AI 可能出错，请对照课程与官方文档核实。
        </p>
      ) : (
        <p>
          未配置。学习不依赖 AI。部署者可以在服务器环境变量中设置 <code>ANTHROPIC_API_KEY</code> 来启用（见 README 的“启用问 AI”）。密钥只保存在服务器上，浏览器拿不到。
        </p>
      )}
    </section>
  );
}

function ProgressSection() {
  const status = useProgress((s) => s.status);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const sync = useSyncStatus();

  const doExport = () => {
    const text = serializeExport(progressStore.getSnapshot().state);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `typescript-workshop-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ kind: 'ok', text: '已导出进度文件。' });
  };

  const doImport = async (file: File, mode: 'merge' | 'replace') => {
    setMessage(undefined);
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setMessage({ kind: 'error', text: '只能导入 .json 进度文件。' });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ kind: 'error', text: `文件太大（上限 ${MAX_IMPORT_BYTES / 1024 / 1024} MB）。` });
      return;
    }
    const text = await file.text();
    const r = parseImport(text, file.size);
    if (!r.ok) {
      setMessage({ kind: 'error', text: `导入失败，现有数据没有改动：${r.error}` });
      return;
    }
    if (mode === 'replace' && !window.confirm('“替换”会用文件内容覆盖本机全部进度与草稿，确定吗？')) return;
    try {
      await progressStore.importState(r.state, mode);
      setMessage({ kind: 'ok', text: mode === 'merge' ? '已合并导入。' : '已用文件内容替换本机进度。' });
    } catch (err) {
      setMessage({ kind: 'error', text: `写入本地存储失败，现有数据没有改动：${err instanceof Error ? err.message : String(err)}` });
    }
  };

  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const reset = async () => {
    const alsoCloud = sync.enabled;
    if (!window.confirm(`确定要清除全部学习进度与代码草稿吗？${alsoCloud ? '已开启同步：云端进度也会被清除，其他设备会跟随重置。' : ''}此操作不能撤销，建议先导出备份。`)) return;
    try {
      await progressStore.resetAll();
      if (alsoCloud) await syncManager.pushReset();
      setMessage({ kind: 'ok', text: '已清除全部进度。' });
    } catch (err) {
      setMessage({ kind: 'error', text: `清除失败：${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <section className="settings-section" aria-labelledby="progress-title">
      <h2 id="progress-title">学习进度</h2>
      {status.unavailable && <div className="notice notice-error">{status.unavailable}</div>}
      {status.saveError && <div className="notice notice-error">{status.saveError}</div>}
      {status.skippedCorrupt > 0 && <div className="notice notice-warn">加载时发现 {status.skippedCorrupt} 条损坏的记录，已跳过，其余数据正常。</div>}
      {!status.unavailable && !status.saveError && <p className="muted">本地存储：正常{status.pending > 0 ? `（${status.pending} 项正在写入）` : ''}。</p>}
      <div className="button-row">
        <button type="button" className="btn" onClick={doExport}>
          导出进度（JSON）
        </button>
        <label className="btn">
          导入进度…
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f, importMode);
              e.target.value = '';
            }}
          />
        </label>
        <select aria-label="导入方式" value={importMode} onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}>
          <option value="merge">合并（推荐：不会丢失本机记录）</option>
          <option value="replace">替换（用文件覆盖本机）</option>
        </select>
      </div>
      {message && (
        <div className={`notice ${message.kind === 'ok' ? 'notice-ok' : 'notice-error'}`} role="status">
          {message.text}
        </div>
      )}
      <details className="danger-zone">
        <summary>清除全部进度</summary>
        <button type="button" className="btn btn-danger" onClick={() => void reset()}>
          清除全部进度与草稿
        </button>
      </details>
    </section>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  useEffect(() => {
    document.title = '设置 · TypeScript 工坊';
  }, []);
  return (
    <div className="settings">
      <h1>设置</h1>
      <section className="settings-section" aria-labelledby="look-title">
        <h2 id="look-title">外观</h2>
        <div className="field-row">
          <label htmlFor="theme">主题</label>
          <select id="theme" value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as Theme })}>
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="font-size">字号</label>
          <select id="font-size" value={settings.fontSize} onChange={(e) => updateSettings({ fontSize: e.target.value as FontSize })}>
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
            <option value="xlarge">特大</option>
          </select>
        </div>
      </section>
      <SyncSection />
      <ProgressSection />
      <AiSection />
      <section className="settings-section" aria-labelledby="about-title">
        <h2 id="about-title">关于</h2>
        <p>
          TypeScript 工坊是免费开源的中文交互式学习平台。平台代码使用 MIT 许可证，原创课文使用 CC BY 4.0。浏览器内编译器为 TypeScript 6.0.3（Apache-2.0），编辑器为 CodeMirror 6（MIT），测试工具使用 Testing Library（MIT）。
        </p>
        <p className="muted small">学生代码只在隔离的沙箱中运行；平台用于自学，不提供防作弊或认证功能。</p>
      </section>
    </div>
  );
}

export default SettingsPage;
