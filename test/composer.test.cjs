const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../lib/client.js'), 'utf8');
function boot(preset, scope) {
  const listeners = new Map();
  const renderers = {};
  let stored;
  const sandbox = {
    console, navigator: { platform: 'Win32' },
    KeyboardEvent: class {
      constructor(type, init) { Object.assign(this, { type, ...init }); }
      preventDefault() { this.defaultPrevented = true; }
      stopImmediatePropagation() { this.stopped = true; }
    },
    window: {
      localStorage: { getItem: () => preset, setItem: (_, value) => { stored = value; } },
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      __ModuleLoader__: { load(entry) { sandbox.entry = entry; } },
    },
    document: { createElement: () => ({ setAttribute() {}, remove() {} }), head: { append() {} } },
  };
  sandbox.InputEvent = sandbox.KeyboardEvent;
  const React = {
    useState: (value) => [value, () => {}], useEffect() {},
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
  };
  vm.runInNewContext(code, sandbox);
  const disposers = [];
  sandbox.entry.factory(() => React).apply({
    inject(_, callback) {
      if (scope) callback({ get: () => ({ bind: () => scope }), effect: (fn) => { const dispose = fn(); if (dispose) disposers.push(dispose); } });
    },
    get: (key) => key === 'slots' ? {
      inject: (_, fn) => fn(), register: (spec, render) => { renderers[spec.name + ':' + spec.id] = render; return () => {}; },
    } : undefined,
    effect: (fn) => { const dispose = fn(); if (dispose) disposers.push(dispose); },
    timeout: () => () => {},
  });
  function dispatch(target, init) {
    const e = new sandbox.KeyboardEvent('keydown', { key: 'Enter', shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,target, ...init });
    for (const fn of listeners.get('keydown')) { fn(e); if (e.stopped) break; }
    // Simulates a later host listener: the original must not reach it twice.
    if (!e.stopped) target.hostEvents?.push(e);
    return e;
  }
  const composer = {
    isContentEditable: true, tagName: 'DIV', hostEvents: [], picking: false, webkit: false, beforeInputs: [],
    closest(selector) { return selector === '[data-composer-input]' ? this : { querySelector: () => this.picking ? {} : null }; },
    dispatchEvent(e) {
      e.target = this;
      if (e.type === 'beforeinput') { this.beforeInputs.push(e); e.preventDefault(); return false; }
      for (const fn of listeners.get('keydown')) { fn(e); if (e.stopped) break; }
      if (!e.stopped) { this.hostEvents.push(e); if (!this.webkit) e.preventDefault(); }
      return !e.defaultPrevented;
    },
  };
  function controls() {
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      nodes.push(node); node.children?.forEach(visit);
    }
    visit(renderers['settings.section:dyn-shortcuts']().type());
    return nodes;
  }
  function row(id) { return controls().find(node => node.props['data-shortcut-action'] === id); }
  return { dispatch, composer, row, controls, toast: () => renderers['shell.overlay:dyn-shortcuts-toast']().type(), stored: () => stored, listeners,
    dispose: () => disposers.reverse().forEach(fn => fn()) };
}

const env = boot(null);
for (const [chord,ctrl,shift] of [[{},false,false],[{ctrlKey:true},true,false],[{shiftKey:true},false,true]]) {
 env.composer.hostEvents.length=0;
 const original=env.dispatch(env.composer,chord);
 assert.equal(original.stopped,true); assert.equal(original.defaultPrevented,true);
 assert.equal(env.composer.hostEvents.length,1);
 assert.equal(env.composer.hostEvents[0].ctrlKey,ctrl); assert.equal(env.composer.hostEvents[0].shiftKey,shift);
}
assert.deepEqual(['sendMessage','sendAccelerated','insertNewline'].map(id=>env.row(id).children[0].children[0].children[0]),['发送会话','插队/排队发送','换行']);
assert.equal(env.controls().some(n=>n.type==='select'),false,'actions use the shared rows, not behavior dropdowns');
const custom=boot(JSON.stringify({actions:{sendMessage:{combo:'Control+S'},sendAccelerated:{combo:'Control+Q'},insertNewline:{combo:'Control+J'}}}));
custom.dispatch(custom.composer,{key:'s',ctrlKey:true}); custom.dispatch(custom.composer,{key:'q',ctrlKey:true}); custom.dispatch(custom.composer,{key:'j',ctrlKey:true});
assert.deepEqual(custom.composer.hostEvents.map(e=>[e.ctrlKey,e.shiftKey]),[[false,false],[true,false],[false,true]]);
custom.composer.hostEvents.length=0; custom.dispatch(custom.composer,{});
assert.equal(custom.composer.hostEvents.length,0,'old Enter binding does not fall through to native send');
const clear=custom.row('sendAccelerated').children[1].children.find(n=>n.type==='button'&&n.children.includes('清除')); clear.props.onClick();
custom.dispatch(custom.composer,{key:'q',ctrlKey:true}); assert.equal(custom.composer.hostEvents.length,1,'cleared non-Enter chord passes through');
const disabled=boot(JSON.stringify({actions:{sendMessage:{enabled:false,combo:'Enter'}}}));
disabled.dispatch(disabled.composer,{}); assert.equal(disabled.composer.hostEvents.length,0,'disabled Enter never sends natively');
const reloaded=boot(custom.stored()); assert.equal(reloaded.row('sendAccelerated').children[1].children.find(n=>n.type==='button'&&n.children.includes('清除')).props.disabled,true);
for (const init of [{isComposing:true},{keyCode:229},{altKey:true}]) assert.equal(env.dispatch(env.composer,init).stopped,undefined);
for(const fn of env.listeners.get('compositionstart')) fn({target:env.composer}); assert.equal(env.dispatch(env.composer,{}).stopped,undefined);
for(const fn of env.listeners.get('compositionend')) fn({target:env.composer}); assert.equal(env.dispatch(env.composer,{}).stopped,undefined);
const other={hostEvents:[],closest:()=>null}; env.dispatch(other,{ctrlKey:true}); assert.equal(other.hostEvents.length,1);
const fresh=boot(null); fresh.composer.webkit=true; fresh.dispatch(fresh.composer,{shiftKey:true}); assert.equal(fresh.composer.beforeInputs[0].inputType,'insertLineBreak');
fresh.composer.hostEvents.length=0; fresh.dispatch(fresh.composer,{repeat:true}); assert.equal(fresh.composer.hostEvents.length,0);
fresh.composer.picking=true; fresh.dispatch(fresh.composer,{shiftKey:true}); assert.equal(fresh.composer.hostEvents[0].shiftKey,false,'menu highlight wins over configured newline');
const legacy=boot(JSON.stringify({composer:{enter:'newline',ctrlEnter:'dsh'},actions:{newSession:{enabled:false,combo:'Control+Shift+N'}}}));
legacy.row('sendMessage').children[1].children[0].children.find(n=>n.type==='input').props.onChange({target:{checked:false}});
assert.deepEqual(JSON.parse(legacy.stored()).actions.newSession,{enabled:false,combo:'Control+Shift+N'});
assert.equal(JSON.parse(legacy.stored()).actions.sendAccelerated.combo,'Control+Enter'); assert.equal(JSON.parse(legacy.stored()).composer,undefined);
const reset=legacy.controls().find(n=>n.type==='button'&&n.children.includes('恢复默认快捷键')); reset.props.onClick(); assert.equal(JSON.parse(legacy.stored()).actions.sendMessage.combo,'Enter');
const conflicting=boot(JSON.stringify({actions:{copyLastMessage:{enabled:true,combo:'Control+Enter'}}})); conflicting.row('sendMessage').children[1].children[0].children.find(n=>n.type==='input').props.onChange({target:{checked:false}}); assert.equal(JSON.parse(conflicting.stored()).actions.sendAccelerated.combo,null);
fresh.dispose(); assert.equal([...fresh.listeners.values()].every(set=>set.size===0),true);
console.log('Composer action bindings, scope, persistence, migration and keyboard routing tests passed.');

(async () => {
  const saved = { user: undefined, status: 'ready', writes: [] };
  function scopeFor() {
    const listeners = new Set();
    return {
      getSnapshot: () => ({ status: saved.status, writable: true, user: saved.user, value: saved.user || { actions: {} } }),
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      async set(field, actions) {
        assert.equal(field, 'actions');
        saved.user = { actions: JSON.parse(JSON.stringify(actions)) };
        saved.writes.push(saved.user);
        for (const fn of listeners) fn();
      },
      publish() { for (const fn of listeners) fn(); },
    };
  }
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const local = JSON.stringify({ actions: { sendMessage: { combo: 'Control+S', enabled: true } } });
  const oldBrowser = boot(local, scopeFor());
  await flush();
  assert.equal(saved.writes.length, 1, 'existing localStorage is migrated once');
  oldBrowser.dispose();
  const restarted = boot(null, scopeFor());
  restarted.dispatch(restarted.composer, { key: 's', ctrlKey: true });
  assert.equal(restarted.composer.hostEvents[0].ctrlKey, false, 'fresh browser restores the saved Host binding');
  assert.equal(saved.writes.length, 1, 'a fresh browser does not overwrite saved bindings with defaults');
  const stale = boot(JSON.stringify({ actions: { sendMessage: { combo: 'Enter' } } }), scopeFor());
  stale.dispatch(stale.composer, { key: 's', ctrlKey: true });
  assert.equal(stale.composer.hostEvents[0].ctrlKey, false, 'Host configuration wins over a stale browser cache');
  saved.status = 'loading';
  const delayedScope = scopeFor();
  const delayed = boot(null, delayedScope);
  delayed.row('sendMessage').children[1].children[0].children[0].props.onChange({ target: { checked: false } });
  saved.status = 'ready'; delayedScope.publish(); await flush();
  assert.equal(saved.user.actions.sendMessage.enabled, false, 'edits made before Host readiness are saved after loading');
  const rejectedScope = scopeFor();
  rejectedScope.set = async () => {};
  const rejected = boot(null, rejectedScope);
  rejected.row('sendMessage').children[1].children[0].children[0].props.onChange({ target: { checked: true } });
  await flush();
  assert.ok(rejected.toast().children[0].includes('未保存'), 'a recovered but rejected Host write must not silently claim persistence');
  rejected.dispose();
  restarted.dispose(); stale.dispose(); delayed.dispose();
  console.log('Host persistence, browser migration, fresh-browser restart and loading-race tests passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });
