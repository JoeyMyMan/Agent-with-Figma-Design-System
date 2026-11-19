// dsh-figma-ds — client half.
//
// Registers one page in the shell: the 「设计系统」 entry in the sidebar panel
// list and its page in the main column. The page talks to its own Host half
// through the authenticated exact Fetch routes the Host registers below
// /api/figma-ds; the browser cookie is the credential.
//
// Loaded as a classic script and registered on the DSH client module loader.
(function () {
  'use strict';

  var PLUGIN_ID = 'dsh-figma-ds';
  var API = '/api/figma-ds';
  // Bumped on every installed build so a stale artifact is visible, not a code bug.
  var BUILD = '1.0.0';

  var CSS = [
    '.dsfig-page{display:flex;flex-direction:column;gap:18px;max-width:1120px;margin:0 auto;padding:28px 32px 40px;box-sizing:border-box;color:var(--dsw-alias-label-primary,#1a1a1a);}',
    '.dsfig-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;}',
    '.dsfig-titles{display:flex;flex-direction:column;gap:5px;min-width:0;}',
    '.dsfig-title{font-size:21px;font-weight:600;line-height:1.25;margin:0;}',
    '.dsfig-sub{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0;}',
    '.dsfig-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}',
    '.dsfig-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
    '.dsfig-select{height:32px;max-width:360px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0 8px;outline:none;}',
    '.dsfig-select:focus{border-color:var(--dsw-alias-brand-primary);}',
    '.dsfig-tabs{display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap;}',
    '.dsfig-tab{appearance:none;-webkit-appearance:none;background:none;border:none;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:9px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}',
    '.dsfig-tab:hover{color:var(--dsw-alias-label-primary);}',
    '.dsfig-tab-on{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--dsw-alias-brand-primary);}',
    '.dsfig-count{font-size:11px;line-height:1;padding:2px 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}',
    '.dsfig-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;}',
    '.dsfig-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);}',
    '.dsfig-card-title{font-size:13.5px;font-weight:600;margin:0;}',
    '.dsfig-card-body{padding:16px;display:flex;flex-direction:column;gap:12px;}',
    '.dsfig-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}',
    '.dsfig-stat{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:13px 15px;display:flex;flex-direction:column;gap:3px;}',
    '.dsfig-stat-num{font-size:22px;font-weight:600;line-height:1.2;}',
    '.dsfig-stat-label{font-size:12px;color:var(--dsw-alias-label-secondary);}',
    '.dsfig-stat-hint{font-size:11px;color:var(--dsw-alias-label-secondary);}',
    '.dsfig-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}',
    '.dsfig-row-text{display:flex;flex-direction:column;gap:2px;min-width:0;}',
    '.dsfig-label{font-size:12.5px;font-weight:500;}',
    '.dsfig-hint{font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary);}',
    '.dsfig-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--dsw-alias-label-secondary);word-break:break-all;}',
    '.dsfig-btn{appearance:none;-webkit-appearance:none;height:30px;padding:0 12px;border-radius:8px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;border:1px solid transparent;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:opacity .12s ease;}',
    '.dsfig-btn:disabled{opacity:.45;cursor:default;}',
    '.dsfig-btn-primary{background:var(--dsw-alias-brand-primary,#2f7cf6);color:var(--dsw-alias-bg-base,#fff);-webkit-text-fill-color:var(--dsw-alias-bg-base,#fff);}',
    '.dsfig-btn-ghost{background:var(--dsw-alias-bg-layer-2,#f2f3f5);border-color:var(--dsw-alias-border-l2,#d0d3d9);color:var(--dsw-alias-label-primary);-webkit-text-fill-color:currentColor;}',
    '.dsfig-btn-quiet{background:transparent;border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);-webkit-text-fill-color:currentColor;}',
    '.dsfig-input{height:30px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0 9px;outline:none;min-width:0;}',
    '.dsfig-input:focus{border-color:var(--dsw-alias-brand-primary);}',
    '.dsfig-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:1;padding:3px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
    '.dsfig-pill-ok{color:var(--dsw-alias-state-success-primary,#12805c);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#12805c) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#12805c) 8%,transparent);}',
    '.dsfig-pill-warn{color:var(--dsw-alias-state-warn-primary,#b54708);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b54708) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b54708) 8%,transparent);}',
    '.dsfig-pill-err{color:var(--dsw-alias-state-error-primary,#d92d20);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 8%,transparent);}',
    '.dsfig-pill-brand{color:var(--dsw-alias-brand-primary,#2f7cf6);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#2f7cf6) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#2f7cf6) 8%,transparent);}',
    '.dsfig-table{width:100%;border-collapse:collapse;font-size:12.5px;}',
    '.dsfig-th{text-align:left;font-weight:500;font-size:11.5px;color:var(--dsw-alias-label-secondary);padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap;}',
    '.dsfig-td{padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top;}',
    '.dsfig-tr:last-child .dsfig-td{border-bottom:none;}',
    '.dsfig-scroll{overflow:auto;max-height:520px;}',
    '.dsfig-empty{padding:26px 16px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-secondary);}',
    '.dsfig-ok{border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#12805c) 35%,transparent);border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-state-success-primary,#12805c);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#12805c) 7%,transparent);}',
    '.dsfig-err{border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 35%,transparent);border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-state-error-primary,#d92d20);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 7%,transparent);}',
    '.dsfig-warn{border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b54708) 35%,transparent);border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-state-warn-primary,#b54708);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b54708) 7%,transparent);}',
    '.dsfig-list{display:flex;flex-direction:column;}',
    '.dsfig-li{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1);}',
    '.dsfig-li:last-child{border-bottom:none;}',
    '.dsfig-chips{display:flex;flex-wrap:wrap;gap:6px;}',
    '.dsfig-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:4px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}',
    '.dsfig-chip-on{color:var(--dsw-alias-label-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#2f7cf6) 40%,transparent);}',
    '.dsfig-dock{position:sticky;bottom:0;z-index:2;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 -6px 18px rgba(0,0,0,.06);overflow:hidden;}',
    '.dsfig-dock-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);}',
    '.dsfig-dock-title{font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;}',
    '.dsfig-dock-body{max-height:220px;overflow:auto;padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;display:flex;flex-direction:column;gap:2px;}',
    '.dsfig-line-out{color:var(--dsw-alias-label-primary);}',
    '.dsfig-line-err{color:var(--dsw-alias-state-error-primary,#d92d20);}',
    '.dsfig-pre{margin:0;padding:14px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word;max-height:560px;overflow:auto;background:var(--dsw-alias-bg-layer-2);border-radius:10px;}',
    '.dsfig-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;}',
    '.dsfig-form .dsfig-input{flex:1;min-width:140px;}',
    '.dsfig-split{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:14px;align-items:start;}',
    '.dsfig-book{appearance:none;background:none;border:1px solid transparent;border-radius:10px;text-align:left;font:inherit;padding:9px 11px;cursor:pointer;display:flex;flex-direction:column;gap:3px;color:var(--dsw-alias-label-primary);}',
    '.dsfig-book:hover{background:var(--dsw-alias-bg-layer-2);}',
    '.dsfig-book-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);}',
    '.dsfig-book-name{font-size:12.5px;font-weight:500;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}',
    '.dsfig-book-desc{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);}',
    '.dsfig-link{color:var(--dsw-alias-brand-primary,#2f7cf6);text-decoration:none;}',
    '.dsfig-link:hover{text-decoration:underline;}',
    '.dsfig-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}',
  ].join('');

  /** Call one Host route; resolves to the unwrapped `value` or throws with the Host's message. */
  async function api(path, payload) {
    var init = { method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin' };
    if (payload !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(payload);
    }
    var response = await fetch(API + path, init);
    var text = await response.text();
    var data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error(t_err(status_text(response.status)));
      }
    }
    if (!response.ok) throw new Error(data.error || status_text(response.status));
    if (data.ok === false) throw new Error(data.error || status_text(response.status));
    return data.value;
  }

  function status_text(status) {
    return '请求失败（HTTP ' + status + '）';
  }

  function t_err(message) {
    return '服务返回了无法解析的响应：' + message;
  }

  function createComponents(React, t) {
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useCallback = React.useCallback;
    var useMemo = React.useMemo;

    /** Renders a message instead of letting a throw blank the panel. */
    class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error: error };
      }
      componentDidCatch(error, info) {
        if (typeof console !== 'undefined' && console.error) console.error('[figma-ds] render crashed:', error, info);
      }
      render() {
        if (!this.state.error) return this.props.children;
        var message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error);
        return h('div', { className: 'dsfig-page' }, h('div', { className: 'dsfig-err' }, t('renderFailed') + ': ' + message));
      }
    }

    function Btn(props) {
      var variant = props.variant || 'ghost';
      return h(
        'button',
        {
          type: 'button',
          className: 'dsfig-btn dsfig-btn-' + variant,
          onClick: props.onClick,
          disabled: props.disabled,
          title: props.title,
        },
        props.children,
      );
    }

    function Pill(props) {
      return h('span', { className: 'dsfig-pill' + (props.tone ? ' dsfig-pill-' + props.tone : '') }, props.children);
    }

    function Stat(props) {
      return h(
        'div',
        { className: 'dsfig-stat' },
        h('span', { className: 'dsfig-stat-num' }, props.value),
        h('span', { className: 'dsfig-stat-label' }, props.label),
        props.hint ? h('span', { className: 'dsfig-stat-hint' }, props.hint) : null,
      );
    }

    function Card(props) {
      return h(
        'section',
        { className: 'dsfig-card' },
        props.title || props.extra
          ? h(
              'header',
              { className: 'dsfig-card-head' },
              h('h3', { className: 'dsfig-card-title' }, props.title),
              props.extra ? h('div', { className: 'dsfig-head-actions' }, props.extra) : null,
            )
          : null,
        h('div', { className: 'dsfig-card-body' }, props.children),
      );
    }

    function Empty(props) {
      return h('div', { className: 'dsfig-empty' }, props.children);
    }

    function Field(props) {
      return h(
        'label',
        { className: 'dsfig-row-text', style: { flex: '1 1 180px' } },
        h('span', { className: 'dsfig-label' }, props.label),
        h('input', {
          className: 'dsfig-input',
          value: props.value,
          placeholder: props.placeholder,
          onChange: function (event) {
            props.onChange(event.target.value);
          },
        }),
      );
    }

    function Grid(props) {
      return h(
        'div',
        { className: 'dsfig-scroll' },
        h(
          'table',
          { className: 'dsfig-table' },
          h('thead', null, h('tr', null, props.head.map((cell) => h('th', { key: String(cell), className: 'dsfig-th' }, cell)))),
          h(
            'tbody',
            null,
            props.rows.length
              ? props.rows.map((row, index) =>
                  h(
                    'tr',
                    { key: index, className: 'dsfig-tr' },
                    row.map((cell, cellIndex) => h('td', { key: cellIndex, className: 'dsfig-td' }, cell)),
                  ),
                )
              : null,
          ),
        ),
        props.rows.length ? null : h(Empty, null, props.empty || t('empty')),
      );
    }

    var STATUS_TONE = { pinned: 'ok', approved: 'ok', reuse: 'ok', proposed: 'warn', extend: 'warn', 'needs-designer': 'warn', deprecated: '' };
    var STATUS_TEXT = {
      pinned: t('statusPinned'),
      approved: t('statusApproved'),
      reuse: t('statusReuse'),
      extend: t('statusExtend'),
      proposed: t('statusProposed'),
      'needs-designer': t('statusNeedsDesigner'),
      deprecated: t('statusDeprecated'),
    };

    function statusPill(status) {
      return h(Pill, { tone: STATUS_TONE[status] ?? '' }, STATUS_TEXT[status] ?? status);
    }

    /** Pull one directory pick from the boot payload. */
    function pickProject(projects) {
      if (!projects || !projects.length) return '';
      var configured = projects.filter((entry) => entry.initialized);
      return (configured[0] || projects[0]).path;
    }

    function Page() {
      var [boot, setBoot] = useState(null);
      var [dir, setDir] = useState('');
      var [state, setState] = useState(null);
      var [loadError, setLoadError] = useState(null);
      var [tab, setTab] = useState('overview');
      var [busy, setBusy] = useState('');
      var [result, setResult] = useState(null);
      var [playbook, setPlaybook] = useState(null);
      var [query, setQuery] = useState('');
      var [strict, setStrict] = useState(false);
      var [syncLabel, setSyncLabel] = useState('');
      var [sourceInput, setSourceInput] = useState('');
      var [skillsDirs, setSkillsDirs] = useState('');
      var [initForm, setInitForm] = useState({ name: t('initNamePlaceholder'), prefix: 'acme', source: '', agents: 'agents-md' });
      var [pathInput, setPathInput] = useState('');

      var loadState = useCallback(
        async function (target) {
          if (!target) return;
          setBusy('refresh');
          try {
            var value = await api('/state', { dir: target });
            setState(value);
            setLoadError(null);
          } catch (error) {
            setState(null);
            setLoadError(error instanceof Error ? error.message : String(error));
          } finally {
            setBusy('');
          }
        },
        [],
      );

      useEffect(
        function () {
          var alive = true;
          (async function () {
            try {
              var value = await api('/dirs');
              if (!alive) return;
              setBoot(value);
              var next = pickProject(value.projects);
              setDir(next);
              if (next) await loadState(next);
            } catch (error) {
              if (alive) setLoadError(error instanceof Error ? error.message : String(error));
            }
          })();
          return function () {
            alive = false;
          };
        },
        [loadState],
      );

      var run = useCallback(
        async function (command, args) {
          if (!dir) return;
          setBusy(command);
          try {
            var value = await api('/run', { dir: dir, command: command, args: args || {} });
            setResult(value);
            await loadState(dir);
          } catch (error) {
            setResult({ ok: false, command: command, code: 1, ms: 0, lines: [{ level: 'err', text: error instanceof Error ? error.message : String(error) }] });
          } finally {
            setBusy('');
          }
        },
        [dir, loadState],
      );

      var openPlaybook = useCallback(async function (name) {
        try {
          setPlaybook(await api('/playbook', { name: name }));
        } catch (error) {
          setResult({ ok: false, command: 'playbook', code: 1, ms: 0, lines: [{ level: 'err', text: error instanceof Error ? error.message : String(error) }] });
        }
      }, []);

      function switchDir(next) {
        setDir(next);
        setState(null);
        setResult(null);
        setPlaybook(null);
        loadState(next);
      }

      /** Open a project the picker does not list: the Host still enforces its allowlist. */
      async function openPath() {
        var next = pathInput.trim();
        if (!next) return;
        setLoadError(null);
        setState(null);
        setDir(next);
        setResult(null);
        setPlaybook(null);
        await loadState(next);
      }

      var config = state ? state.config : null;
      var tokens = state ? state.tokens : null;
      var registry = state ? state.registry : null;
      var review = state ? state.review : null;

      var tabs = [
        { id: 'overview', label: t('tabOverview') },
        { id: 'gate', label: t('tabGate') },
        { id: 'tokens', label: t('tabTokens'), count: tokens && tokens.total ? tokens.total : null },
        { id: 'registry', label: t('tabRegistry'), count: registry && registry.total ? registry.total : null },
        { id: 'review', label: t('tabReview'), count: review && review.pending ? review.pending.length : null },
        { id: 'playbooks', label: t('tabPlaybooks') },
        { id: 'commands', label: t('tabCommands') },
      ];

      var filteredTokens = useMemo(
        function () {
          if (!tokens) return [];
          var needle = query.trim().toLowerCase();
          if (!needle) return tokens.entries;
          return tokens.entries.filter(function (entry) {
            return entry.name.toLowerCase().indexOf(needle) >= 0 || (entry.figma || '').toLowerCase().indexOf(needle) >= 0;
          });
        },
        [tokens, query],
      );

      function renderOverview() {
        if (!state) return null;
        if (!state.initialized) {
          return h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
            h(
              Card,
              { title: t('setupTitle') },
              h('p', { className: 'dsfig-hint', style: { margin: 0 } }, t('setupHint')),
              h(
                'div',
                { className: 'dsfig-form' },
                h(Field, { label: t('initName'), value: initForm.name, onChange: (value) => setInitForm({ ...initForm, name: value }) }),
                h(Field, { label: t('initPrefix'), value: initForm.prefix, onChange: (value) => setInitForm({ ...initForm, prefix: value }) }),
              ),
              h(
                'div',
                { className: 'dsfig-form' },
                h(Field, {
                  label: t('initSource'),
                  value: initForm.source,
                  placeholder: 'design-system.html 或 https://www.figma.com/design/…',
                  onChange: (value) => setInitForm({ ...initForm, source: value }),
                }),
                h(Field, { label: t('initAgents'), value: initForm.agents, onChange: (value) => setInitForm({ ...initForm, agents: value }) }),
              ),
              h(
                'div',
                { className: 'dsfig-head-actions' },
                h(
                  Btn,
                  {
                    variant: 'primary',
                    disabled: busy === 'init',
                    onClick: () =>
                      run('init', {
                        name: initForm.name,
                        prefix: initForm.prefix,
                        source: initForm.source || undefined,
                        agents: initForm.agents || undefined,
                      }),
                  },
                  busy === 'init' ? t('running') : t('runInit'),
                ),
                h(Btn, { onClick: () => loadState(dir), disabled: !!busy }, t('refresh')),
              ),
            ),
          );
        }
        var lock = state.lock;
        return h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
          h(
            'div',
            { className: 'dsfig-stats' },
            h(Stat, { label: t('statTokens'), value: tokens.total, hint: tokens.label || '—' }),
            h(Stat, { label: t('statComponents'), value: registry.total, hint: t('statComponentsHint') }),
            h(Stat, { label: t('statPending'), value: review.exists ? review.pending.length : '—', hint: review.exists ? t('statPendingHint') : t('noLedger') }),
            h(Stat, {
              label: t('statRules'),
              value: state.agentRules.managedBlock ? t('rulesInjected') : t('rulesMissing'),
              hint: 'AGENTS.md',
            }),
          ),
          h(
            Card,
            { title: t('sourceTitle'), extra: lock ? h(Pill, { tone: 'brand' }, lock.label || '—') : null },
            h('div', { className: 'dsfig-row' }, h('div', { className: 'dsfig-row-text' }, h('span', { className: 'dsfig-hint', style: { margin: 0 } }, state.sourceLabel))),
            lock
              ? h(
                  'div',
                  { className: 'dsfig-chips' },
                  Object.entries(lock.counts || {}).map(([key, value]) => h('span', { key: key, className: 'dsfig-chip' }, key + ' ' + value)),
                  h('span', { className: 'dsfig-chip' }, t('lockedAt') + ' ' + (lock.date || '—')),
                  lock.warning ? h('span', { className: 'dsfig-chip' }, '⚠ ' + lock.warning) : null,
                )
              : h('div', { className: 'dsfig-warn' }, t('notSynced')),
            h(
              'div',
              { className: 'dsfig-head-actions' },
              h(Btn, { variant: 'primary', onClick: () => run('build'), disabled: !!busy }, busy === 'build' ? t('running') : t('runBuild')),
              h(Btn, { onClick: () => run('check'), disabled: !!busy }, busy === 'check' ? t('running') : t('runCheck')),
              h(Btn, { onClick: () => run('registry'), disabled: !!busy }, t('runRegistry')),
              h(Btn, { onClick: () => run('rules', { skillsDirs: '' }), disabled: !!busy }, t('runRules')),
            ),
          ),
          state.steps.length
            ? h(
                Card,
                { title: t('nextSteps') },
                h(
                  'div',
                  { className: 'dsfig-list' },
                  state.steps.map((step, index) => h('div', { key: index, className: 'dsfig-li' }, h('span', { className: 'dsfig-mono' }, step))),
                ),
              )
            : null,
          h(
            Card,
            { title: t('filesTitle') },
            h(
              'div',
              { className: 'dsfig-chips' },
              Object.entries(state.files).map(([key, present]) =>
                h('span', { key: key, className: 'dsfig-chip' + (present ? ' dsfig-chip-on' : '') }, (present ? '✓ ' : '· ') + key),
              ),
            ),
            h(
              'div',
              { className: 'dsfig-chips' },
              state.agentRules.targets
                .filter((target) => target.exists)
                .map((target) => h('span', { key: target.id, className: 'dsfig-chip dsfig-chip-on' }, '✓ ' + target.id + '  ' + target.path)),
            ),
          ),
        );
      }

      function renderGate() {
        if (!state || !state.initialized) return h(Empty, null, t('setupFirst'));
        var lastCheck = result && result.command === 'check' ? result : null;
        return h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
          h(
            Card,
            {
              title: t('gateTitle'),
              extra: h(Btn, { variant: 'primary', onClick: () => run('check'), disabled: !!busy }, busy === 'check' ? t('running') : t('runCheck')),
            },
            h('p', { className: 'dsfig-hint', style: { margin: 0 } }, t('gateHint')),
            h(
              'div',
              { className: 'dsfig-chips' },
              h('span', { className: 'dsfig-chip' }, t('scan') + ': ' + (config.checkScan || []).join(', ')),
              h('span', { className: 'dsfig-chip' }, t('componentDirs') + ': ' + ((config.componentDirs || []).join(', ') || '—')),
              h('span', { className: 'dsfig-chip' }, t('prefix') + ': --' + config.tokensPrefix + '-*'),
              h('span', { className: 'dsfig-chip' }, 'baseline: ' + (state.files.baseline ? '✓' : '—')),
            ),
            lastCheck
              ? lastCheck.ok
                ? h('div', { className: 'dsfig-ok' }, t('gatePassed'))
                : h(
                    'div',
                    { className: 'dsfig-err' },
                    lastCheck.lines
                      .filter((line) => line.level === 'err')
                      .map((line, index) => h('div', { key: index }, line.text)),
                    h('div', { style: { marginTop: '6px' } }, lastCheck.lines.filter((line) => line.level === 'out').map((line) => line.text).join(' · ')),
                  )
              : h(Empty, null, t('gateNotRun')),
            h(
              'div',
              { className: 'dsfig-head-actions' },
              h(Btn, { variant: 'quiet', onClick: () => run('check', { update: true }), disabled: !!busy }, t('runCheckUpdate')),
            ),
          ),
          h(
            Card,
            { title: t('gateRulesTitle') },
            h(
              'div',
              { className: 'dsfig-list' },
              [
                t('gateRule1'),
                t('gateRule2'),
                t('gateRule3'),
                t('gateRule4'),
                t('gateRule5'),
                t('gateRule6'),
              ].map((line, index) => h('div', { key: index, className: 'dsfig-li' }, h('span', { className: 'dsfig-hint' }, '· ' + line))),
            ),
          ),
        );
      }

      function renderTokens() {
        if (!state || !state.initialized) return h(Empty, null, t('setupFirst'));
        return h(
          Card,
          {
            title: t('tokensTitle'),
            extra: h('input', {
              className: 'dsfig-input',
              placeholder: t('search'),
              value: query,
              onChange: function (event) {
                setQuery(event.target.value);
              },
              style: { width: '200px' },
            }),
          },
          h(
            'div',
            { className: 'dsfig-chips' },
            Object.entries(tokens.groups || {}).map(([key, value]) => h('span', { key: key, className: 'dsfig-chip' }, key + ' ' + value)),
            h('span', { className: 'dsfig-chip' }, t('from') + ': ' + (tokens.label || '—')),
            h('span', { className: 'dsfig-chip' }, config.tokensCss + (tokens.cssExists ? ' ✓' : ' —')),
            tokens.truncated ? h('span', { className: 'dsfig-chip' }, t('truncated') + ' ' + tokens.shown + '/' + tokens.total) : null,
          ),
          tokens.total === 0
            ? h(Empty, null, t('tokensEmpty'))
            : h(Grid, {
                head: ['Token', 'Figma', t('group'), t('status')],
                rows: filteredTokens.map((entry) => [
                  h('span', { className: 'dsfig-mono', style: { color: 'var(--dsw-alias-label-primary)' } }, entry.name),
                  h('span', { className: 'dsfig-mono' }, entry.figma),
                  entry.group,
                  statusPill(entry.status),
                ]),
                empty: t('noMatch'),
              }),
        );
      }

      function renderRegistry() {
        if (!state || !state.initialized) return h(Empty, null, t('setupFirst'));
        return h(
          Card,
          {
            title: t('registryTitle'),
            extra: h(
              'div',
              { className: 'dsfig-head-actions' },
              h(Btn, { onClick: () => run('registry'), disabled: !!busy }, t('runRegistry')),
            ),
          },
          h(
            'div',
            { className: 'dsfig-chips' },
            Object.entries(registry.counts || {}).map(([key, value]) => h('span', { key: key, className: 'dsfig-chip' }, (STATUS_TEXT[key] || key) + ' ' + value)),
            h('span', { className: 'dsfig-chip' }, config.registryMarkdown + (registry.markdownExists ? ' ✓' : ' —')),
          ),
          h(Grid, {
            head: [t('code'), t('status'), t('purpose'), 'Figma', t('screens')],
            rows: registry.entries.map((entry) => [
              h('span', { className: 'dsfig-mono', style: { color: 'var(--dsw-alias-label-primary)' } }, entry.code),
              statusPill(entry.status),
              h('div', { className: 'dsfig-row-text' }, h('span', null, entry.description || '—'), entry.note ? h('span', { className: 'dsfig-hint' }, entry.note) : null),
              entry.figma && entry.figma.url
                ? h('a', { className: 'dsfig-link', href: entry.figma.url, target: '_blank', rel: 'noreferrer' }, entry.figma.name || entry.figma.nodeId)
                : entry.figmaProposal && entry.figmaProposal.url
                  ? h('a', { className: 'dsfig-link', href: entry.figmaProposal.url, target: '_blank', rel: 'noreferrer' }, t('proposal'))
                  : h('span', { className: 'dsfig-mono' }, '—'),
              h('span', { className: 'dsfig-mono' }, (entry.screens || []).join(' ') || '—'),
            ]),
            empty: t('registryEmpty'),
          }),
        );
      }

      function renderReview() {
        if (!state || !state.initialized) return h(Empty, null, t('setupFirst'));
        var groups = [
          { key: 'ready', title: t('readyTitle'), rows: review.ready, tone: 'ok' },
          { key: 'unconfirmed', title: t('unconfirmedTitle'), rows: review.unconfirmed, tone: 'warn' },
          { key: 'pending', title: t('pendingTitle'), rows: review.pending, tone: 'err' },
        ];
        return h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
          h(
            Card,
            {
              title: t('reviewTitle'),
              extra: h(
                'div',
                { className: 'dsfig-head-actions' },
                h(
                  'label',
                  { className: 'dsfig-hint', style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                  h('input', {
                    type: 'checkbox',
                    checked: strict,
                    onChange: function (event) {
                      setStrict(event.target.checked);
                    },
                  }),
                  t('strict'),
                ),
                h(Btn, { variant: 'primary', onClick: () => run('review', { strict: strict }), disabled: !!busy }, busy === 'review' ? t('running') : t('runReview')),
              ),
            },
            h('p', { className: 'dsfig-hint', style: { margin: 0 } }, t('reviewHint')),
            h('div', { className: 'dsfig-mono' }, review.file),
            review.queue ? h('div', { className: 'dsfig-hint' }, t('queue') + ': ' + review.queue.page + ' · ' + review.queue.nodeId) : null,
            review.errors.length ? h('div', { className: 'dsfig-err' }, review.errors.map((line, index) => h('div', { key: index }, '✗ ' + line))) : null,
            review.strictPassed
              ? h('div', { className: 'dsfig-ok' }, t('strictPassed'))
              : h('div', { className: 'dsfig-warn' }, t('strictBlocked')),
          ),
          groups.map((group) =>
            h(
              Card,
              { key: group.key, title: group.title + ' (' + group.rows.length + ')' },
              group.rows.length
                ? h(
                    'div',
                    { className: 'dsfig-list' },
                    group.rows.map((row, index) => {
                      var title = row.section || row.what || '(unnamed)';
                      var detail =
                        group.key === 'pending'
                          ? [row.added, (row.code || []).join(' '), (row.nodes ? [...(row.nodes.screens || []), ...(row.nodes.components || [])] : []).join(' ')]
                              .filter(Boolean)
                              .join(' · ')
                          : [row.nodeId, row.since, row.note].filter(Boolean).join(' · ');
                      return h(
                        'div',
                        { key: index, className: 'dsfig-li' },
                        h('div', { className: 'dsfig-row-text' }, h('span', { className: 'dsfig-label' }, title), h('span', { className: 'dsfig-hint' }, detail)),
                        h(Pill, { tone: group.tone }, group.key === 'ready' ? t('ready') : group.key === 'unconfirmed' ? t('unconfirmed') : t('pending')),
                      );
                    }),
                  )
                : h(Empty, null, t('none')),
            ),
          ),
        );
      }

      function renderPlaybooks() {
        var books = (state && state.playbooks) || [];
        return h(
          Card,
          { title: t('playbooksTitle') },
          h('p', { className: 'dsfig-hint', style: { margin: 0 } }, t('playbooksHint')),
          books.length
            ? h(
                'div',
                { className: 'dsfig-split' },
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
                  books.map((book) =>
                    h(
                      'button',
                      {
                        key: book.dir,
                        type: 'button',
                        className: 'dsfig-book' + (playbook && playbook.name === book.dir ? ' dsfig-book-on' : ''),
                        onClick: () => openPlaybook(book.dir),
                      },
                      h('span', { className: 'dsfig-book-name' }, book.dir),
                      h('span', { className: 'dsfig-book-desc' }, book.description || book.name),
                    ),
                  ),
                ),
                playbook
                  ? h(
                      'div',
                      null,
                      h('div', { className: 'dsfig-hint', style: { marginBottom: '8px' } }, playbook.title || playbook.name),
                      h('pre', { className: 'dsfig-pre' }, playbook.markdown),
                    )
                  : h(Empty, null, t('pickPlaybook')),
              )
            : h(Empty, null, 'playbooks/'),
        );
      }

      function commandRows() {
        return [
          {
            name: 'init',
            desc: t('cmdInit'),
            controls: h(
              'div',
              { className: 'dsfig-form' },
              h(Field, { label: t('initName'), value: initForm.name, onChange: (value) => setInitForm({ ...initForm, name: value }) }),
              h(Field, { label: t('initPrefix'), value: initForm.prefix, onChange: (value) => setInitForm({ ...initForm, prefix: value }) }),
              h(Field, { label: t('initSource'), value: initForm.source, onChange: (value) => setInitForm({ ...initForm, source: value }) }),
            ),
            run: () => run('init', { name: initForm.name, prefix: initForm.prefix, source: initForm.source || undefined, agents: initForm.agents || undefined }),
          },
          {
            name: 'source',
            desc: t('cmdSource'),
            controls: h('div', { className: 'dsfig-form' }, h(Field, { label: t('sourceInput'), value: sourceInput, placeholder: 'https://www.figma.com/design/… 或 design-system.html', onChange: setSourceInput })),
            run: () => run('source', { source: sourceInput || undefined }),
          },
          {
            name: 'sync',
            desc: t('cmdSync'),
            controls: h('div', { className: 'dsfig-form' }, h(Field, { label: t('label'), value: syncLabel, placeholder: 'DS-2026-11-15', onChange: setSyncLabel })),
            run: () => run('sync', { label: syncLabel || undefined }),
          },
          { name: 'build', desc: t('cmdBuild'), controls: null, run: () => run('build') },
          { name: 'check', desc: t('cmdCheck'), controls: null, run: () => run('check') },
          { name: 'registry', desc: t('cmdRegistry'), controls: null, run: () => run('registry') },
          {
            name: 'review',
            desc: t('cmdReview'),
            controls: null,
            run: () => run('review', { strict: strict }),
          },
          {
            name: 'rules',
            desc: t('cmdRules'),
            controls: h('div', { className: 'dsfig-form' }, h(Field, { label: 'skillsDirs', value: skillsDirs, placeholder: '.claude/skills', onChange: setSkillsDirs })),
            run: () => run('rules', { skillsDirs: skillsDirs }),
          },
          { name: 'paths', desc: t('cmdPaths'), controls: null, run: () => run('paths') },
        ];
      }

      function renderCommands() {
        return h(
          Card,
          { title: t('commandsTitle') },
          h('p', { className: 'dsfig-hint', style: { margin: 0 } }, t('commandsHint')),
          h(
            'div',
            { className: 'dsfig-list' },
            commandRows().map((row) =>
              h(
                'div',
                { key: row.name, className: 'dsfig-li', style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
                h(
                  'div',
                  { className: 'dsfig-row' },
                  h(
                    'div',
                    { className: 'dsfig-row-text' },
                    h('span', { className: 'dsfig-label dsfig-mono', style: { color: 'var(--dsw-alias-label-primary)', fontSize: '12.5px' } }, 'ds-workflow ' + row.name),
                    h('span', { className: 'dsfig-hint' }, row.desc),
                  ),
                  h(Btn, { variant: row.name === 'check' ? 'primary' : 'ghost', disabled: !!busy || !dir, onClick: row.run }, busy === row.name ? t('running') : t('run')),
                ),
                row.controls,
              ),
            ),
          ),
        );
      }

      function renderDock() {
        if (!result) return null;
        return h(
          'div',
          { className: 'dsfig-dock' },
          h(
            'div',
            { className: 'dsfig-dock-head' },
            h(
              'div',
              { className: 'dsfig-dock-title' },
              h('span', null, 'ds-workflow ' + result.command),
              h(Pill, { tone: result.ok ? 'ok' : 'err' }, (result.ok ? t('exitOk') : t('exitFail')) + ' ' + result.code),
              h('span', { className: 'dsfig-mono' }, result.ms + 'ms'),
            ),
            h(Btn, { variant: 'quiet', onClick: () => setResult(null) }, t('clear')),
          ),
          h(
            'div',
            { className: 'dsfig-dock-body' },
            (result.lines || []).map((line, index) =>
              h('div', { key: index, className: line.level === 'err' ? 'dsfig-line-err' : 'dsfig-line-out' }, line.text),
            ),
          ),
        );
      }

      function renderBody() {
        if (!dir) return h(Empty, null, t('noProject'));
        if (loadError) return h('div', { className: 'dsfig-err' }, loadError);
        if (!state) return h(Empty, null, busy ? t('loading') : t('noProject'));
        switch (tab) {
          case 'gate':
            return renderGate();
          case 'tokens':
            return renderTokens();
          case 'registry':
            return renderRegistry();
          case 'review':
            return renderReview();
          case 'playbooks':
            return renderPlaybooks();
          case 'commands':
            return renderCommands();
          default:
            return renderOverview();
        }
      }

      var projects = boot && boot.projects ? boot.projects : [];

      return h(
        'div',
        { className: 'dsfig-page' },
        h(
          'header',
          { className: 'dsfig-head' },
          h(
            'div',
            { className: 'dsfig-titles' },
            h('h1', { className: 'dsfig-title' }, t('title')),
            h('p', { className: 'dsfig-sub' }, t('subtitle')),
            h('span', { className: 'dsfig-meta' }, dir || '—'),
          ),
          h(
            'div',
            { className: 'dsfig-head-actions' },
            projects.length > 1
              ? h(
                  'select',
                  {
                    className: 'dsfig-select',
                    value: dir,
                    onChange: function (event) {
                      switchDir(event.target.value);
                    },
                  },
                  projects.map((project) =>
                    h('option', { key: project.path, value: project.path }, (project.initialized ? '● ' : '○ ') + project.name + '  —  ' + project.path),
                  ),
                )
              : null,
            h('input', {
              className: 'dsfig-input',
              placeholder: t('openPathPlaceholder'),
              value: pathInput,
              onChange: function (event) {
                setPathInput(event.target.value);
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') openPath();
              },
              style: { width: '240px' },
            }),
            h(Btn, { variant: 'quiet', onClick: openPath, disabled: !!busy || !pathInput.trim() }, t('openPath')),
            h(Btn, { variant: 'quiet', onClick: () => (dir ? loadState(dir) : null), disabled: !!busy }, busy === 'refresh' ? t('loading') : t('refresh')),
            h('span', { className: 'dsfig-meta' }, 'v' + BUILD),
          ),
        ),
        h(
          'nav',
          { className: 'dsfig-tabs', role: 'tablist' },
          tabs.map((entry) =>
            h(
              'button',
              {
                key: entry.id,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === entry.id,
                className: 'dsfig-tab' + (tab === entry.id ? ' dsfig-tab-on' : ''),
                onClick: function () {
                  setTab(entry.id);
                },
              },
              entry.label,
              entry.count ? h('span', { className: 'dsfig-count' }, entry.count) : null,
            ),
          ),
        ),
        renderBody(),
        renderDock(),
      );
    }

    function Icon(props) {
      var size = typeof props.size === 'number' ? props.size : 20;
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('rect', { x: 2.4, y: 2.4, width: 8.4, height: 8.4, rx: 2.2, fill: 'currentColor', opacity: props.active ? 1 : 0.9 }),
        h('rect', { x: 13.2, y: 2.4, width: 8.4, height: 8.4, rx: 2.2, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 2.4, y: 13.2, width: 8.4, height: 8.4, rx: 2.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }),
        h('circle', { cx: 17.4, cy: 17.4, r: 4.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }),
        h('circle', { cx: 17.4, cy: 17.4, r: 1.6, fill: 'currentColor' }),
      );
    }

    return { Page: Page, Icon: Icon, Boundary: Boundary };
  }

  var DICT = {
    zh: {
      nav: '设计系统',
      title: 'Figma 设计系统',
      subtitle: 'ds-workflow · 锁定 token、组件登记、门禁与设计师评审，全部落在这个仓库的文件里。',
      renderFailed: '页面渲染失败',
      empty: '暂无数据',
      tabOverview: '概览',
      tabGate: '门禁',
      tabTokens: 'Token',
      tabRegistry: '组件',
      tabReview: '评审',
      tabPlaybooks: '手册',
      tabCommands: '命令',
      refresh: '刷新',
      loading: '加载中…',
      running: '运行中…',
      run: '运行',
      clear: '收起',
      noProject: '没有可用的项目目录',
      openPath: '打开',
      openPathPlaceholder: '项目路径（不在列表里就直接贴）',
      noLedger: '未找到评审台账',
      setupTitle: '接入一个项目',
      setupHint:
        '把 ds-workflow 接进这个目录：它会写入 design-system.config.json、design-system/ 骨架、AGENTS.md 规则段、CI 与手册副本，然后就可以同步 token、跑门禁了。',
      initName: '设计系统名称',
      initPrefix: 'CSS 前缀',
      initSource: '设计系统来源（Figma 链接或 HTML 导出，可留空）',
      initAgents: 'Agent 目标（agents-md,cursor,…）',
      initNamePlaceholder: 'Acme DS',
      runInit: '初始化项目',
      statTokens: 'Token',
      statComponents: '代码组件',
      statPending: '待设计师评审',
      statComponentsHint: '登记表条目',
      statPendingHint: 'figma-review 台账',
      statRules: 'Agent 规则',
      rulesInjected: '已注入',
      rulesMissing: '未注入',
      sourceTitle: '设计系统来源与锁定版本',
      notSynced: '还没有锁定版本：先跑一次 sync，token 与组件清单才会固定到这个 label。',
      lockedAt: '锁定于',
      nextSteps: '下一步',
      filesTitle: '仓库状态文件',
      runBuild: 'build 生成 CSS',
      runCheck: '运行 check',
      runRegistry: '生成登记表',
      runRules: '刷新规则',
      gateTitle: '门禁 check',
      gateHint: '只读：扫描代码里的 token 引用、硬编码颜色、px 与登记表 / 台账的一致性。',
      scan: '扫描目录',
      componentDirs: '组件库目录',
      prefix: 'token 前缀',
      gatePassed: '通过：没有发现违规。',
      gateNotRun: '还没运行过。点右上角「运行 check」查看结果。',
      runCheckUpdate: '降低字面量基线（--update）',
      gateRulesTitle: '这门禁拦什么',
      gateRule1: '引用了锁定版本里不存在的 var(--前缀-*)',
      gateRule2: 'font-family 不是 var(…)（@font-face 除外）',
      gateRule3: '组件库里写 px（0 与 @media 条件除外），或用了非 token 的自定义属性',
      gateRule4: '硬编码颜色 / 旧 token 字面量按文件计数，只能减少',
      gateRule5: '登记表：状态合法、code 不重复、nodeId 在锁定清单里、proposed 用提案前缀',
      gateRule6: '评审台账：格式正确，待评审项不能改动设计师已定稿 / 未确认的节点',
      tokensTitle: 'Token',
      search: '搜索 token 或 Figma 路径',
      from: '来自',
      truncated: '仅显示前',
      tokensEmpty: '还没有生成 token：先 sync 再 build。',
      noMatch: '没有匹配项',
      group: '分组',
      status: '状态',
      statusPinned: '已锁定',
      statusApproved: '已批准',
      statusReuse: '复用',
      statusExtend: '扩展变体（待批准）',
      statusProposed: '提案（待批准）',
      statusNeedsDesigner: '待设计师决定',
      statusDeprecated: '已废弃',
      registryTitle: '组件登记表',
      code: '代码组件',
      purpose: '用途',
      screens: '使用画面',
      proposal: '提案 ↗',
      registryEmpty: '登记表还是空的：按 playbook ds-map 把「代码组件 ↔ Figma 组件」记进来。',
      reviewTitle: '设计师评审台账',
      reviewHint: 'Figma 接口读不到 Ready for dev 标记，所以状态记在仓库里：ready 永不原地修改，改动放 v2 并进 pending。',
      queue: '评审看板',
      strict: '严格模式（有待评审项即失败）',
      runReview: '校验台账',
      readyTitle: '已定稿 Ready for dev',
      unconfirmedTitle: '未确认',
      pendingTitle: '待评审',
      ready: '已定稿',
      unconfirmed: '未确认',
      pending: '待评审',
      none: '没有条目',
      strictPassed: '可以发布：台账有效，且没有待评审项。',
      strictBlocked: '还不能发布：台账有错误或仍有待评审项。',
      playbooksTitle: 'Agent 手册 playbooks',
      playbooksHint: '这 8 个 SKILL.md 会随包复制到项目里，任意 coding agent 都能读到；这里是同一份内容的只读视图。',
      pickPlaybook: '选一个手册查看内容',
      commandsTitle: '命令',
      commandsHint: '和 `npx ds-workflow <command>` 一一对应；Figma 侧（导出、写回、评审提醒）仍然通过 Figma MCP 由 agent 执行。',
      exitOk: '成功',
      exitFail: '失败',
      label: '版本 label',
      sourceInput: '来源',
      cmdInit: '接入：配置、骨架、CI、agent 规则、手册副本（不覆盖已有文件）',
      cmdSource: '设置 / 查看设计系统来源并刷新 agent 规则',
      cmdSync: '把导出（HTML 或 Figma 插件导出 JSON）固定成一个版本 label',
      cmdBuild: 'tokens → CSS 自定义属性 + names.json',
      cmdCheck: '门禁：token 引用、硬编码、px、登记表、台账',
      cmdRegistry: '登记表 → 可读的 markdown',
      cmdReview: '评审台账：Ready / 未确认 / 待评审',
      cmdRules: '重写 AGENTS.md 托管段与各 agent 规则文件',
      cmdPaths: '显示包内手册与 Figma 导出脚本的位置',
      setupFirst: '这个目录还没接入 ds-workflow：先到「概览」运行初始化。',
    },
    en: {
      nav: 'Design System',
      title: 'Figma Design System',
      subtitle: 'ds-workflow · pinned tokens, component registry, the check gate and the designer review loop, all in repository files.',
      renderFailed: 'This page failed to render',
      empty: 'No data',
      tabOverview: 'Overview',
      tabGate: 'Gate',
      tabTokens: 'Tokens',
      tabRegistry: 'Components',
      tabReview: 'Review',
      tabPlaybooks: 'Playbooks',
      tabCommands: 'Commands',
      refresh: 'Refresh',
      loading: 'Loading…',
      running: 'Running…',
      run: 'Run',
      clear: 'Hide',
      noProject: 'No project directory available',
      openPath: 'Open',
      openPathPlaceholder: 'Project path (paste one not in the list)',
      noLedger: 'Review ledger not found',
      setupTitle: 'Set up a project',
      setupHint:
        'Adopt ds-workflow in this directory: it writes design-system.config.json, the design-system/ skeleton, the AGENTS.md rules block, CI and the playbook copies. Then tokens can be synced and the gate can run.',
      initName: 'Design system name',
      initPrefix: 'CSS prefix',
      initSource: 'Source (Figma link or HTML export, optional)',
      initAgents: 'Agent targets (agents-md,cursor,…)',
      initNamePlaceholder: 'Acme DS',
      runInit: 'Initialize project',
      statTokens: 'Tokens',
      statComponents: 'Code components',
      statPending: 'Waiting for the designer',
      statComponentsHint: 'registry entries',
      statPendingHint: 'figma-review ledger',
      statRules: 'Agent rules',
      rulesInjected: 'Injected',
      rulesMissing: 'Missing',
      sourceTitle: 'Source and pinned version',
      notSynced: 'No pinned version yet: run sync once so tokens and components are fixed to a label.',
      lockedAt: 'locked',
      nextSteps: 'Next steps',
      filesTitle: 'Repository state files',
      runBuild: 'build tokens → CSS',
      runCheck: 'Run check',
      runRegistry: 'Render registry',
      runRules: 'Refresh rules',
      gateTitle: 'Gate · check',
      gateHint: 'Read-only: scans token references, hard-coded colours, px and the registry / ledger consistency.',
      scan: 'scan',
      componentDirs: 'component dirs',
      prefix: 'token prefix',
      gatePassed: 'Passed: no violations found.',
      gateNotRun: 'Not run yet. Press "Run check" in the header.',
      runCheckUpdate: 'Lower the literal baseline (--update)',
      gateRulesTitle: 'What the gate blocks',
      gateRule1: 'a var(--prefix-*) that the pinned version does not define',
      gateRule2: 'font-family that is not var(…) (except @font-face)',
      gateRule3: 'px in the component dirs (0 and @media conditions excepted), or a custom property that is not a token',
      gateRule4: 'hard-coded colours / legacy literals are counted per file and may only go down',
      gateRule5: 'registry: valid status, unique code, nodeId inside the pinned component list, proposed/ prefix',
      gateRule6: 'review ledger: well-formed, and a pending change may not touch a signed-off or unconfirmed node',
      tokensTitle: 'Tokens',
      search: 'Search token or Figma path',
      from: 'from',
      truncated: 'showing',
      tokensEmpty: 'No tokens generated yet: sync, then build.',
      noMatch: 'No match',
      group: 'group',
      status: 'status',
      statusPinned: 'pinned',
      statusApproved: 'approved',
      statusReuse: 'reused',
      statusExtend: 'extended (awaiting approval)',
      statusProposed: 'proposed (awaiting approval)',
      statusNeedsDesigner: 'needs the designer',
      statusDeprecated: 'deprecated',
      registryTitle: 'Component registry',
      code: 'Code component',
      purpose: 'Purpose',
      screens: 'Screens',
      proposal: 'proposal ↗',
      registryEmpty: 'The registry is empty: record code ↔ Figma components with the ds-map playbook.',
      reviewTitle: 'Designer review ledger',
      reviewHint: 'The Figma API cannot read the Ready-for-dev mark, so the state lives in the repo: ready nodes are never changed in place; changes go in a v2 beside them and into pending.',
      queue: 'review queue',
      strict: 'Strict (fail while anything waits)',
      runReview: 'Validate ledger',
      readyTitle: 'Signed off · Ready for dev',
      unconfirmedTitle: 'Unconfirmed',
      pendingTitle: 'Waiting for review',
      ready: 'ready',
      unconfirmed: 'unconfirmed',
      pending: 'pending',
      none: 'No entries',
      strictPassed: 'Releasable: the ledger is valid and nothing is waiting for review.',
      strictBlocked: 'Not releasable yet: the ledger has errors or entries are still waiting.',
      playbooksTitle: 'Agent playbooks',
      playbooksHint: 'These eight SKILL.md files are copied into the project so any coding agent can read them; this is a read-only view of the same content.',
      pickPlaybook: 'Pick a playbook to read it',
      commandsTitle: 'Commands',
      commandsHint: 'One to one with `npx ds-workflow <command>`; the Figma side (export, write-back, review reminders) stays an MCP operation the agent performs.',
      exitOk: 'ok',
      exitFail: 'failed',
      label: 'version label',
      sourceInput: 'source',
      cmdInit: 'Adopt: config, skeleton, CI, agent rules, playbook copies (never overwrites)',
      cmdSource: 'Set / show where the design system comes from and refresh the rules',
      cmdSync: 'Pin an export (HTML or Figma plugin JSON) to a version label',
      cmdBuild: 'tokens → CSS custom properties + names.json',
      cmdCheck: 'Gate: token references, hard-coded values, px, registry, ledger',
      cmdRegistry: 'Registry → readable markdown',
      cmdReview: 'Review ledger: ready / unconfirmed / waiting',
      cmdRules: 'Rewrite the AGENTS.md managed block and the agent rule files',
      cmdPaths: 'Where the bundled playbooks and the Figma export script are',
      setupFirst: 'This directory is not wired to ds-workflow yet: run Initialize from the Overview tab first.',
    },
  };

  function currentLanguage(ctx) {
    try {
      var locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
      var snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : locale && typeof locale.getLocale === 'function' ? locale.getLocale() : undefined;
      var value = snapshot && typeof snapshot === 'object' ? snapshot.locale || snapshot.language || snapshot.id : snapshot;
      if (typeof value === 'string' && value.toLowerCase().indexOf('zh') !== 0) return 'en';
    } catch (error) {
      /* keep Chinese */
    }
    return 'zh';
  }

  function createPlugin(require, ctx) {
    var React = require('react');
    var language = currentLanguage(ctx);
    var dictionary = DICT[language] || DICT.zh;
    var t = function (key) {
      return dictionary[key] !== undefined ? dictionary[key] : key;
    };
    var components = createComponents(React, t);

    return {
      components: components,
      inject: ['slots'],
      apply: function (app) {
        app.effect(function () {
          var style = document.createElement('style');
          style.setAttribute('data-plugin', PLUGIN_ID);
          style.textContent = CSS;
          document.head.appendChild(style);
          return function () {
            if (style.parentNode) style.parentNode.removeChild(style);
          };
        }, PLUGIN_ID + ': stylesheet');

        // The sidebar entry owns the button; the page renders where the shell dispatches this key.
        app.slots.inject('sidebar.panellist', function () {
          return app.slots.register(
            { name: 'sidebar.panellist', id: 'figma-ds', order: 30, label: function () { return t('nav'); } },
            components.Icon,
          );
        });
        app.slots.inject('main', function () {
          return app.slots.register({ name: 'main', key: 'figma-ds' }, function () {
            return React.createElement(components.Boundary, null, React.createElement(components.Page));
          });
        });
      },
    };
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__FIGMA_DS_INTERNALS__ = { createPlugin: createPlugin, createComponents: createComponents, BUILD: BUILD };
  }

  if (typeof window !== 'undefined' && window.__ModuleLoader__ && typeof window.__ModuleLoader__.load === 'function') {
    window.__ModuleLoader__.load({
      id: PLUGIN_ID,
      factory: function (require) {
        // Side-effect free: the component tree is built lazily inside apply().
        var built = null;
        return {
          inject: ['slots'],
          apply: function (app) {
            if (!built) built = createPlugin(require, app);
            return built.apply(app);
          },
        };
      },
    });
  }
})();
